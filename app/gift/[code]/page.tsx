import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import SiteNav from "@/components/SiteNav"
import PluginKeyCard from "@/components/PluginKeyCard"
import { findGiftLink, giftItems, holdsGift } from "@/lib/gift-link"
import { giftCookieName, giftPath, giftStatus, giftView, isGiftPlaceholderEmail } from "@/lib/gift-link-logic"
import { PLUGIN_GRANTS, asCompProduct } from "@/lib/plugin-products"
import { PLUGINS } from "@/lib/plugins"
import { ClaimButton, GiftEmailForm, PrivateLink } from "./GiftActions"

// A gift link: /gift/<code>. Whoever taps Claim first gets the plugins - keys
// and downloads right here, no account. See lib/gift-link.ts.
//
// The page itself never claims anything; only the button does (a POST), so a
// link preview fetching this URL changes nothing.

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "A gift from Sample Roll",
  robots: { index: false, follow: false },
  // The private link carries the claim token in its query string. Nothing on
  // this page may hand it to another site in a Referer header.
  referrer: "no-referrer",
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

const muted = { color: "var(--foreground)", opacity: 0.75 } as const
const card = { borderColor: "var(--border)" } as const
const primaryBtn = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold no-underline"
const primaryBtnStyle = { background: "var(--primary)", color: "var(--primary-foreground, #fff)" } as const

const SAVED_NOTICE: Record<string, string> = {
  merged: "Saved. The gift is on your Sample Roll account now - sign in to see it on My Products.",
  expired: "That save link has expired. Ask for a new email below and open it within a day.",
  retry: "That didn't save. Open the link in your email again.",
}

export default async function GiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ k?: string; saved?: string }>
}) {
  const { code } = await params
  const { k, saved } = await searchParams
  const row = await findGiftLink(code)

  const token = k || (row ? (await cookies()).get(giftCookieName(row.id))?.value : undefined)
  const view = row ? giftView(giftStatus(row), holdsGift(row, token)) : null
  const products = row ? PLUGIN_GRANTS[asCompProduct(row.product)] : []
  const names = products.join(" + ")
  const notice = saved ? SAVED_NOTICE[saved] : undefined

  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-xl mx-auto px-4 mt-[56px] pb-16 pt-8">
        {notice && (
          <p className="rounded-xl border px-4 py-3 mb-6 text-[14px]" style={{ ...card, color: "var(--foreground)" }}>
            {notice}
          </p>
        )}

        {!row || !view ? (
          <Plain title="We don't recognise that gift link">
            Check it was copied in full. If it still doesn&apos;t open, ask whoever sent it for a new one.
          </Plain>
        ) : view === "revoked" ? (
          <Plain title="This gift link has been cancelled">Ask whoever sent it for a new one.</Plain>
        ) : view === "expired" ? (
          <Plain title="This gift link has expired">Ask whoever sent it for a new one.</Plain>
        ) : view === "taken" ? (
          <Plain title="This gift has already been claimed">
            If that was you, open it on the device you claimed it on, or use the private link it gave
            you. Lost both? Ask whoever sent it - they can reopen it for you, with the same keys.
          </Plain>
        ) : view === "claim" ? (
          <>
            <p className="text-xs uppercase tracking-widest mb-2" style={muted}>
              A gift from Sample Roll
            </p>
            <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
              {names}, on us
            </h1>
            {row.message && (
              <p
                className="rounded-xl px-4 py-3 mb-6 text-[15px] whitespace-pre-line"
                style={{ background: "rgba(0,0,0,0.04)", color: "var(--foreground)" }}
              >
                {row.message}
              </p>
            )}
            <ul className="space-y-3 mb-8">
              {products.map((id) => {
                const p = PLUGINS[id]
                return (
                  <li key={id} className="flex items-center gap-4 rounded-xl border p-3" style={card}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.art.card} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
                    <div>
                      <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                        {p.name} <span className="font-normal text-[13px]" style={muted}>{p.category}</span>
                      </p>
                      <p className="text-[14px]" style={muted}>{p.tagline}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <ClaimButton code={code} />
            <p className="text-[13px] mt-3" style={muted}>
              No account needed. One tap and your licence {products.length === 1 ? "key" : "keys"} and
              downloads appear here. macOS and Windows; VST3, AU and standalone.
            </p>
          </>
        ) : (
          <Mine
            code={code}
            token={token!}
            products={names}
            items={await giftItems(row)}
            savedTo={row.redeemedByUser && !isGiftPlaceholderEmail(row.redeemedByUser.email) ? row.redeemedByUser.email : null}
            privateUrl={`${APP_URL}${giftPath(row.code)}?k=${encodeURIComponent(token!)}`}
          />
        )}
      </main>
    </div>
  )
}

function Plain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        {title}
      </h1>
      <p className="text-[15px] mb-6" style={muted}>
        {children}
      </p>
      <Link href="/" className="underline text-[14px]" style={muted}>
        Sample Roll home
      </Link>
    </>
  )
}

function Mine({
  code,
  token,
  products,
  items,
  savedTo,
  privateUrl,
}: {
  code: string
  token: string
  products: string
  items: Awaited<ReturnType<typeof giftItems>>
  savedTo: string | null
  privateUrl: string
}) {
  // Saved into an account that was already there: that account may hold more
  // than this gift, so its keys are shown only to whoever signs in to it.
  if (items.length === 0) {
    return (
      <Plain title="Your gift is on your account">
        {products} {savedTo ? <>is saved to <strong>{savedTo}</strong>. </> : null}Sign in to download it
        and see your keys on My Products.
      </Plain>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        Enjoy {products}
      </h1>
      <p className="text-[15px] mb-6" style={muted}>
        Download, install, and paste the key in the first time you open the plugin.
      </p>

      <div className="space-y-5">
        {items.map((item) => (
          <PluginKeyCard key={item.product} item={item} />
        ))}

        <section className="rounded-xl border p-5 sm:p-6" style={card}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            On your phone?
          </h2>
          <p className="text-[14px] mb-3" style={muted}>
            The plugins install on a Mac or PC. This is your private link to this page - open it on
            your computer, or keep it to come back to. Don&apos;t share it: it&apos;s your keys.
          </p>
          <PrivateLink url={privateUrl} />
        </section>

        <section className="rounded-xl border p-5 sm:p-6" style={card}>
          {savedTo ? (
            <>
              <p className="text-[15px] mb-3" style={{ color: "var(--foreground)" }}>
                Saved to <strong>{savedTo}</strong>. Sign in to manage your machines and re-download
                any time.
              </p>
              <Link href="/login?callbackUrl=%2Fproducts" className={primaryBtn} style={primaryBtnStyle}>
                Go to My Products
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                Email me these
              </h2>
              <p className="text-[14px] mb-3" style={muted}>
                Optional. We&apos;ll send your keys and downloads, with a link to keep them on a Sample
                Roll account. Nothing else - no newsletter.
              </p>
              <GiftEmailForm code={code} token={token} />
            </>
          )}
        </section>
      </div>
    </>
  )
}
