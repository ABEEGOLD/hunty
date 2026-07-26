import { NextRequest, NextResponse } from "next/server";

import { ValidationError } from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { readFeaturedId, writeFeaturedId } from "@/lib/featuredHuntDb";

/**
 * GET /api/admin/featured
 *
 * Returns the currently featured hunt ID, read directly from the database so
 * that all instances always serve the same value.
 */
export const GET = withErrorHandling(async () => {
  const featuredHuntId = await readFeaturedId();
  return NextResponse.json({ featuredHuntId });
});

/**
 * POST /api/admin/featured
 *
 * Body: { huntId: number | null }
 *
 * Persists the featured hunt ID to the database.  Any database failure
 * propagates as an HTTP 500 rather than being silently ignored.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  let body: { huntId?: number | null };
  try {
    body = (await req.json()) as { huntId: number | null };
  } catch {
    throw new ValidationError("Invalid request payload");
  }

  const { huntId } = body;
  // writeFeaturedId throws on DB failure — the error bubbles to withErrorHandling
  // which converts it to an HTTP 500 response.
  await writeFeaturedId(huntId ?? null);

  return NextResponse.json({ success: true, featuredHuntId: huntId ?? null });
});
