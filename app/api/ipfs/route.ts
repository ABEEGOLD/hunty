import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { BadGatewayError, RateLimitError, ServiceUnavailableError, ValidationError } from "@/lib/api/errors"
import { withErrorHandling } from "@/lib/api/withErrorHandling"

const PINATA_JWT = process.env.PINATA_JWT

// In-memory rate limiter: 10 uploads per IP per hour
const RATE_LIMIT = 10
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

const ipStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipStore.get(ip)

  if (!entry || now >= entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT) return false

  entry.count++
  return true
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!PINATA_JWT) {
    throw new ServiceUnavailableError(
      "IPFS uploads are not configured. Add PINATA_JWT to your environment variables."
    )
  }

  // Wallet address validation
  const wallet = req.headers.get("x-wallet-address")
  if (!wallet) {
    throw new ValidationError("Wallet address required", { header: "x-wallet-address" })
  }

  // Rate limiting by IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  if (!checkRateLimit(ip)) {
    throw new RateLimitError("Too many requests. Limit is 10 uploads per hour.")
  }

  const formData = await req.formData()
  const file = formData.get("file")

  if (!file || !(file instanceof Blob)) {
    throw new ValidationError("No file provided", { field: "file" })
  }

  // Forward to Pinata's pinFileToIPFS endpoint
  const pinataForm = new FormData()
  pinataForm.append("file", file)

  const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: pinataForm,
  })

  if (!pinataRes.ok) {
    const errText = await pinataRes.text()
    logger.error("Pinata upload error:", pinataRes.status, errText)
    throw new BadGatewayError("Failed to pin file to IPFS")
  }

  const data = (await pinataRes.json()) as { IpfsHash: string }
  return NextResponse.json({ cid: data.IpfsHash })
})
