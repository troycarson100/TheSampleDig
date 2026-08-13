/**
 * Create or refresh a shared demo login (verified email, bcrypt password).
 * Run against the DB you want (local: .env; production: DATABASE_URL=... npx tsx ...).
 *
 *   npx tsx scripts/ensure-demo-user.ts
 *
 * Override defaults with DEMO_USER_EMAIL and DEMO_USER_PASSWORD.
 */

import { config } from "dotenv"
import { resolve } from "path"
import bcrypt from "bcryptjs"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { prisma } from "../lib/db"

const DEFAULT_EMAIL = "try@sampleroll.com"
const DEFAULT_PASSWORD = "12345"
const BCRYPT_ROUNDS = 12

async function main() {
  const email = (process.env.DEMO_USER_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase()
  const password = process.env.DEMO_USER_PASSWORD ?? DEFAULT_PASSWORD

  if (password.length < 1) {
    console.error("Password must be non-empty.")
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const now = new Date()

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        emailVerified: now,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })
    console.log(`Updated demo user: ${email}`)
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Demo",
        emailVerified: now,
        emailMarketingOptIn: false,
      },
    })
    console.log(`Created demo user: ${email}`)
  }

  console.log("Done. Share credentials only with trusted testers; rotate password if leaked.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
