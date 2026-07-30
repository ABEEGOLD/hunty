import { NextRequest, NextResponse } from "next/server"
import { withValidation } from "@/lib/api/withValidation"
import { withErrorHandling } from "@/lib/api/withErrorHandling"
import { pushTokenRegisterBodySchema, pushTokenDeleteBodySchema } from "@hunty/types/api-schemas"

interface PushTokenRecord {
  token: string
  walletAddress: string
  registeredAt: number
}

const tokensStore: PushTokenRecord[] = []

export const POST = withValidation(
  { body: pushTokenRegisterBodySchema },
  async (_request: NextRequest, _context, { body }) => {
    const { token, walletAddress } = body

    const existingIndex = tokensStore.findIndex(
      (t) => t.token === token || t.walletAddress === walletAddress
    )

    if (existingIndex !== -1) {
      tokensStore[existingIndex] = { token, walletAddress, registeredAt: Date.now() }
    } else {
      tokensStore.push({ token, walletAddress, registeredAt: Date.now() })
    }

    return NextResponse.json({ success: true })
  }
)

export const DELETE = withValidation(
  { body: pushTokenDeleteBodySchema },
  async (_request: NextRequest, _context, { body }) => {
    if (body.token) {
      const idx = tokensStore.findIndex((t) => t.token === body.token)
      if (idx !== -1) tokensStore.splice(idx, 1)
    } else if (body.walletAddress) {
      for (let i = tokensStore.length - 1; i >= 0; i--) {
        if (tokensStore[i].walletAddress === body.walletAddress) {
          tokensStore.splice(i, 1)
        }
      }
    }

    return NextResponse.json({ success: true })
  }
)

export const GET = withErrorHandling(async () => {
  return NextResponse.json({ tokens: tokensStore })
})
