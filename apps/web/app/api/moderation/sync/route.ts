import { NextRequest, NextResponse } from "next/server"
import {
  getCreatorNotifications,
  getModerationStatusForHunts,
  markNotificationRead,
} from "@/lib/moderation/dbStore"
import { assertAdminAuth } from "@/lib/api/adminAuth"
import { withErrorHandling } from "@/lib/api/withErrorHandling"
import { RateLimitError } from "@/lib/api/errors"
import { getIP, rateLimit } from "@/lib/rate-limit"

export const GET = withErrorHandling(async (req: NextRequest) => {
  assertAdminAuth(req)

  const ip = getIP(req)
  const ipResult = rateLimit(`sync_ip:${ip}`, { limit: 60, windowMs: 60 * 1000 })
  if (!ipResult.success) {
    throw new RateLimitError("Too many sync requests from this IP", {
      reset: ipResult.reset,
      remaining: ipResult.remaining,
    })
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email") || undefined
  const huntIdsParam = searchParams.get("huntIds")

  if (huntIdsParam) {
    const huntIds = huntIdsParam
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id))
    return NextResponse.json({ statuses: await getModerationStatusForHunts(huntIds) })
  }

  return NextResponse.json({ notifications: await getCreatorNotifications(email) })
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  assertAdminAuth(req)

  const ip = getIP(req)
  const ipResult = rateLimit(`sync_ip:${ip}`, { limit: 60, windowMs: 60 * 1000 })
  if (!ipResult.success) {
    throw new RateLimitError("Too many sync requests from this IP", {
      reset: ipResult.reset,
      remaining: ipResult.remaining,
    })
  }

  let body: { notificationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.notificationId) {
    return NextResponse.json({ error: "notificationId is required" }, { status: 400 })
  }

  const ok = await markNotificationRead(body.notificationId)
  if (!ok) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
})
