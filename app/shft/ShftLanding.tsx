"use client"

import { useEffect, useState, type ReactNode } from "react"
import styles from "./shft.module.css"

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
function IconWow() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12c2 0 2-5 4-5s2 10 4 10 2-10 4-10 2 5 4 5" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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
  { icon: <IconWow />, title: "Wow / flutter", desc: "Optional tape wobble smears pitch and time just enough to make the whole thing breathe." },
  { icon: <IconClock />, title: "Phase-locked", desc: "The clock is derived per-sample from your host, so the gate never drifts on loops or jumps." },
  { icon: <IconDice />, title: "Snapshots & random", desc: "Eight instant snapshots and a one-click randomizer for happy accidents on demand." },
]

const BLOCKS: { title: string; desc: string; img: string; alt: string; video?: string; poster?: string }[] = [
  {
    title: "Sixteen steps, endless feel",
    desc: "A host-locked step grid chops your audio in time. Each step is its own little shape — not just a dot — so you sculpt rhythm and dynamics in a single move. Click to toggle, drag to morph, drag sideways to ratchet.",
    img: "/shft/steps.png",
    video: "/shft/steps-v2.mp4",
    poster: "/shft/steps-poster.jpg",
    alt: "shft 16-step strip with per-step shapes",
  },
  {
    title: "Six shapes, endless morph",
    desc: "The gate envelope morphs continuously through swell, pluck, pulse, ramp and triangle — no stepping in between. Each step holds its own shape, so every hit can breathe a little differently.",
    img: "/shft/shape.png",
    alt: "shft morphable gate shape display",
  },
  {
    title: "A finishing chain, built in",
    desc: "Straight after the gate: a gated plate reverb with pitch-shift shimmer, a tempo-synced ping-pong delay, a compressor, and heat saturation. Everything you need to print the sound without leaving the plugin.",
    img: "/shft/fx.png",
    alt: "shft FX page — reverb, delay, compressor, heat",
  },
  {
    title: "Always in motion",
    desc: "Route four tempo-synced LFOs to any knob and let the patch evolve on its own — no automation lanes, no tedium. Mod rings on every control show exactly what's moving, live.",
    img: "/shft/lfo.png",
    alt: "shft LFO page — four modulators",
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is shft?",
    a: "shft is a tempo-synced rhythmic gate — a trance-gate. A 16-step sequencer chops your incoming audio and fires a morphable per-step shape that drives a gate and a resonant filter, turning pads, chords, vocals or drums into a moving, rhythmic part.",
  },
  {
    q: "Which formats does it come in, and will it work in my DAW?",
    a: "shft ships as VST3, AU, and Standalone. At launch it's macOS-only (Apple Silicon and Intel), so it runs in Mac DAWs like Ableton Live, Logic Pro, FL Studio, Bitwig, Studio One and more. Windows is planned after launch.",
  },
  {
    q: "Is it a subscription?",
    a: "No. shft is a one-time purchase with free updates — buy it once, keep it forever. The $19 launch price is a limited discount off the regular $39.",
  },
  {
    q: "How does the waitlist work?",
    a: "Drop your email and we'll send you one message the day shft launches, with the launch price locked in. No spam, and you can ignore it if the timing's not right.",
  },
]

async function startCheckout(): Promise<string | null> {
  try {
    const res = await fetch("/api/shft/checkout", { method: "POST" })
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return data.url
  } catch {
    /* fall through to null */
  }
  return null
}

/** Buy Now button — shows the struck price inline. Kicks off Stripe checkout;
    falls back to "Opens at launch" until STRIPE_SHFT_PRICE_ID is configured. */
function BuyButton({ className }: { className: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    const url = await startCheckout()
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
          Buy Now — <span className={styles.priceSale}>$19</span> <s>$39</s>
        </>
      )}
    </button>
  )
}

function PurchaseBanner() {
  const [state, setState] = useState<"none" | "success" | "canceled">("none")
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("purchase")
    if (p === "success") setState("success")
    else if (p === "canceled") setState("canceled")
  }, [])
  if (state === "none") return null
  return (
    <div className={state === "success" ? styles.bannerSuccess : styles.bannerInfo}>
      {state === "success"
        ? "Payment complete — we'll email your download link and license shortly."
        : "Checkout canceled — no charge was made. Grab shft whenever you're ready."}
    </div>
  )
}

function StickyBar() {
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
        <BuyButton className={styles.stickyBtn} />
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
  return (
    <>
      <PurchaseBanner />
      <StickyBar />

      {/* ---- Hero: full-bleed looping video + name + CTA ------------------ */}
      <section className={styles.hero}>
        <video
          className={styles.heroMediaLayer}
          poster="/shft/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src="/shft/hero.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroLogoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.heroLogo} src="/shft/shft-logo.png" alt="shft" />
          </h1>
          <p className={styles.heroSubtitle}>Gated Multi-FX</p>
          <div className={styles.heroCtaRow}>
            <BuyButton className={styles.pillLight} />
            <p className={styles.heroPrice}>One-time purchase · macOS Only · VST3 / AU / Standalone</p>
          </div>
        </div>
      </section>
      {/* Out of hero flow so it doesn't affect the hero's vertical centering.
          Sits at the hero/intro boundary — sticky bar shows once it scrolls past. */}
      <span id="shft-hero-sentinel" aria-hidden />

      {/* ---- Intro -------------------------------------------------------- */}
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Inside shft</p>
        <h2 className={styles.introTitle}>A step grid where every step draws a curve</h2>
        <p className={styles.introSub}>
          Think of a drum-machine grid, but each step is its own little envelope — a swell, a pluck,
          a pulse — opening and closing the gate in perfect time with your music.
        </p>
      </section>

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
          One-time purchase, free updates. The $19 launch price is a limited discount off $39.
        </p>
        <div className={styles.gsForm}>
          <BuyButton className={styles.pillDark} />
        </div>
      </section>
    </>
  )
}
