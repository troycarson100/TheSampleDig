"use client"

import { useEffect, useState, type ReactNode } from "react"
import styles from "./shft.module.css"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"
import TestimonialMarquee from "./TestimonialMarquee"
import ReelCarousel from "./ReelCarousel"
import { TESTIMONIALS, REELS } from "./shft-social"

/* ---- capability icons (thin-line, matching the plugin's minimal look) ---- */
function IconFilter() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 15h6l3-9 3 15 3-9h3" />
    </svg>
  )
}
function IconGrit() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12l3-7 3 14 3-18 3 18 3-14 3 7h2" />
    </svg>
  )
}
function IconSwing() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 18c4 0 4-12 8-12s4 12 8 12" />
      <circle cx="4" cy="18" r="1.4" fill="currentColor" />
      <circle cx="20" cy="18" r="1.4" fill="currentColor" />
    </svg>
  )
}
function IconGrain() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <circle cx="6" cy="7" r="1.15" />
      <circle cx="11.5" cy="5.5" r="1.15" />
      <circle cx="17" cy="8" r="1.15" />
      <circle cx="8" cy="12" r="1.15" />
      <circle cx="13.5" cy="11.5" r="1.15" />
      <circle cx="18.5" cy="14.5" r="1.15" />
      <circle cx="6.5" cy="17" r="1.15" />
      <circle cx="12" cy="18" r="1.15" />
    </svg>
  )
}
function IconChaos() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 3l-8 11h5l-1 7 8-11h-5z" />
    </svg>
  )
}
function IconDice() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </svg>
  )
}

const CAPS: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <IconFilter />, title: "Resonant filter", desc: "A multimode LP / BP / HP filter opens on every hit and can self-oscillate — plucky, vocal, alive." },
  { icon: <IconGrit />, title: "Grit & drive", desc: "Push resonance into saturation for anything from a gentle warmth to a snarling, broken edge." },
  { icon: <IconSwing />, title: "Swing & feel", desc: "Straight, triplet, or dotted — then push the pocket with swing for a human groove." },
  { icon: <IconGrain />, title: "Granular", desc: "Freeze a step into a granular cloud — pitch, scatter and grain size reshape one slice into shimmering texture or a wall of grit." },
  { icon: <IconChaos />, title: "Chaos", desc: "One knob of generative glitch that re-rolls every step, so fills, stutters and drop-outs never land the same way twice." },
  { icon: <IconDice />, title: "Snapshots & random", desc: "Eight instant snapshots and a one-click randomizer for happy accidents on demand." },
]

const BLOCKS: { title: string; desc: string; img: string; alt: string; video?: string; poster?: string }[] = [
  {
    title: "Sixteen steps, endless feel",
    desc: "A host-locked step grid chops your audio in time. Each step is its own little shape — not just a dot — so you sculpt rhythm and dynamics in a single move. Click to toggle, drag to morph, drag sideways to ratchet.",
    img: "/shft/steps.png",
    video: "/shft/steps-v3.mp4",
    poster: "/shft/steps-v3-poster.jpg",
    alt: "shft 16-step strip with per-step shapes",
  },
  {
    title: "Six shapes, endless morph",
    desc: "The gate envelope morphs continuously through swell, pluck, pulse, ramp and triangle — no stepping in between. Each step holds its own shape, so every hit can breathe a little differently.",
    img: "/shft/shape.png",
    alt: "shft morphable gate shape display",
  },
  {
    title: "Chop, reverse, granulate",
    desc: "Arm any step's repeat bar and it stutters in place — blue for tight forward rolls, red for reverse backspin fills, green for a granular cloud that smears the grain into texture. Dial pitch, scatter and grain size across the board, then add chaos for glitches that never land the same way twice.",
    img: "/shft/sc2.png",
    alt: "shft sequencer with colour-coded beat-repeat, reverse and granular steps",
  },
  {
    title: "A finishing chain, built in",
    desc: "Straight after the gate: a gated plate reverb with pitch-shift shimmer, a tempo-synced ping-pong delay that flips into a frequency-shifter echo, a compressor that swaps to 3-band OTT-style multiband, and heat saturation with ten drive models. Everything you need to print the sound without leaving the plugin.",
    img: "/shft/fxpage.png",
    alt: "shft FX page — OTT multiband comp, heat, frequency-shifter echo, gated reverb",
  },
  {
    title: "Modulation, in lanes",
    desc: "Four tempo-synced LFOs feed a lane-based mod matrix that routes any source to almost anything — filter, FX, pitch, auto-pan, chaos, even one LFO bending another's rate. Mod rings on every knob show exactly what's moving, live, so the patch evolves on its own.",
    img: "/shft/lfo.png",
    alt: "shft LFO page and modulation lanes with live mod rings",
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is shft?",
    a: "shft is a tempo-synced rhythmic gate — a trance-gate — grown into a full gated multi-FX. A 16-step sequencer chops your audio with a morphable per-step shape, resonant filter and per-step beat-repeat (forward, reverse or granular). Then a built-in chain — gated reverb, frequency-shifter echo, OTT multiband and heat — plus a lane-based mod matrix turn pads, chords, vocals or drums into a moving, evolving part.",
  },
  {
    q: "Which formats does it come in, and will it work in my DAW?",
    a: "shft runs on macOS (Apple Silicon and Intel) as VST3, AU, and Standalone, and on Windows as VST3 and Standalone — so it works in DAWs like Ableton Live, Logic Pro, FL Studio, Bitwig, Studio One and more.",
  },
  {
    q: "Is it a subscription?",
    a: "No. shft is a one-time purchase with free updates — buy it once, keep it forever. The $19 launch price is a limited discount off the regular $39.",
  },
]

