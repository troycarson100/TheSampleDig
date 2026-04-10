import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

// Lazy load prisma to avoid initialization issues
async function getPrisma() {
  const { prisma } = await import("./db")
  return prisma
}

/** Comma-separated emails that are treated as Pro on localhost only (NODE_ENV=development). Never used in production. */
function parseDevProEmails(): Set<string> {
  const raw = process.env.DEV_PRO_EMAILS ?? ""
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

async function refreshUserTokenFields(
  userId: string,
  email: string
): Promise<{ isPro: boolean; emailMarketingOptIn: boolean }> {
  const normalized = email.trim().toLowerCase()
  const prisma = await getPrisma()
  let subscriptionStatus: string | null | undefined
  let emailMarketingOptIn: boolean | undefined

  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, emailMarketingOptIn: true },
    })
    subscriptionStatus = row?.subscriptionStatus
    emailMarketingOptIn = row?.emailMarketingOptIn
  } catch {
    // DB not migrated yet (missing email_marketing_opt_in) — still allow sessions
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    })
    subscriptionStatus = row?.subscriptionStatus
    emailMarketingOptIn = true
  }

  /** Match Stripe subscription statuses that should unlock Pro (incl. trial and grace). */
  const isPro =
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing" ||
    subscriptionStatus === "past_due" ||
    subscriptionStatus === "paused"
  let isProResolved = isPro
  if (process.env.NODE_ENV === "development" && parseDevProEmails().has(normalized)) {
    isProResolved = true
  }
  return {
    isPro: isProResolved,
    emailMarketingOptIn: emailMarketingOptIn ?? true,
  }
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const prisma = await getPrisma()
          const email = String(credentials.email).trim().toLowerCase()
          // Explicit select so login works even if optional columns (e.g. email_marketing_opt_in) are missing before migrate.
          const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: {
              id: true,
              email: true,
              passwordHash: true,
              emailVerified: true,
              name: true,
            },
          })

          if (!user) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            String(credentials.password),
            user.passwordHash
          )

          if (!isPasswordValid) {
            return null
          }

          if (!user.emailVerified) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name || undefined,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/login",
    signOut: "/",
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      // Refresh Pro status on every request so JWT matches DB (subscription changes, first load after deploy).
      const uid = token.id != null ? String(token.id) : token.sub != null ? String(token.sub) : ""
      if (uid) {
        const fields = await refreshUserTokenFields(uid, String(token.email ?? ""))
        token.isPro = fields.isPro
        token.emailMarketingOptIn = fields.emailMarketingOptIn
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id
        session.user.isPro = token.isPro === true
        session.user.emailMarketingOptIn = token.emailMarketingOptIn !== false
      }
      return session
    },
  },
  // Support both AUTH_SECRET (v5) and NEXTAUTH_SECRET; required in production
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // Required when hosted behind a proxy (e.g. DigitalOcean App Platform)
  trustHost: true,
}

// Export auth function for NextAuth v5
// Create it lazily to avoid circular dependencies
let authInstance: Awaited<ReturnType<typeof import("next-auth").default>> | null = null

export async function auth() {
  try {
    if (!authInstance) {
      const NextAuth = (await import("next-auth")).default
      authInstance = NextAuth(authOptions)
    }
    const { auth: nextAuth } = authInstance
    return await nextAuth()
  } catch (error: unknown) {
    console.error("Auth failed (returning null):", error)
    return null
  }
}
