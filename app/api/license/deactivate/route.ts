import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Session-authenticated: this is called from /products, by the owner, in a
// browser. Freeing a seat is the one thing a user must be able to do without
// emailing anybody, so it is deliberately unconditional.
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  let activationId: string | undefined
  try {
    activationId = (await request.json())?.activationId
  } catch {
    /* handled below */
  }
  if (!activationId || typeof activationId !== "string") {
    return NextResponse.json({ error: "Missing activation id." }, { status: 400 })
  }

  const activation = await prisma.licenseActivation.findUnique({
    where: { id: activationId },
    include: { purchase: { select: { userId: true } } },
  })
  // Same 404 for "does not exist" and "is not yours" — a different message
  // would let anyone probe which activation ids are real.
  if (!activation || activation.purchase.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  await prisma.licenseActivation.update({
    where: { id: activationId },
    data: { deactivatedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
