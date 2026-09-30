import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { memberCodeFor } from "@/lib/member-offer"

// The member code a signed-in visitor's cart applies by itself (see
// lib/use-cart.ts). Only ever the visitor's own: looked up by the session's
// user id, never by anything the page sends. Nobody signed in, or no code,
// is the same empty answer.
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ offer: null }, { headers: { "Cache-Control": "no-store" } })
  const found = await memberCodeFor(userId).catch((e) => {
    console.error("[cart offer]", e)
    return null
  })
  return NextResponse.json(
    { offer: found ? { code: found.code, expiresAt: found.expiresAt.toISOString() } : null },
    { headers: { "Cache-Control": "no-store" } },
  )
}
