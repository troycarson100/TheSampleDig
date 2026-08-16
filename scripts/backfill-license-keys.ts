/**
 * Mints licence keys for purchases that predate licensing.
 *
 *   npx tsx -r dotenv/config scripts/backfill-license-keys.ts              # dry run
 *   npx tsx -r dotenv/config scripts/backfill-license-keys.ts --commit
 *   npx tsx -r dotenv/config scripts/backfill-license-keys.ts --commit --email
 *
 * Idempotent: a purchase that already has a key is never touched, so this can
 * be re-run safely. Keys are minted and mailed as SEPARATE passes so a failing
 * mail server cannot leave a purchase keyless.
 */
import { prisma } from "../lib/db"
import { generateLicenseKey } from "../lib/license-key"
import { sendShftPurchaseEmail } from "../lib/email"

const commit = process.argv.includes("--commit")
const sendEmail = process.argv.includes("--email")

async function main() {
  const keyless = await prisma.purchase.findMany({
    where: { licenseKey: null },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  })

  console.log(`${keyless.length} purchase(s) without a licence key`)
  if (keyless.length === 0) return

  const minted: { email: string; key: string }[] = []

  for (const purchase of keyless) {
    const key = generateLicenseKey()
    console.log(`  ${purchase.product.padEnd(8)} ${purchase.user.email.padEnd(34)} ${key}`)
    if (commit) {
      await prisma.purchase.update({ where: { id: purchase.id }, data: { licenseKey: key } })
    }
    minted.push({ email: purchase.user.email, key })
  }

  if (!commit) {
    console.log("\nDRY RUN — nothing was written. Re-run with --commit.")
    return
  }
  console.log(`\nWrote ${minted.length} key(s).`)

  if (!sendEmail) {
    console.log("No mail sent. Re-run with --commit --email once the keys look right.")
    return
  }
  for (const m of minted) {
    try {
      await sendShftPurchaseEmail(m.email, m.key)
      console.log(`  mailed ${m.email}`)
    } catch (e) {
      // Keep going: the key is already saved and visible on /products, so a
      // failed mail is recoverable and must not abort the remaining sends.
      console.error(`  FAILED to mail ${m.email}:`, e)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
