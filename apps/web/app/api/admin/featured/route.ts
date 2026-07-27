import * as Sentry from "@sentry/nextjs"
import fs from "fs"
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { ValidationError } from "@/lib/api/errors"
import { withErrorHandling } from "@/lib/api/withErrorHandling"
import { assertAdminAuth } from "@/lib/api/adminAuth"

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
    Sentry.captureException(error, {
      tags: { source: "featuredHunt", operation: "read" },
      extra: { filePath: FILE_PATH },
    })
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
    // Previously swallowed — now forwarded to Sentry so filesystem failures
    // are visible in production.
    Sentry.captureException(error, {
      tags: { source: "featuredHunt", operation: "write" },
      extra: { filePath: FILE_PATH, featuredHuntId: id },
    })
    // Re-throw so the API route returns a 500 rather than silently succeeding.
    throw error
  }
}

export const GET = withErrorHandling(async (req: Request) => {
  assertAdminAuth(req)
  const featuredHuntId = readFeaturedId()
  return NextResponse.json({ featuredHuntId })
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  assertAdminAuth(req)
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
