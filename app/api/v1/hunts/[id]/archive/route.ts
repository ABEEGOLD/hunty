import { NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/v1/hunts/[id]/archive
 * Archive a hunt (hide from public but preserve data).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ip = getIP(req);
  const { success, reset } = rateLimit(ip, { limit: 30, windowMs: 60 * 1000 });

  if (!success) {
    return rateLimitResponse(reset);
  }

  const huntId = parseInt(params.id, 10);
  if (isNaN(huntId)) {
    return NextResponse.json({ error: "Invalid hunt ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "archive") {
      // Archive the hunt
      const { archiveHunts } = await import("@/lib/huntStore");
      archiveHunts([huntId]);
      return NextResponse.json({ success: true, message: "Hunt archived successfully" });
    } else if (action === "unarchive") {
      // Unarchive the hunt
      const { unarchiveHunts } = await import("@/lib/huntStore");
      unarchiveHunts([huntId]);
      return NextResponse.json({ success: true, message: "Hunt unarchived successfully" });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Archive hunt error:", error);
    return NextResponse.json({ error: "Failed to archive hunt" }, { status: 500 });
  }
}
