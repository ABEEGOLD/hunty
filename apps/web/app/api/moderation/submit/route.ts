import { NextResponse } from "next/server"
import { submitHuntForModeration } from "@/lib/moderation/dbStore"
import type { StoredHunt } from "@/lib/types"
import { withValidation } from "@/lib/api/withValidation"
import { moderationSubmitBodySchema } from "@hunty/types/api-schemas"

export const POST = withValidation(
  { body: moderationSubmitBodySchema },
  async (_req, _context, { body }) => {
    const submission = await submitHuntForModeration(body.hunt as StoredHunt)
    return NextResponse.json({ success: true, submission })
  }
)
