import { auth } from "@/lib/auth"
import { adminEmails } from "@/lib/admin-emails"

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase())
}

// Returns the session when the signed-in user is an admin, else null.
export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email || !isAdminEmail(session.user.email)) return null
  return session
}
