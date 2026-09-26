import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PLUGIN_ORDER, type PluginId } from "@/lib/plugins"

// Which plugins does the signed-in visitor own? One request for the whole range —
// the storefront needs all of them on every plugin page, and the per-plugin
// endpoints would mean one round trip each.
export async function GET() {
  const session = await auth()
  const owned = Object.fromEntries(PLUGIN_ORDER.map((id) => [id, false])) as Record<PluginId, boolean>

  if (!session?.user?.id) {
    return NextResponse.json({ signedIn: false, owned })
  }

  const purchases = await prisma.purchase.findMany({
    where: { userId: session.user.id, product: { in: [...PLUGIN_ORDER] } },
    select: { product: true },
  })
  // The Prisma WHERE above already restricts `product` to PLUGIN_ORDER, so
  // every row here is a known plugin id - no membership check needed.
  for (const p of purchases) {
    owned[p.product as PluginId] = true
  }

  return NextResponse.json({ signedIn: true, owned })
}
