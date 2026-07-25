import { NextResponse } from "next/server"
import { RATE_LIMITS } from "@/lib/config/constants"

// ─── Types ──────────────────────────────────────────────────────────────────

export type RateLimitWindow = "read" | "write" | "admin"

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. */
  limit: number
  /** Window duration in milliseconds. */
  windowMs: number
}

interface BucketEntry {
  /** Timestamps of requests within the current window. */
  timestamps: number[]
}

// ─── Configurable limits from environment ────────────────────────────────────

function envNum(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const WINDOW_MS = envNum("RATE_LIMIT_WINDOW_MS", RATE_LIMITS.DEFAULT_WINDOW_MS)

const LIMITS: Record<RateLimitWindow, number> = {
  read: envNum("RATE_LIMIT_READ_IP", RATE_LIMITS.READ_IP_LIMIT),
  write: envNum("RATE_LIMIT_WRITE_IP", RATE_LIMITS.WRITE_IP_LIMIT),
  admin: envNum("RATE_LIMIT_ADMIN_IP", RATE_LIMITS.ADMIN_IP_LIMIT),
}

const WALLET_LIMITS: Record<RateLimitWindow, number> = {
  read: envNum("RATE_LIMIT_READ_WALLET", RATE_LIMITS.READ_WALLET_LIMIT),
  write: envNum("RATE_LIMIT_WRITE_WALLET", RATE_LIMITS.WRITE_WALLET_LIMIT),
  admin: envNum("RATE_LIMIT_ADMIN_WALLET", 10),
}

// ─── Sliding window store ───────────────────────────────────────────────────
// In-memory store. For multi-instance deployments, replace with Redis.

const store = new Map<string, BucketEntry>()

/** Evict stale entries periodically to bound memory. */
const EVICT_INTERVAL_MS = 60_000
let lastEviction = Date.now()

function evictStale() {
  const now = Date.now()
  if (now - lastEviction < EVICT_INTERVAL_MS) return
  lastEviction = now
  const cutoff = now - WINDOW_MS
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

// ─── Core rate limiter ──────────────────────────────────────────────────────

/**
 * Sliding-window rate limiter.
 *
 * Returns whether the request is allowed, how many remain, and when
 * the window resets. Uses a sorted-timestamp sliding window that is
 * more accurate than a fixed-window counter.
 */
export function rateLimit(
  identifier: string,
  config?: Partial<RateLimitConfig>,
  windowType: RateLimitWindow = "read",
): { success: boolean; remaining: number; reset: number; limit: number } {
  evictStale()

  const limit = config?.limit ?? LIMITS[windowType]
  const windowMs = config?.windowMs ?? WINDOW_MS
  const now = Date.now()
  const cutoff = now - windowMs
  const key = `rl:${identifier}`

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]!
    const reset = oldest + windowMs
    return { success: false, remaining: 0, reset, limit }
  }

  entry.timestamps.push(now)
  const remaining = limit - entry.timestamps.length
  const reset = entry.timestamps[0]! + windowMs
  return { success: true, remaining, reset, limit }
}

/**
 * Wallet-aware rate limiter.
 *
 * Checks both IP-based and wallet-based limits. The more restrictive
 * result is returned.
 */
export function rateLimitWithWallet(
  ip: string,
  wallet: string | null | undefined,
  windowType: RateLimitWindow = "read",
): { success: boolean; remaining: number; reset: number; limit: number } {
  const ipResult = rateLimit(`ip:${ip}`, undefined, windowType)

  if (!wallet) return ipResult

  const walletLimit = WALLET_LIMITS[windowType]
  const walletResult = rateLimit(`wallet:${wallet}`, { limit: walletLimit }, windowType)

  // Return the more restrictive result
  if (!ipResult.success && !walletResult.success) {
    // Both exceeded — return the one with the later reset
    return ipResult.reset >= walletResult.reset ? ipResult : walletResult
  }
  if (!ipResult.success) return ipResult
  if (!walletResult.success) return walletResult

  // Both succeeded — return the one with fewer remaining
  return ipResult.remaining <= walletResult.remaining ? ipResult : walletResult
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract client IP from request headers.
 */
export function getIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return "127.0.0.1"
}

/**
 * Extract wallet address from request headers or body.
 * Expects `X-Wallet-Address` header for GET requests.
 */
export function getWallet(req: Request): string | undefined {
  return req.headers.get("x-wallet-address") ?? undefined
}

/**
 * Standard 429 error response with Retry-After and X-RateLimit headers.
 */
export function rateLimitResponse(reset: number, limit?: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  const headers: Record<string, string> = {
    "Retry-After": retryAfterSeconds.toString(),
    "X-RateLimit-Reset": Math.ceil(reset / 1000).toString(),
  }
  if (limit !== undefined) {
    headers["X-RateLimit-Limit"] = limit.toString()
  }
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers },
  )
}

/**
 * Convenience: check rate limit and return 429 response if exceeded.
 * Returns `null` if the request is allowed.
 */
export function enforceRateLimit(
  req: Request,
  windowType: RateLimitWindow = "read",
  walletOverride?: string,
): NextResponse | null {
  const ip = getIP(req)
  const wallet = walletOverride ?? getWallet(req)
  const result = rateLimitWithWallet(ip, wallet, windowType)

  if (!result.success) {
    return rateLimitResponse(result.reset, result.limit)
  }
  return null
}
