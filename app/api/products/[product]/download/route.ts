import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getProduct } from "@/lib/products"
import { getSignedDownloadUrl, isStorageConfigured } from "@/lib/spaces"

// Gated download for an owned product asset. Verifies the logged-in user owns
// the product, then 302-redirects to a short-lived signed storage URL.
//   GET /api/products/shft/download?asset=installer|manual
export async function GET(
  request: Request,
  { params }: { params: Promise<{ product: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  const { product } = await params
  const def = getProduct(product)
  if (!def) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 })
  }

  const owns = await prisma.purchase.findUnique({
    where: { userId_product: { userId: session.user.id, product } },
  })
  if (!owns) {
    return NextResponse.json({ error: "You don't own this product." }, { status: 403 })
  }

  const assetId = new URL(request.url).searchParams.get("asset") || "installer"
  const asset = def.assets.find((a) => a.id === assetId)
  if (!asset) {
    return NextResponse.json({ error: "Unknown asset." }, { status: 404 })
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "The download isn't available yet — hang tight." }, { status: 503 })
  }

  const url = await getSignedDownloadUrl(asset.key, asset.filename, 300)
  return NextResponse.redirect(url, 302)
}
