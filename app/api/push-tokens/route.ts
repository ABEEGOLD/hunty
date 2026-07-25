import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import {
  upsertSubscription,
  removeSubscription,
  removeSubscriptionsForWallet,
  getAllSubscriptions,
  getSubscriptionCount,
} from "@/lib/notifications/subscriptionStore"
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rate-limit"

/**
 * POST /api/push-tokens
 * Register a Web Push subscription for a wallet address.
 *
 * Body: { subscription: PushSubscriptionJSON, walletAddress: string }
 */
export async function POST(request: NextRequest) {
  const ip = getIP(request)
  const { success, reset } = rateLimit(ip, { limit: 20, windowMs: 60 * 1000 })
  if (!success) return rateLimitResponse(reset)

  try {
    const body = await request.json()
    const { subscription, walletAddress, preferences } = body

    if (!subscription || typeof subscription !== "object" || !subscription.endpoint) {
      return NextResponse.json(
        { error: "A valid PushSubscription object is required" },
        { status: 400 }
      )
    }

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      )
    }

    upsertSubscription(subscription as PushSubscriptionJSON, walletAddress, preferences)
    logger.info("[push-tokens] Subscription registered for:", walletAddress)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("[push-tokens] Failed to register subscription:", error)
    return NextResponse.json(
      { error: "Failed to register push subscription" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/push-tokens
 * Unregister a push subscription.
 *
 * Body: { walletAddress?: string, endpoint?: string }
 * At least one of walletAddress or endpoint is required.
 */
export async function DELETE(request: NextRequest) {
  const ip = getIP(request)
  const { success, reset } = rateLimit(ip, { limit: 20, windowMs: 60 * 1000 })
  if (!success) return rateLimitResponse(reset)

  try {
    const body = await request.json()
    const { walletAddress, endpoint } = body

    if (!walletAddress && !endpoint) {
      return NextResponse.json(
        { error: "walletAddress or endpoint is required" },
        { status: 400 }
      )
    }

    if (endpoint && typeof endpoint === "string") {
      removeSubscription(endpoint)
    } else if (walletAddress && typeof walletAddress === "string") {
      removeSubscriptionsForWallet(walletAddress)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("[push-tokens] Failed to remove subscription:", error)
    return NextResponse.json(
      { error: "Failed to remove push subscription" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/push-tokens
 * Returns the total number of active subscriptions (admin diagnostic).
 * Does not expose subscription details for privacy.
 */
export async function GET() {
  try {
    const count = getSubscriptionCount()
    return NextResponse.json({ count })
  } catch (error) {
    logger.error("[push-tokens] Failed to fetch subscription count:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}
