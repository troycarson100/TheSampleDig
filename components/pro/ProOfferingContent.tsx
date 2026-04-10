"use client"

import type { Session } from "next-auth"
import plStyles from "@/app/prelaunch/prelaunch.module.css"
import localStyles from "@/components/go-pro-modal.module.css"
import { PRO_FEATURE_CARDS } from "@/components/pro/ProOfferingShared"

export type ProOfferingContentProps = {
  session: Session | null
  status: "loading" | "authenticated" | "unauthenticated"
  loading: boolean
  error: string
  onCtaClick: () => void | Promise<void>
  /** Shown while checkout / navigation is in progress */
  loadingLabel?: string
  /** Primary heading level for SEO on /pro vs modal */
  headingTag?: "h1" | "h2"
  /** Accessible label id for heading (dialog on modal uses go-pro-modal-title) */
  headingId?: string
}

export default function ProOfferingContent({
  session,
  status,
  loading,
  error,
  onCtaClick,
  loadingLabel = "Redirecting…",
  headingTag = "h2",
  headingId = "go-pro-offering-title",
}: ProOfferingContentProps) {
  const HeadingTag = headingTag

  return (
    <div className={localStyles.goProShell}>
      <div className={localStyles.goProHeaderTop}>
        <HeadingTag id={headingId} className={`${plStyles.secH} ${localStyles.goProTitle}`}>
          Built for the <em>obsessed</em>
        </HeadingTag>
        <p className={localStyles.goProSub}>
          Full Sample Roll Pro — powerful tools for crate diggers and producers.
        </p>
      </div>

      <div className={`${plStyles.secEy} ${localStyles.goProSecEyTight}`}>What You&apos;ll Get</div>

      <div className={localStyles.goProFeatureRegion}>
        <div className={`${plStyles.featGrid} ${localStyles.goProGrid}`}>
          {PRO_FEATURE_CARDS.map((card, index) => (
            <div key={card.title} className={`${plStyles.featCard} ${localStyles.goProFeatCard} ${localStyles.goProCardCompact}`}>
              <div className={`${plStyles.featIcon} ${localStyles.goProIcon} ${localStyles.goProIconCompact}`}>{card.icon}</div>
              <div className={`${plStyles.featTitle} ${localStyles.goProTitleCompact}`}>{card.title}</div>
              <div className={`${plStyles.featDesc} ${localStyles.goProDescCompact}`}>{card.desc}</div>
              {index === 0 ? <p className={localStyles.goProAdsDisclaimer}>*Excluding YouTube ads.</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className={`flex flex-col items-center gap-2 max-w-lg mx-auto text-center ${localStyles.goProCtaBlock}`}>
        {session?.user?.isPro ? (
          <p className="text-sm" style={{ color: "rgba(240,235,225,0.55)", fontFamily: "var(--font-ibm-mono), monospace" }}>
            You already have Pro access.
          </p>
        ) : (
          <>
            {error ? (
              <p className="text-sm w-full" style={{ color: "#f87171", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void onCtaClick()}
              disabled={loading || status === "loading"}
              className="pro-gradient-btn pro-gradient-btn--block pro-gradient-btn--rounded w-full max-w-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm py-2.5"
            >
              {loading ? loadingLabel : "TRY PRO FREE"}
            </button>
            <p className={localStyles.goProCtaSubline}>Activate Pro 7 Day Trial. Then $5.99/month</p>
          </>
        )}
      </div>
    </div>
  )
}
