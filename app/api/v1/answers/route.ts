import { NextResponse } from "next/server"
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rate-limit"
import {
  verifyAnswer,
  checkMinInterval,
  trackClueSubmission,
  detectAnomalies,
  recordAnswer,
  isBanned,
  calculateScore,
  getConfig,
} from "@/lib/anti-cheat"
import { getServerClue } from "@/lib/server/seedClues"
import { ForbiddenError, NotFoundError, RateLimitError, ValidationError } from "@/lib/api/errors"
import { withErrorHandling } from "@/lib/api/withErrorHandling"

export const POST = withErrorHandling(async (req: Request) => {
  const ip = getIP(req)

  const { success: ipSuccess, reset: ipReset } = rateLimit(ip, {
    limit: getConfig().maxSubmissionsPerWindow,
    windowMs: getConfig().submissionWindowMs,
  })
  if (!ipSuccess) {
    return rateLimitResponse(ipReset)
  }

  let body: { huntId?: number; clueId?: number; answer?: string; wallet?: string; clientTimestamp?: number }
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid request body")
  }

  const { huntId, clueId, answer, wallet, clientTimestamp } = body

  if (!huntId || typeof huntId !== "number") {
    throw new ValidationError("huntId is required", { field: "huntId" })
  }
  if (!clueId || typeof clueId !== "number") {
    throw new ValidationError("clueId is required", { field: "clueId" })
  }
  if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
    throw new ValidationError("answer is required", { field: "answer" })
  }
  if (!wallet || typeof wallet !== "string" || wallet.trim().length === 0) {
    throw new ValidationError("wallet is required", { field: "wallet" })
  }

  if (isBanned(wallet, ip)) {
    throw new ForbiddenError("Account is banned due to suspicious activity")
  }

  const clue = getServerClue(huntId, clueId)
  if (!clue) {
    throw new NotFoundError("Clue not found", { huntId, clueId })
  }

  const { allowed: intervalAllowed, waitMs } = checkMinInterval(wallet, huntId, clueId)
  if (!intervalAllowed) {
    throw new RateLimitError(`Please wait ${Math.ceil(waitMs / 1000)} seconds before submitting again`, {
      waitMs,
    })
  }

  trackClueSubmission(wallet, huntId, clueId)

  const correct = await verifyAnswer(huntId, clueId, answer.trim())

  const anomalyFlags = detectAnomalies(wallet, ip, huntId, clueId, correct)

  const { score, bonusPoints } = calculateScore(huntId, clueId, correct)

  recordAnswer(
    huntId,
    clueId,
    wallet,
    ip,
    answer.trim(),
    correct,
    clientTimestamp ?? null,
    score,
    bonusPoints,
    anomalyFlags,
  )

  if (!correct) {
    return NextResponse.json(
      { correct: false, score: 0, bonusPoints: 0, flags: anomalyFlags },
      { status: 200 },
    )
  }

  return NextResponse.json({
    correct: true,
    score,
    bonusPoints,
    txHash: `mock_tx_${Date.now()}`,
    event: "ClueCompleted",
    serverTimestamp: Date.now(),
    flags: anomalyFlags,
  })
})
