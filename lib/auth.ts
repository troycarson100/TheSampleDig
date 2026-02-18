import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

// Lazy load prisma to avoid initialization issues
async function getPrisma() {
  const { prisma } = await import("./db")
  return prisma
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
          const email = String(credentials.email)
          const user = await prisma.user.findUnique({
            where: { email }
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
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id
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
  } catch (error: any) {
    console.error("Error in auth function:", error)
    throw error
  }
}
