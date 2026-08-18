import type { Metadata } from "next"
import { redirect } from "next/navigation"
import SiteNav from "@/components/SiteNav"
import RedeemForm from "@/components/comps/RedeemForm"
import { auth } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Redeem a code | Sample Roll",
  robots: { index: false, follow: false },
}

export default async function RedeemPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/redeem")
  }

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-md mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Redeem a code
        </h1>
        <p className="text-[15px] mb-8" style={{ color: "var(--foreground)", opacity: 0.75 }}>
          Got a comp code for shft? Enter it below - it will be added to {session.user.email}.
        </p>
        <RedeemForm />
      </main>
    </div>
  )
}
