/**
 * Issues a licence by hand, for a buyer whose studio machine has no internet.
 *
 *   npx tsx scripts/issue-license.ts SHFT-XXXX-XXXX-XXXX M1A2B3C4D,W9F8E7D6C "Studio PC"
 *
 * Prints the blob to paste into
 *   <userApplicationData>/shft audio/shft/license.dat
 * and records the activation so the seat count on /products stays honest.
 *
 * This is the stand-in for the deferred self-service /activate page. The signed
 * format is identical either way, so nothing here is thrown away when that ships.
 */
import "./load-env" // must precede lib/db — see that file
import { prisma } from "../lib/db"
import { normalizeLicenseKey } from "../lib/license-key"
import { decideSeat, validMachineIds, SEAT_LIMIT } from "../lib/license-activation"
import { signLicense, loadSigningKey, todayIssued } from "../lib/license-sign"

async function main() {
  const [rawKey, rawIds, machineName] = process.argv.slice(2)
  if (!rawKey || !rawIds) {
    console.error("usage: issue-license.ts <key> <machineId,machineId,…> [machine name]")
    process.exitCode = 1
    return
  }

  const key = normalizeLicenseKey(rawKey)
  if (!key) throw new Error(`not a valid licence key: ${rawKey}`)

  const machineIds = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (!validMachineIds(machineIds)) throw new Error(`not a valid machine id set: ${rawIds}`)

  const purchase = await prisma.purchase.findUnique({
    where: { licenseKey: key },
    include: { user: { select: { email: true } }, activations: true },
  })
  if (!purchase) throw new Error(`no purchase carries the key ${key}`)

  const decision = decideSeat(purchase.activations, machineIds)
  if (decision.action === "refuse") {
    throw new Error(
      `already active on ${decision.liveCount} of ${SEAT_LIMIT} machines — ` +
        `deactivate one on /products first`,
    )
  }

  // SIGN BEFORE PERSISTING — the first version of this script wrote the
  // activation and then threw on a missing signing key, which burned one of the
  // buyer's three seats and issued nothing. Found by running it.
  const license = signLicense(
    {
      v: 1,
      product: purchase.product,
      key,
      email: purchase.user.email,
      machines: machineIds,
      issued: todayIssued(),
    },
    loadSigningKey(),
  )

  const data = { machineIds, machineName: machineName ?? null, platform: null }
  if (decision.action === "create") {
    await prisma.licenseActivation.create({ data: { purchaseId: purchase.id, ...data } })
  } else {
    await prisma.licenseActivation.update({
      where: { id: decision.id },
      data: { ...data, deactivatedAt: null },
    })
  }

  console.log(`\n${purchase.user.email} — ${decision.action}\n`)
  console.log(license)
  console.log()
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
