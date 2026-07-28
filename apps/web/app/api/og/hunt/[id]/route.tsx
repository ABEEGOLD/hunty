import { ImageResponse } from "next/og"
import { getHuntById } from "@/lib/huntStore"

export const runtime = "edge"

const SIZE = { width: 1200, height: 630 }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const huntId = Number(id)

  if (Number.isNaN(huntId)) {
    return new Response(JSON.stringify({ error: "Invalid hunt id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const hunt = getHuntById(huntId)
  if (!hunt) {
    return new Response(JSON.stringify({ error: "Hunt not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const rewardColour =
    hunt.rewardType === "XLM"
      ? "#FFD43E"
      : hunt.rewardType === "NFT"
        ? "#A78BFA"
        : "#34D399"

  const difficultyColour =
    hunt.difficulty === "Hard"
      ? "#F87171"
      : hunt.difficulty === "Medium"
        ? "#FB923C"
        : "#4ADE80"

  const statusColour =
    hunt.status === "Active"
      ? "#34D399"
      : hunt.status === "Completed"
        ? "#60A5FA"
        : "#94A3B8"

  const title = hunt.title
  const description = hunt.description
    ? hunt.description.length > 100
      ? hunt.description.slice(0, 97) + "…"
      : hunt.description
    : "Join this scavenger hunt on Hunty."
  const rewardPool =
    hunt.rewardPool && hunt.rewardType !== "NFT"
      ? `${hunt.rewardPool} XLM`
      : null
  const rewardLabel =
    hunt.rewardType === "Both" ? "XLM + NFT" : hunt.rewardType

  // Attempt to load cover image
  let coverImageSrc: string | null = null
  if (hunt.coverImageCid) {
    const cid = hunt.coverImageCid
    const coverUrl = cid.startsWith("http") ? cid : `https://ipfs.io/ipfs/${cid}`
    try {
      const res = await fetch(coverUrl, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const buf = await res.arrayBuffer()
        const b64 = Buffer.from(buf).toString("base64")
        const mime = res.headers.get("content-type") || "image/jpeg"
        coverImageSrc = `data:${mime};base64,${b64}`
      }
    } catch {
      // Fall through to branded fallback
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "row",
          background: "linear-gradient(135deg, #0C0C1E 0%, #1A1040 50%, #0E1530 100%)",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Arial', sans-serif",
        }}
      >
        {/* Background blobs */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(139, 92, 246, 0.18)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: 200,
            width: 360,
            height: 300,
            borderRadius: "50%",
            background: "rgba(59, 130, 246, 0.12)",
            filter: "blur(80px)",
          }}
        />

        {/* Left content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 56px",
            flex: 1,
          }}
        >
          {/* Branding */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "linear-gradient(135deg, #7C3AED, #3B82F6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              🎯
            </div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#C4B5FD",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Hunty
            </span>
          </div>

          {/* Title + description */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: statusColour,
                  background: `${statusColour}22`,
                  border: `1px solid ${statusColour}55`,
                  borderRadius: 20,
                  padding: "4px 14px",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {hunt.status}
              </span>
              {hunt.difficulty && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: difficultyColour,
                    background: `${difficultyColour}22`,
                    border: `1px solid ${difficultyColour}55`,
                    borderRadius: 20,
                    padding: "4px 14px",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {hunt.difficulty}
                </span>
              )}
              {hunt.category && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#94A3B8",
                    background: "rgba(148,163,184,0.12)",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 20,
                    padding: "4px 14px",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {hunt.category}
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: title.length > 30 ? 52 : 62,
                fontWeight: 800,
                color: "#FFFFFF",
                lineHeight: 1.1,
                letterSpacing: -1,
              }}
            >
              {title}
            </div>

            <div
              style={{
                fontSize: 22,
                color: "#94A3B8",
                lineHeight: 1.5,
                maxWidth: 580,
              }}
            >
              {description}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                padding: "14px 22px",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  fontWeight: 600,
                }}
              >
                Reward
              </span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: rewardColour,
                }}
              >
                {rewardPool ?? rewardLabel}
              </span>
            </div>

            {hunt.cluesCount ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: "14px 22px",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    fontWeight: 600,
                  }}
                >
                  Clues
                </span>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#FFFFFF",
                  }}
                >
                  {hunt.cluesCount}
                </span>
              </div>
            ) : null}

            {hunt.playerCount ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: "14px 22px",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    fontWeight: 600,
                  }}
                >
                  Players
                </span>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#FFFFFF",
                  }}
                >
                  {hunt.playerCount}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: cover image or branded placeholder */}
        <div
          style={{
            width: 380,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 40px 40px 0",
            flexShrink: 0,
          }}
        >
          {coverImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageSrc}
              alt={title}
              style={{
                width: 340,
                height: 340,
                borderRadius: 24,
                objectFit: "cover",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          ) : (
            <div
              style={{
                width: 340,
                height: 340,
                borderRadius: 24,
                background:
                  "linear-gradient(135deg, #1E1040 0%, #2D1B69 50%, #1A2744 100%)",
                border: "1px solid rgba(139,92,246,0.3)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <div style={{ fontSize: 72 }}>🎯</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#C4B5FD",
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                Scavenger Hunt
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#64748B",
                  letterSpacing: 1,
                }}
              >
                hunty.app
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...SIZE },
  )
}
