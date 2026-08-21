import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Does the signed-in user already own shft? Used by the landing page to swap the
// Buy button for a Download link. Returns { owned: false } for logged-out users.
export async function GET() {
  const session = await auth()
  // `crossgrade` reports whether the discounted price actually exists in Stripe -
  // the UI must never advertise a price the checkout route cannot actually charge.
  const crossgrade = Boolean(process.env.STRIPE_SHFT_CROSSGRADE_PRICE_ID)
  if (!session?.user?.id) {
    return NextResponse.json({ owned: false, crossgrade })
  }
  const purchase = await prisma.purchase.findUnique({
    where: { userId_product: { userId: session.user.id, product: "shft" } },
  })
  return NextResponse.json({ owned: Boolean(purchase), crossgrade })
}
