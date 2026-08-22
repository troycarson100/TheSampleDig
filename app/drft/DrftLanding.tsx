"use client"

import { useEffect, useState, type ReactNode } from "react"
import styles from "./drft.module.css"
import { trackMeta } from "@/lib/meta-pixel"
import { PRICING } from "@/lib/products"

/* ---- capability icons (thin-line, matching the hardware look) ------------ */
function IconTape() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="8" cy="12" r="2.4" />
      <circle cx="16" cy="12" r="2.4" />
      <path d="M8 14.4h8" />
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
function IconPreset() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" />
      <circle cx="17" cy="17" r="1.4" fill="currentColor" />
    </svg>
  )
}
function IconMono() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12h4l2-6 3 12 3-9 2 3h4" />
    </svg>
  )
}
function IconSync() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4M7 9l3 2-3 2" />
    </svg>
  )
}
function IconAspect() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="10" rx="1.5" />
      <rect x="8.5" y="4" width="7" height="16" rx="1.5" />
    </svg>
  )
}

// Titles stay UPPERCASE — silk-screen style, like the labels on the chassis.
const CAPS: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <IconTape />, title: "TAPE SPEED", desc: "Slow the whole machine down. Pitch, picture and damage all follow, like a deck running on a dying motor." },
  { icon: <IconDice />, title: "DICE", desc: "One click re-rolls the character knobs into a new broken machine. Keep rolling until you find the one." },
  { icon: <IconPreset />, title: "PRESETS", desc: "A factory bank of broken machines, plus your own saves - user presets live in a plain folder on disk." },
  { icon: <IconMono />, title: "BASS MONO", desc: "All the wobble and smear stays up top - the low end folds to mono so the bottom never goes seasick." },
  { icon: <IconSync />, title: "VIDEO SYNC", desc: "The tube locks to your host transport, so the picture scrubs, loops and lands exactly with the session." },
  { icon: <IconAspect />, title: "ASPECT", desc: "16:9, vertical 9:16 for phones, or ultrawide - the tube reframes and the export follows it." },
]

const BLOCKS: { title: string; desc: string; img: string; alt: string; video?: string; poster?: string }[] = [
  {
    title: "A picture behind the sound",
    desc: "Drop a video, a GIF or a still onto the tube and it plays through the same circuit as your audio. Or go live: any camera your machine can see - a webcam, a capture card, or on a Mac your iPhone over Continuity Camera - point it at your hands, your desk, the room, and that becomes the picture.",
    img: "/drft/live.jpg",
    alt: "drft's CRT tube showing a live camera feed run through the effect",
  },
  {
    title: "Six knobs of character",
    desc: "BURN scorches it hot, DRIFT lets the tape wander and leaves a blurred echo smearing behind the picture, BEND warps and skews, DROPOUT punches holes in the take, WASH softens everything to mush, NOISE buries it in snow. Sound and picture ride the same knobs - turn one and you hear it and see it move together.",
    img: "/drft/knobs.png",
    alt: "drft character knobs - burn, drift, bend, dropout, wash, noise",
  },
  {
    title: "When it drops, it drops everywhere",
    desc: "Dropouts are wired straight across the machine: the instant one punches a hole in the audio, the picture tears with it. Not a visualizer guessing along - one event, heard and seen.",
    img: "/drft/drop.png",
    alt: "drft dropout tearing the picture and the audio together",
  },
  {
    title: "Twenty generators when you have no footage",
    desc: "The FIELD page makes its own picture: twenty generators - flow, plasma, tunnel, kaleido, aurora, caustic, cells and more - shaped by hue, zoom, glow and flow, with FOLLOW setting how hard they ride your audio. Then blend them: the BLEND fader luma-keys the generator against your video or your live camera, so your footage comes through the pattern instead of replacing it.",
    img: "/drft/generators.jpg",
    alt: "drft's field generator filling the tube with a moving colour field",
  },
  {
    title: "The picture plays the sound",
    desc: "feed reads the frame - how bright, how busy, how broken - and pushes it back into the audio. A hot white flash leans on the sound; a dead channel goes quiet. Run a music video through it and the mix starts breathing with the footage.",
    img: "/drft/nosignal.png",
    alt: "drft on a dead channel - snow filling the tube",
  },
  {
    title: "Press REC, keep the take",
    desc: "The REC key captures the tube and the sound together and writes a real MP4 - the export re-renders every frame through the same pipeline, so the file matches what you watched. Frame it 16:9, vertical 9:16 for phones and reels, or ultrawide, and cut circuit-bent music videos straight out of the plugin.",
    img: "/drft/drop.png",
    video: "/drft/rec.mp4",
    poster: "/drft/rec-poster.jpg",
    alt: "drft REC export - MP4 written from the plugin",
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is drft?",
    a: "drft is a VHS / CRT circuit-bend effect you put in your chain. Six character knobs - burn, drift, bend, dropout, wash, noise - run your audio through a dying tape machine, while a CRT on the panel shows the same damage on a picture: your video, a GIF, a live camera, or one of twenty built-in generators you can blend with your footage. Dropouts tear picture and sound together, feed lets the picture push back into the audio, and REC exports what you see and hear as a real MP4 in 16:9, 9:16 or ultrawide.",
  },
  {
    q: "Which formats does it come in, and will it work in my DAW?",
    a: "drft runs on macOS (Apple Silicon and Intel) as VST3, AU, and Standalone, and on Windows as VST3 and Standalone - so it works in DAWs like Ableton Live, Logic Pro, FL Studio, Bitwig, Studio One and more.",
  },
  {
    q: "Do I need to use video?",
    a: "No. drft is a full audio effect on its own. If you never load a thing, the FIELD page still generates its own picture from your audio - the tube is never empty. Load footage or a camera when you want your own image, and press REC when you want to keep it.",
  },
  {
    q: "Is it a subscription?",
    a: "No. drft is a one-time purchase with free updates - buy it once, keep it forever. The $19 launch price is a limited discount off the regular $39.",
  },
]

