import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rate-limit"
import { notifyWallet, notifyWallets } from "@/lib/notifications/pushService"
import type { PushEventType } from "@/lib/notifications/types"
import { withValidation } from "@/lib/api/withValidation"
import { pushSendBodySchema } from "@hunty/types/api-schemas"

/**
 * POST /api/push/send
 *
 * Internal endpoint for triggering Web Push notifications on hunt events.
 * Protected by a shared secret via the Authorization header.
 *
 * Body:
 * {
 *   type: PushEventType,
 *   walletAddresses: string[],  // recipients
 *   context: Record<string, string | number>  // event-specific data (huntName, huntId, etc.)
 * }
 */
export const POST = withValidation(
  { body: pushSendBodySchema },
  async (request: NextRequest, _context, { body }) => {
    const ip = getIP(request)
    const { success, reset } = await rateLimit(ip, { limit: 50, windowMs: 60 * 1000 })
    if (!success) return rateLimitResponse(reset)

    const secret = process.env.PUSH_API_SECRET
    if (secret) {
      const authHeader = request.headers.get("Authorization")
      if (!authHeader || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    try {
      if (body.walletAddresses.length === 1) {
        await notifyWallet(body.walletAddresses[0], body.type as PushEventType, body.context)
      } else {
        await notifyWallets(body.walletAddresses, body.type as PushEventType, body.context)
      }
    } catch (error) {
      logger.error("[push/send] Failed to send push notification:", error)
      return NextResponse.json(
        { error: "Failed to send push notification" },
        { status: 500 }
      )
    }

    logger.info(
      `[push/send] Sent "${body.type}" to ${body.walletAddresses.length} wallet(s)`
    )

    return NextResponse.json({ success: true, sent: body.walletAddresses.length })
  }
)
