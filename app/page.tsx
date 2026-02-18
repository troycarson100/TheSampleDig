import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import PrelaunchContent from "@/app/prelaunch/PrelaunchContent"

export default async function HomePage() {
  const session = await auth()
  if (session?.user) redirect("/dig")
  return <PrelaunchContent />
}
