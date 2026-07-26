import { promises as fs } from "fs"
import crypto from "crypto"
import path from "path"
import { logger } from "@/lib/logger"

export type HuntViewStats = {
  huntId: number
  views: number
}

const ANALYTICS_STORE_PATH = path.join(process.cwd(), "data", "hunt-views.json")

async function ensureStoreFile(): Promise<void> {
  const dir = path.dirname(ANALYTICS_STORE_PATH)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(ANALYTICS_STORE_PATH)
  } catch {
    await fs.writeFile(ANALYTICS_STORE_PATH, JSON.stringify({}, null, 2), "utf8")
  }
}

async function readAnalyticsStore(): Promise<Record<string, { views: number }>> {
  await ensureStoreFile()
  const raw = await fs.readFile(ANALYTICS_STORE_PATH, "utf8")
  try {
    const data = JSON.parse(raw)
    if (typeof data !== "object" || data === null) {
      return {}
    }
    return data as Record<string, { views: number }>
  } catch {
    return {}
  }
}

async function writeAnalyticsStore(data: Record<string, { views: number }>): Promise<void> {
  await ensureStoreFile()
  await fs.writeFile(ANALYTICS_STORE_PATH, JSON.stringify(data, null, 2), "utf8")
}

export function hashHuntId(huntId: number): string {
  const secret = process.env.HUNT_VIEW_ANALYTICS_SECRET || "hunty-analytics-secret"
  return crypto.createHmac("sha256", secret).update(String(huntId)).digest("hex")
}

export async function recordHuntView(huntId: number): Promise<HuntViewStats> {
  const counts = await readAnalyticsStore()
  const key = String(huntId)
  const views = (counts[key]?.views ?? 0) + 1
  counts[key] = { views }
  await writeAnalyticsStore(counts)

  if (process.env.HUNT_VIEW_ANALYTICS_ENDPOINT) {
    const endpoint = process.env.HUNT_VIEW_ANALYTICS_ENDPOINT
    const payload = {
      event: "hunt_view",
      huntIdHash: hashHuntId(huntId),
      source: "hunt_detail_page",
      timestamp: new Date().toISOString(),
    }

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.HUNT_VIEW_ANALYTICS_KEY
            ? { Authorization: `Bearer ${process.env.HUNT_VIEW_ANALYTICS_KEY}` }
            : {}),
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      // Privacy-preserving analytics should not break page rendering.
      logger.warn("Failed to forward hunt view analytics", error)
    }
  }

  return { huntId, views }
}

export async function getHuntViewCount(huntId: number): Promise<number> {
  const counts = await readAnalyticsStore()
  return counts[String(huntId)]?.views ?? 0
}

export async function getAllHuntViewCounts(): Promise<HuntViewStats[]> {
  const counts = await readAnalyticsStore()
  return Object.entries(counts).map(([huntId, entry]) => ({
    huntId: Number(huntId),
    views: entry.views,
  }))
}

// ─── Hint Usage Analytics ─────────────────────────────────────────────────────

export type HintUsageEvent = {
  huntId: number
  clueId: number
  hintIndex: number  // 0-based index of the hint revealed
  wallet: string
  timestamp: string
}

export type HintUsageStats = {
  huntId: number
  clueId: number
  hintIndex: number
  totalReveals: number
}

const HINT_ANALYTICS_STORE_PATH = path.join(process.cwd(), "data", "hint-usage.json")

async function ensureHintStoreFile(): Promise<void> {
  const dir = path.dirname(HINT_ANALYTICS_STORE_PATH)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(HINT_ANALYTICS_STORE_PATH)
  } catch {
    await fs.writeFile(HINT_ANALYTICS_STORE_PATH, JSON.stringify([], null, 2), "utf8")
  }
}

async function readHintStore(): Promise<HintUsageEvent[]> {
  await ensureHintStoreFile()
  const raw = await fs.readFile(HINT_ANALYTICS_STORE_PATH, "utf8")
  try {
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function writeHintStore(events: HintUsageEvent[]): Promise<void> {
  await ensureHintStoreFile()
  await fs.writeFile(HINT_ANALYTICS_STORE_PATH, JSON.stringify(events, null, 2), "utf8")
}

/**
 * Record a single hint reveal event.
 * The wallet address is hashed before storage so raw addresses are never persisted.
 */
export async function recordHintUsage(
  huntId: number,
  clueId: number,
  hintIndex: number,
  wallet: string,
): Promise<void> {
  const events = await readHintStore()
  const secret = process.env.HUNT_VIEW_ANALYTICS_SECRET || "hunty-analytics-secret"
  const walletHash = crypto.createHmac("sha256", secret).update(wallet).digest("hex")

  events.push({
    huntId,
    clueId,
    hintIndex,
    wallet: walletHash,
    timestamp: new Date().toISOString(),
  })

  await writeHintStore(events)

  // Optional: forward to external analytics endpoint
  if (process.env.HUNT_VIEW_ANALYTICS_ENDPOINT) {
    const payload = {
      event: "hint_used",
      huntIdHash: hashHuntId(huntId),
      clueId,
      hintIndex,
      timestamp: new Date().toISOString(),
    }
    try {
      await fetch(process.env.HUNT_VIEW_ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.HUNT_VIEW_ANALYTICS_KEY
            ? { Authorization: `Bearer ${process.env.HUNT_VIEW_ANALYTICS_KEY}` }
            : {}),
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      logger.warn("Failed to forward hint usage analytics", error)
    }
  }
}

/**
 * Return aggregated hint usage counts grouped by hunt + clue + hintIndex.
 */
export async function getHintUsageStats(huntId: number): Promise<HintUsageStats[]> {
  const events = await readHintStore()
  const filtered = events.filter((e) => e.huntId === huntId)

  const map = new Map<string, HintUsageStats>()
  for (const e of filtered) {
    const key = `${e.huntId}:${e.clueId}:${e.hintIndex}`
    const existing = map.get(key)
    if (existing) {
      existing.totalReveals += 1
    } else {
      map.set(key, { huntId: e.huntId, clueId: e.clueId, hintIndex: e.hintIndex, totalReveals: 1 })
    }
  }

  return Array.from(map.values())
}