async function startCheckout(): Promise<{ url: string | null; needsAuth: boolean; alreadyOwned: boolean }> {
  try {
    const res = await fetch("/api/shft/checkout", { method: "POST" })
    if (res.status === 401) return { url: null, needsAuth: true, alreadyOwned: false }
    if (res.status === 409) return { url: null, needsAuth: false, alreadyOwned: true }
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return { url: data.url, needsAuth: false, alreadyOwned: false }
  } catch {
    /* fall through */
  }
  return { url: null, needsAuth: false, alreadyOwned: false }
}

/** Buy Now button — shows the struck price inline. Kicks off Stripe checkout;
    sends logged-out users to sign in first, owners to their downloads, and falls
    back to "Opens at launch" until STRIPE_SHFT_PRICE_ID is configured. */
function BuyButton({ className, owned, crossgrade }: { className: string; owned: boolean; crossgrade: boolean }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // Already owns it → this is a download link, not a purchase.
  if (owned) {
    return (
      <a className={className} href="/products">
        You own shft — Download
      </a>
    )
  }

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    const { url, needsAuth, alreadyOwned } = await startCheckout()
    if (needsAuth) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/shft")}`
      return
    }
    if (alreadyOwned) {
      window.location.href = "/products"
      return
    }
    if (url) {
      window.location.href = url
      return
    }
    setFailed(true)
    setBusy(false)
  }

  return (
    <button type="button" className={className} onClick={buy} disabled={busy}>
      {busy ? (
        "…"
      ) : failed ? (
        "Opens at launch"
      ) : (
        <>
          Buy Now — <span className={styles.priceSale}>${crossgrade ? PRICING.crossgrade.price : PRICING.shft.price}</span>{" "}
          <s>${crossgrade ? PRICING.crossgrade.compareAt : PRICING.shft.msrp}</s>
        </>
      )}
    </button>
  )
}

function PurchaseBanner() {
  const [canceled, setCanceled] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get("purchase")
    if (p === "canceled") {
      setCanceled(true)
      return
    }
    if (p !== "success") return

    // Meta Pixel: shft purchase conversion ($19 launch price, or the crossgrade
    // price if `paid` is stamped on the success URL). Fired before the redirect
    // below — fbq beacons survive the navigation.
    const paid = Number(params.get("paid")) || PRICING.shft.price
    trackMeta("Purchase", { value: paid, currency: "USD", content_name: "shft", content_type: "product" })

    // On success, record the purchase (self-heals if the webhook is delayed),
    // then send them to My Products — no banner to fight the fixed nav.
    // replace() so the back button doesn't return to the success URL.
    const sessionId = params.get("session_id")
    if (!sessionId) {
      window.location.replace("/products")
      return
    }
    fetch("/api/shft/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => {
      window.location.replace("/products")
    })
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. Grab shft whenever you&apos;re ready.</div>
}

