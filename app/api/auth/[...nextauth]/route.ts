import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { handlers } = NextAuth(authOptions as any)

export const { GET, POST } = handlers
