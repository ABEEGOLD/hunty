import { NextRequest, NextResponse } from "next/server"
import {
  getCreatorNotifications,
  getModerationStatusForHunts,
  markNotificationRead,
} from "@/lib/moderation/dbStore"
import { NotFoundError } from "@/lib/api/errors"
import { withValidation } from "@/lib/api/withValidation"
import { withErrorHandling } from "@/lib/api/withErrorHandling"
import { moderationSyncBodySchema } from "@hunty/types/api-schemas"

export const GET = withErrorHandling(async (req: NextRequest) => {
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

export const POST = withValidation(
  { body: moderationSyncBodySchema },
  async (_req, _context, { body }) => {
    const ok = await markNotificationRead(body.notificationId)
    if (!ok) {
      throw new NotFoundError("Notification not found")
    }
    return NextResponse.json({ success: true })
  }
)