function StickyBar({ owned, crossgrade }: { owned: boolean; crossgrade: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const sentinel = document.getElementById("shft-hero-sentinel")
    if (!sentinel) return
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { rootMargin: "0px" })
    io.observe(sentinel)
    return () => io.disconnect()
  }, [])

  return (
    <div className={`${styles.stickyBar} ${show ? styles.stickyBarShow : ""}`} aria-hidden={!show}>
      <div className={styles.stickyInner}>
        <span className={styles.stickyName}>shft</span>
        <span className={styles.stickyMeta}>Trance-gate plugin</span>
        <span className={styles.stickySpacer} />
        <BuyButton className={styles.stickyBtn} owned={owned} crossgrade={crossgrade} />
      </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.faqItem} ${open ? styles.faqOpen : ""}`}>
      <button type="button" className={styles.faqQ} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {q}
        <span className={styles.faqPlus} aria-hidden>
          +
        </span>
      </button>
      <div className={styles.faqA}>
        <p className={styles.faqAInner}>{a}</p>
      </div>
    </div>
  )
}

export default function ShftLanding() {
  const [owned, setOwned] = useState(false)
  const [ownsDrft, setOwnsDrft] = useState(false)
  // Whether STRIPE_SHFT_CROSSGRADE_PRICE_ID is actually configured - the $15
  // price can only be shown (and charged) when this is true.
  const [shftCrossgrade, setShftCrossgrade] = useState(false)
  useEffect(() => {
    fetch("/api/shft/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.owned) setOwned(true)
        setShftCrossgrade(Boolean(d?.crossgrade))
      })
      .catch(() => {})
    fetch("/api/drft/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.owned) setOwnsDrft(true)
      })
      .catch(() => {})
  }, [])

  // The $15 display requires BOTH: the visitor owns drft, AND shft's crossgrade
  // price actually exists in Stripe. Never advertise a price checkout can't charge.
  const crossgradeOn = ownsDrft && shftCrossgrade

  return (
    <>
      <PurchaseBanner />
      <StickyBar owned={owned} crossgrade={crossgradeOn} />

      {/* ---- Hero: full-bleed looping video + name + CTA ------------------ */}
      <section className={styles.hero}>
        <video
          className={styles.heroMediaLayer}
          poster="/shft/hero-v2-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src="/shft/hero-v2.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroLogoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.heroLogo} src="/shft/shft-logo.png" alt="shft" />
          </h1>
          <p className={styles.heroSubtitle}>
            Gated Multi-FX
          </p>
          <div className={styles.heroCtaRow}>
            <BuyButton className={styles.pillLight} owned={owned} crossgrade={crossgradeOn} />
            <p className={styles.heroPrice}>One-time purchase · macOS &amp; Windows · VST3 / AU / Standalone</p>
          </div>
        </div>
      </section>
      {/* Out of hero flow so it doesn't affect the hero's vertical centering.
          Sits at the hero/intro boundary — sticky bar shows once it scrolls past. */}
      <span id="shft-hero-sentinel" aria-hidden />

      {/* ---- Intro -------------------------------------------------------- */}
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Inside shft</p>
        <h2 className={styles.introTitle}>Draw a curve on every step</h2>
        <p className={styles.introSub}>
          A grid where each step is a tiny envelope — swell, pluck, pulse. String them
          together and any sound turns rhythmic, perfectly in time.
        </p>
      </section>

      {/* ---- Made with shft (reels) --------------------------------------- */}
      <ReelCarousel reels={REELS} />

      {/* ---- Feedback (social proof) -------------------------------------- */}
      <TestimonialMarquee items={TESTIMONIALS} />

      {/* ---- Alternating feature blocks ----------------------------------- */}
      <div className={styles.blocks}>
        {BLOCKS.map((b, i) => (
          <section key={b.title} className={`${styles.block} ${i % 2 === 1 ? styles.blockAlt : ""}`}>
            <div className={styles.blockMedia}>
              <div className={styles.shotFrame}>
                {b.video ? (
                  <video
                    className={styles.shotImg}
                    src={b.video}
                    poster={b.poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={b.alt}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.shotImg} src={b.img} alt={b.alt} />
                )}
              </div>
            </div>
            <div>
              <h2 className={styles.blockTitle}>{b.title}</h2>
              <p className={styles.blockDesc}>{b.desc}</p>
            </div>
          </section>
        ))}
      </div>

      {/* ---- Capabilities ------------------------------------------------- */}
      <div className={styles.caps}>
        <div className={styles.capsHead}>
          <h2 className={styles.capsTitle}>More than a gate</h2>
        </div>
        <div className={styles.capsGrid}>
          {CAPS.map((c) => (
            <div key={c.title}>
              <div className={styles.capIcon}>{c.icon}</div>
              <p className={styles.capTitle}>{c.title}</p>
              <p className={styles.capDesc}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---- FAQ ---------------------------------------------------------- */}
      <div className={styles.faq}>
        <h2 className={styles.faqTitle}>Questions</h2>
        {FAQS.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>

      {/* ---- Get shft (final) --------------------------------------------- */}
      <section className={styles.getStarted} id="shft-buy">
        <h2 className={styles.gsTitle}>Get shft</h2>
        <p className={styles.gsSub}>
          {crossgradeOn ? (
            <>One-time purchase, free updates. You own drft, so shft is ${PRICING.crossgrade.price} - the same deal as the bundle.</>
          ) : (
            "One-time purchase, free updates. The $19 launch price is a limited discount off $39."
          )}
        </p>
        <div className={styles.gsForm}>
          <BuyButton className={styles.pillDark} owned={owned} crossgrade={crossgradeOn} />
        </div>
      </section>
    </>
  )
}
