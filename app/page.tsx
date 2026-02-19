import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import PrelaunchContent from "@/app/prelaunch/PrelaunchContent"

const AUTH_TIMEOUT_MS = 5000

export default async function HomePage() {
  const session = await Promise.race([
    auth(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)),
  ])
  if (session?.user) redirect("/dig")
  return <PrelaunchContent />
}
