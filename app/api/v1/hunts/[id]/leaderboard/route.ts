import { NextResponse } from "next/server";

import { get_hunt_leaderboard } from "@/lib/contracts/hunt";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rate-limit";
import { ValidationError } from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { getIP, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/v1/hunts/[id]/leaderboard
 * Get hunt leaderboard with cursor pagination.
 */
export const GET = withErrorHandling<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const ip = getIP(req);
  const { success, reset } = rateLimit(ip, { limit: 100, windowMs: 60 * 1000 });

  if (!success) {
    return rateLimitResponse(reset);
  }

  const { id } = await params;
  const huntId = parseInt(id, 10);

  if (isNaN(huntId)) {
    throw new ValidationError("Invalid hunt ID", { id });
  }

  const { searchParams } = new URL(req.url);
  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? parseInt(cursorParam, 10) : null;
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));

  if (cursorParam && (cursor == null || Number.isNaN(cursor))) {
    throw new ValidationError("Invalid cursor", { cursor: cursorParam });
  }

  const leaderboard = await get_hunt_leaderboard(huntId);

  // get_hunt_leaderboard might return unsorted or current-player augmented data.
  // We sort by points descending to ensure a consistent leaderboard order.
  const sorted = [...leaderboard].sort((a, b) => b.points - a.points);

  const total = sorted.length;
  const pageStart = cursor == null ? 0 : Math.max(0, cursor);
  const paginated = sorted.slice(pageStart, pageStart + limit);
  const nextCursor = paginated.length === limit ? pageStart + paginated.length : null;

  return NextResponse.json({
    data: paginated,
    pagination: {
      total,
      limit,
      cursor,
      nextCursor,
    },
  });
});
