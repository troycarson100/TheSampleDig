import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Does the signed-in user already own drft? Used by the landing/store pages to
// swap the Buy button for a Download link. Returns { owned: false } logged out.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ owned: false })
  }
  const purchase = await prisma.purchase.findUnique({
    where: { userId_product: { userId: session.user.id, product: "drft" } },
  })
  return NextResponse.json({ owned: Boolean(purchase) })
}
