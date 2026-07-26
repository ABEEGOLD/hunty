import { NextRequest, NextResponse } from "next/server"
import {
  getAllHuntViewCounts,
  getHuntViewCount,
  recordHuntView,
} from "@/lib/analytics"
import {
  recordAnalyticsEvent,
  type AnalyticsEvent,
} from "@/lib/huntAnalytics"

/**
 * POST /api/analytics/hunt-view
 *
 * Accepts a structured analytics event payload. For backward compatibility
 * the legacy `{ huntId }` view-only body is still supported and treated as
 * a "view" event.
 *
 * New callers should send:
 * ```json
 * {
 *   "type": "view" | "start" | "completion" | "clue_attempt" | "clue_completion",
 *   "huntId": 123,
 *   ...eventSpecificFields
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const huntId =
    typeof body.huntId === "number" ? body.huntId : Number(body.huntId)

  if (!Number.isFinite(huntId) || huntId <= 0) {
    return NextResponse.json({ error: "Invalid huntId" }, { status: 400 })
  }

  const flooredId = Math.floor(huntId)

  // Determine event type — default to "view" for backward compatibility
  const eventType: string =
    typeof body.type === "string" ? body.type : "view"

  const validTypes = ["view", "start", "completion", "clue_attempt", "clue_completion"]
  if (!validTypes.includes(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 })
  }

  // Build the typed event
  let event: AnalyticsEvent

  switch (eventType) {
    case "view": {
      event = {
        type: "view",
        huntId: flooredId,
        deviceType: body.deviceType ?? "unknown",
        timestamp: body.timestamp,
      }
      break
    }
    case "start": {
      event = { type: "start", huntId: flooredId, timestamp: body.timestamp }
      break
    }
    case "completion": {
      const totalTime = Number(body.totalTimeSeconds)
      if (!Number.isFinite(totalTime) || totalTime < 0) {
        return NextResponse.json(
          { error: "completion events require a non-negative totalTimeSeconds" },
          { status: 400 }
        )
      }
      event = {
        type: "completion",
        huntId: flooredId,
        totalTimeSeconds: totalTime,
        timestamp: body.timestamp,
      }
      break
    }
    case "clue_attempt": {
      const clueIndex = Number(body.clueIndex)
      if (!Number.isFinite(clueIndex) || clueIndex < 0) {
        return NextResponse.json(
          { error: "clue_attempt events require a non-negative clueIndex" },
          { status: 400 }
        )
      }
      event = {
        type: "clue_attempt",
        huntId: flooredId,
        clueIndex,
        clueLabel: typeof body.clueLabel === "string" ? body.clueLabel : undefined,
        timestamp: body.timestamp,
      }
      break
    }
    case "clue_completion": {
      const clueIndex = Number(body.clueIndex)
      const timeTaken = Number(body.timeTakenSeconds)
      if (!Number.isFinite(clueIndex) || clueIndex < 0) {
        return NextResponse.json(
          { error: "clue_completion events require a non-negative clueIndex" },
          { status: 400 }
        )
      }
      if (!Number.isFinite(timeTaken) || timeTaken < 0) {
        return NextResponse.json(
          { error: "clue_completion events require a non-negative timeTakenSeconds" },
          { status: 400 }
        )
      }
      event = {
        type: "clue_completion",
        huntId: flooredId,
        clueIndex,
        timeTakenSeconds: timeTaken,
        clueLabel: typeof body.clueLabel === "string" ? body.clueLabel : undefined,
        timestamp: body.timestamp,
      }
      break
    }
    default:
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 })
  }

  // Persist to the rich analytics store
  await recordAnalyticsEvent(event)

  // For "view" events also maintain the legacy hunt-views.json counter so the
  // existing view-count endpoint remains backward compatible.
  if (eventType === "view") {
    const result = await recordHuntView(flooredId)
    return NextResponse.json({ ...result, eventType })
  }

  return NextResponse.json({ huntId: flooredId, eventType, ok: true })
}

/**
 * GET /api/analytics/hunt-view
 *
 * Legacy view-count endpoint — still returns { huntId, views } or { counts }.
 * Use GET /api/analytics/[huntId] for the full analytics payload.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const huntIdParam = url.searchParams.get("huntId")

  if (huntIdParam) {
    const huntId = Number(huntIdParam)
    if (!Number.isFinite(huntId) || huntId <= 0) {
      return NextResponse.json({ error: "Invalid huntId" }, { status: 400 })
    }

    const views = await getHuntViewCount(Math.floor(huntId))
    return NextResponse.json({ huntId: Math.floor(huntId), views })
  }

  const counts = await getAllHuntViewCounts()
  return NextResponse.json({ counts })
}
