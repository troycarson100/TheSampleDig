import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token"
import UnsubscribeConfirm from "@/components/UnsubscribeConfirm"
import SiteNav from "@/components/SiteNav"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const userId = verifyUnsubscribeToken(token)
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    : null

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-lg mx-auto px-4 mt-[56px] py-16">
        {user && token ? (
          <UnsubscribeConfirm token={token} email={user.email} />
        ) : (
          <div>
            <h1 className="text-xl font-semibold mb-2">This link isn&apos;t valid</h1>
            <p className="text-sm opacity-70">
              It may have been truncated by your email client. You can turn update emails off in{" "}
              <a href="/settings" className="underline">
                Settings
              </a>
              , or reply to any of our emails and we&apos;ll do it for you.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
