import fs from "fs"
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { ValidationError } from "@/lib/api/errors"
import { withErrorHandling } from "@/lib/api/withErrorHandling"

import { logger } from "@/lib/logger"

const FILE_PATH = path.join(process.cwd(), "lib", "featuredHuntServer.json")

function readFeaturedId(): number | null {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return null
    }
    const raw = fs.readFileSync(FILE_PATH, "utf8")
    const parsed = JSON.parse(raw) as { featuredHuntId: number | null }
    return parsed.featuredHuntId ?? null
  } catch (error) {
    logger.error("Error reading featured hunt server file:", error)
    return null
  }
}

function writeFeaturedId(id: number | null): void {
  try {
    const dir = path.dirname(FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify({ featuredHuntId: id }, null, 2), "utf8")
  } catch (error) {
    logger.error("Error writing featured hunt server file:", error)
  }
}

export const GET = withErrorHandling(async () => {
  const featuredHuntId = readFeaturedId()
  return NextResponse.json({ featuredHuntId })
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  let body: { huntId?: number | null }
  try {
    body = (await req.json()) as { huntId: number | null }
  } catch {
    throw new ValidationError("Invalid request payload")
  }

  const { huntId } = body
  writeFeaturedId(huntId ?? null)
  return NextResponse.json({ success: true, featuredHuntId: huntId ?? null })
})