async function startCheckout(): Promise<{ url: string | null; needsAuth: boolean; alreadyOwned: boolean }> {
  try {
    const res = await fetch("/api/drft/checkout", { method: "POST" })
    if (res.status === 401) return { url: null, needsAuth: true, alreadyOwned: false }
    if (res.status === 409) return { url: null, needsAuth: false, alreadyOwned: true }
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data?.url === "string") return { url: data.url, needsAuth: false, alreadyOwned: false }
  } catch {
    /* fall through */
  }
  return { url: null, needsAuth: false, alreadyOwned: false }
}

/** Buy Now button. Shows the crossgrade price to shft owners (only once the
    crossgrade price actually exists in Stripe). Kicks off Stripe checkout;
    sends logged-out users to sign in first, owners to their downloads, and
    falls back to "Opens at launch" until the price env is set. */
function BuyButton({ className, owned, crossgrade }: { className: string; owned: boolean; crossgrade: boolean }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (owned) {
    return (
      <a className={className} href="/products">
        You own drft — Download
      </a>
    )
  }

  const buy = async () => {
    setBusy(true)
    setFailed(false)
    const { url, needsAuth, alreadyOwned } = await startCheckout()
    if (needsAuth) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/drft")}`
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

  const price = crossgrade ? PRICING.crossgrade.price : PRICING.drft.price
  const struck = crossgrade ? PRICING.crossgrade.compareAt : PRICING.drft.msrp

  return (
    <button type="button" className={className} onClick={buy} disabled={busy}>
      {busy ? (
        "…"
      ) : failed ? (
        "Opens at launch"
      ) : (
        <>
          Buy Now — <span className={styles.priceSale}>${price}</span> <s>${struck}</s>
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

    // Meta Pixel: value rides the ?paid= param the checkout route stamped on
    // the success URL (19 full / 15 crossgrade). Fired before the redirect —
    // fbq beacons survive the navigation.
    const paid = Number(params.get("paid")) || PRICING.drft.price
    trackMeta("Purchase", { value: paid, currency: "USD", content_name: "drft", content_type: "product" })

    const sessionId = params.get("session_id")
    if (!sessionId) {
      window.location.replace("/products")
      return
    }
    fetch("/api/drft/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => {
      window.location.replace("/products")
    })
  }, [])

  if (!canceled) return null
  return <div className={styles.bannerInfo}>Checkout canceled — no charge was made. Grab drft whenever you&apos;re ready.</div>
}

function StickyBar({ owned, crossgrade }: { owned: boolean; crossgrade: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const sentinel = document.getElementById("drft-hero-sentinel")
    if (!sentinel) return
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { rootMargin: "0px" })
    io.observe(sentinel)
    return () => io.disconnect()
  }, [])

  return (
    <div className={`${styles.stickyBar} ${show ? styles.stickyBarShow : ""}`} aria-hidden={!show}>
      <div className={styles.stickyInner}>
        <span className={styles.stickyName}>drft</span>
        <span className={styles.stickyMeta}>VHS / CRT circuit-bend FX</span>
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

export default function DrftLanding() {
  const [owned, setOwned] = useState(false)
  const [ownsShft, setOwnsShft] = useState(false)
  // Whether STRIPE_DRFT_CROSSGRADE_PRICE_ID is actually configured - the $15
  // price can only be shown (and charged) when this is true.
  const [drftCrossgrade, setDrftCrossgrade] = useState(false)
  useEffect(() => {
    fetch("/api/drft/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.owned) setOwned(true)
        setDrftCrossgrade(Boolean(d?.crossgrade))
      })
      .catch(() => {})
    fetch("/api/shft/ownership")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.owned) setOwnsShft(true)
      })
      .catch(() => {})
  }, [])

  // The $15 display requires BOTH: the visitor owns shft, AND drft's crossgrade
  // price actually exists in Stripe. Never advertise a price checkout can't charge.
  const crossgradeOn = ownsShft && drftCrossgrade

  // Same gating for the FAQ's crossgrade claim - append it only when the $15
  // price can actually be charged, so the copy never contradicts the button.
  const faqs = FAQS.map((f) =>
    f.q === "Is it a subscription?" && crossgradeOn
      ? { ...f, a: `${f.a} Already own shft? You get drft for $${PRICING.crossgrade.price}.` }
      : f
  )

  return (
    <>
      <PurchaseBanner />
      <StickyBar owned={owned} crossgrade={crossgradeOn} />

      {/* ---- Hero: full-bleed looping video + wordmark + CTA -------------- */}
      <section className={styles.hero}>
        <video
          className={styles.heroMediaLayer}
          poster="/drft/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src="/drft/hero.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroScanlines} aria-hidden />
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroLogoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.heroLogo} src="/drft/logo.png" alt="drft" />
          </h1>
          <p className={styles.heroSubtitle}>VHS / CRT circuit-bend FX</p>
          <div className={styles.heroCtaRow}>
            <BuyButton className={styles.pillLight} owned={owned} crossgrade={crossgradeOn} />
            <p className={styles.heroPrice}>One-time purchase - macOS &amp; Windows - VST3 / AU / Standalone</p>
          </div>
        </div>
      </section>
      {/* Out of hero flow so it doesn't affect the hero's vertical centering. */}
      <span id="drft-hero-sentinel" aria-hidden />

      {/* ---- Intro -------------------------------------------------------- */}
      <section className={styles.intro}>
        <p className={styles.eyebrow}>INSIDE DRFT</p>
        <h2 className={styles.introTitle}>A dying deck in your chain</h2>
        <p className={styles.introSub}>
          Tape wow, head burn, tracking wash, dropouts and snow - six knobs of damage
          on whatever you run through it, over a CRT that shows you every bit of what
          it does.
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
              <p className={styles.blockOsd} aria-hidden>{`TRK 0${i + 1}`}</p>
              <h2 className={styles.blockTitle}>{b.title}</h2>
              <p className={styles.blockDesc}>{b.desc}</p>
            </div>
          </section>
        ))}
      </div>

      {/* ---- Capabilities ------------------------------------------------- */}
      <div className={styles.caps}>
        <div className={styles.capsHead}>
          <h2 className={styles.capsTitle}>The rest of the chassis</h2>
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
        {faqs.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>

      {/* ---- Get drft (final) --------------------------------------------- */}
      <section className={styles.getStarted} id="drft-buy">
        <h2 className={styles.gsTitle}>Get drft</h2>
        <p className={styles.gsSub}>
          {crossgradeOn ? (
            <>One-time purchase, free updates. You own shft, so drft is ${PRICING.crossgrade.price} - the same deal as the bundle.</>
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
