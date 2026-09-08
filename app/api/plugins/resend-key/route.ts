import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendPluginPurchaseEmail } from "@/lib/email"
import { isPluginProduct } from "@/lib/plugin-products"
import { SlidingWindowLimiter } from "@/lib/resend-rate-limit"
import { mintSetPasswordUrl } from "@/lib/set-password"

// Re-sends the purchase receipt (keys, download links, how to get onto the
// account) to an address. No sign-in - this is the fallback for a buyer whose
// receipt went to spam and who never set a password.
//
// The response is the same whether or not the address is known, so it cannot
// be used to enumerate accounts. Limited per address and per client IP.
const HOUR = 60 * 60 * 1000
const perEmail = new SlidingWindowLimiter(3, HOUR)
const perIp = new SlidingWindowLimiter(10, HOUR)

export async function POST(request: Request) {
  let body: { email?: unknown }
  try {
    body = (await request.json()) ?? {}
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Enter the email you bought with." }, { status: 400 })
  }

  // DigitalOcean App Platform puts its own ingress address in x-forwarded-for
  // and exposes the real client in do-connecting-ip; locally there is neither.
  const ip =
    request.headers.get("do-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  if (!perIp.allow(ip) || !perEmail.allow(email)) {
    return NextResponse.json({ error: "Too many requests. Try again in an hour." }, { status: 429 })
  }

  const ok = NextResponse.json({ ok: true })
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        passwordSetAt: true,
        purchases: { select: { product: true, licenseKey: true } },
      },
    })
    if (!user) return ok

    const items = user.purchases
      .filter((p): p is { product: "shft" | "drft"; licenseKey: string | null } => isPluginProduct(p.product))
      .map((p) => ({ product: p.product, licenseKey: p.licenseKey }))
    if (items.length === 0) return ok

    const setPasswordUrl = user.passwordSetAt === null ? await mintSetPasswordUrl(user.id) : null
    await sendPluginPurchaseEmail(user.email, items, { setPasswordUrl })
  } catch (e) {
    console.error("[resend key]", e)
  }
  return ok
}
