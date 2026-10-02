import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { generateCompCode } from "@/lib/comp-code"
import { parseExpiresAt } from "@/lib/comp-expiry"
import { giftPath, giftStatus, isGiftPlaceholderEmail } from "@/lib/gift-link-logic"
import { asCompProduct, isCompProduct } from "@/lib/plugin-products"

// Gift links, for the Gift links tab of /admin/comps. A gift link is a comp
// code of kind "link"; see lib/gift-link.ts.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
const MAX_NOTE_LEN = 200
const MAX_MESSAGE_LEN = 600

type Row = Awaited<ReturnType<typeof listRows>>[number]

function listRows() {
  return prisma.compCode.findMany({
    where: { kind: "link" },
    orderBy: { createdAt: "desc" },
    include: { redeemedByUser: { select: { email: true } } },
  })
}

function toGift(r: Row) {
  const email = r.redeemedByUser?.email ?? null
  return {
    id: r.id,
    url: `${APP_URL}${giftPath(r.code)}`,
    product: asCompProduct(r.product),
    note: r.note,
    message: r.message,
    status: giftStatus(r),
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    claimedAt: r.redeemedAt,
    // The address they saved it to, if they have. A gift still on its
    // placeholder account has none to show.
    savedTo: email && !isGiftPlaceholderEmail(email) ? email : null,
  }
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return NextResponse.json({ gifts: (await listRows()).map(toGift) })
}

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: { product?: unknown; note?: unknown; message?: unknown; expiresAt?: unknown }
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  // Explicit, never defaulted - as for comp codes, the costly mistake is
  // giving away the wrong plugin.
  if (!isCompProduct(body.product)) {
    return NextResponse.json({ error: "Pick what to give: shft, drft, fltr, or all three." }, { status: 400 })
  }
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

  const expiresAt = parseExpiresAt(body.expiresAt)
  if (!expiresAt.ok) return NextResponse.json({ error: expiresAt.error }, { status: 400 })

  const row = await prisma.compCode.create({
    data: {
      code: generateCompCode(),
      kind: "link",
      product: body.product,
      note: text(body.note, MAX_NOTE_LEN),
      message: text(body.message, MAX_MESSAGE_LEN),
      expiresAt: expiresAt.value,
      createdByEmail: session.user?.email ?? null,
    },
    include: { redeemedByUser: { select: { email: true } } },
  })
  return NextResponse.json({ gift: toGift(row) })
}
