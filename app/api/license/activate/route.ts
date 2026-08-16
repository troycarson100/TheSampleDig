import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeLicenseKey } from "@/lib/license-key"
import { decideSeat, validMachineIds, SEAT_LIMIT } from "@/lib/license-activation"
import { signLicense, loadSigningKey, todayIssued, type LicensePayload } from "@/lib/license-sign"

// Public and key-authenticated on purpose: the plugin has no website session,
// and we decided no password would ever be typed into it. The key IS the secret.
export async function POST(request: Request) {
  let body: { key?: string; machineIds?: unknown; machineName?: string; platform?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 })
  }

  const key = normalizeLicenseKey(body.key ?? "")
  if (!key) {
    return NextResponse.json({ error: "That licence key doesn't look right." }, { status: 400 })
  }
  if (!validMachineIds(body.machineIds)) {
    return NextResponse.json({ error: "Missing machine identifiers." }, { status: 400 })
  }
  const machineIds = body.machineIds

  let signingKey: string
  try {
    signingKey = loadSigningKey()
  } catch {
    console.error("[license activate] LICENSE_SIGNING_PRIVATE_KEY is not configured")
    return NextResponse.json({ error: "Activation is unavailable." }, { status: 503 })
  }

  const purchase = await prisma.purchase.findUnique({
    where: { licenseKey: key },
    include: { user: { select: { email: true } }, activations: true },
  })
  if (!purchase) {
    return NextResponse.json({ error: "We don't recognise that licence key." }, { status: 404 })
  }

  const decision = decideSeat(purchase.activations, machineIds)
  if (decision.action === "refuse") {
    return NextResponse.json(
      {
        error: `This licence is active on ${decision.liveCount} machines, the maximum of ${SEAT_LIMIT}. Deactivate one at sampleroll.com/products and try again.`,
        reason: "seat_limit",
      },
      { status: 409 },
    )
  }

  const payload: LicensePayload = {
    v: 1,
    product: purchase.product,
    key,
    email: purchase.user.email,
    machines: machineIds,
    issued: todayIssued(),
  }

  // SIGN BEFORE PERSISTING. The payload needs nothing from the write, and doing
  // it the other way round means a malformed signing key consumes one of the
  // buyer's three seats and hands back a 500 — a seat spent on nothing, which
  // only support can undo. This ordering fails with the seat intact.
  let license: string
  try {
    license = signLicense(payload, signingKey)
  } catch (e) {
    console.error("[license activate] signing failed", e)
    return NextResponse.json({ error: "Activation is unavailable." }, { status: 503 })
  }

  const data = {
    machineIds,
    machineName: body.machineName?.slice(0, 80) || null,
    platform: body.platform?.slice(0, 16) || null,
  }

  if (decision.action === "create") {
    await prisma.licenseActivation.create({ data: { purchaseId: purchase.id, ...data } })
  } else {
    // reuse and revive differ only in whether a deactivation is being cleared.
    await prisma.licenseActivation.update({
      where: { id: decision.id },
      data: { ...data, deactivatedAt: null },
    })
  }

  return NextResponse.json({ license })
}
