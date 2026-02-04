import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

// Lazy load prisma to avoid initialization issues
async function getPrisma() {
  const { prisma } = await import("./db")
  return prisma
}

export const authOptions: NextAuthOptions = {
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
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })

          if (!user) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
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
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
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
