import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getProduct } from "@/lib/products"
import { normalizeLicenseKey } from "@/lib/license-key"
import { getSignedDownloadUrl, isStorageConfigured } from "@/lib/spaces"

// Gated download for an owned product asset. Two credentials are accepted:
//
//   ?key=SHFT-XXXX-XXXX-XXXX   the licence key. This is what the receipt email
//                              and the thanks page link to, so a guest buyer
//                              with no website session can still install. The
//                              key already IS the secret (it activates the
//                              plugin), and it only unlocks its own product.
//   a signed-in session        for /products, as before.
//
// Either way the caller is 302'd to a short-lived signed storage URL.
//   GET /api/products/shft/download?asset=installer|installer-win|manual[&key=...]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ product: string }> },
) {
  const { product } = await params
  const def = getProduct(product)
  if (!def) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 })
  }

  const url = new URL(request.url)
  const rawKey = url.searchParams.get("key")
  if (rawKey !== null) {
    const key = normalizeLicenseKey(rawKey)
    const purchase = key
      ? await prisma.purchase.findUnique({ where: { licenseKey: key }, select: { product: true } })
      : null
    if (!purchase || purchase.product !== product) {
      return NextResponse.json({ error: "That licence key doesn't unlock this download." }, { status: 403 })
    }
  } else {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 })
    }
    const owns = await prisma.purchase.findUnique({
      where: { userId_product: { userId: session.user.id, product } },
    })
    if (!owns) {
      return NextResponse.json({ error: "You don't own this product." }, { status: 403 })
    }
  }

  const assetId = url.searchParams.get("asset") || "installer"
  const asset = def.assets.find((a) => a.id === assetId)
  if (!asset) {
    return NextResponse.json({ error: "Unknown asset." }, { status: 404 })
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "The download isn't available yet — hang tight." }, { status: 503 })
  }

  const signed = await getSignedDownloadUrl(asset.key, asset.filename, 300)
  return NextResponse.redirect(signed, 302)
}
