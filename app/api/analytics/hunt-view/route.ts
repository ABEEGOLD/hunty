import { NextRequest, NextResponse } from "next/server"
import { getAllHuntViewCounts, getHuntViewCount, recordHuntView } from "@/lib/analytics"
import { ValidationError } from "@/lib/api/errors"
import { withErrorHandling } from "@/lib/api/withErrorHandling"

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const huntId = typeof body?.huntId === "number" ? body.huntId : Number(body?.huntId)

  if (!Number.isFinite(huntId) || huntId <= 0) {
    throw new ValidationError("Invalid huntId", { huntId: body?.huntId })
  }

  const result = await recordHuntView(Math.floor(huntId))
  return NextResponse.json(result)
})

export const GET = withErrorHandling(async (request: NextRequest) => {
  const url = new URL(request.url)
  const huntIdParam = url.searchParams.get("huntId")

  if (huntIdParam) {
    const huntId = Number(huntIdParam)
    if (!Number.isFinite(huntId) || huntId <= 0) {
      throw new ValidationError("Invalid huntId", { huntId: huntIdParam })
    }

    const views = await getHuntViewCount(Math.floor(huntId))
    return NextResponse.json({ huntId: Math.floor(huntId), views })
  }

  const counts = await getAllHuntViewCounts()
  return NextResponse.json({ counts })
})
