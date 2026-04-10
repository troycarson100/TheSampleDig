"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import TryProOfferingBlock from "@/components/pro/TryProOfferingBlock"
import styles from "./prelaunch.module.css"

const ROTATING_WORDS = ["SIMPLIFIED", "EASY", "FREE"]

function RotatingWord() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length)
    }, 3000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className={styles.bbWrap}>
      {/* Invisible widest word reserves width so no horizontal shift when rotating */}
      <span className={styles.bb} aria-hidden style={{ visibility: "hidden", display: "block" }}>
        SIMPLIFIED
      </span>
      {ROTATING_WORDS.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={styles.bb}
          style={{
            opacity: i === index ? 1 : 0,
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
            transition: "opacity 0.6s ease",
          }}
        >
          {word}
        </span>
      ))}
    </span>
  )
}

const TICKER_ITEMS = [
  "Jazz",
  "Soul",
  "Funk",
  "Disco",
  "Bossa Nova",
  "Rare Groove",
  "Psych",
  "Hip-Hop",
  "Latin",
  "Breaks",
  "Afrobeat",
  "Brazilian",
]

function useSignupCount() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    fetch("/api/prelaunch/signup")
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => setCount(0))
  }, [])
  return count
}

function HeroForm({
  onSuccess,
  count,
}: {
  onSuccess: () => void
  count: number | null
}) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [showSuccess, setShowSuccess] = useState(false)

  const submit = async () => {
    if (!email?.includes("@")) return
    setStatus("loading")
    setErrorMessage("")
    try {
      const res = await fetch("/api/prelaunch/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus("error")
        setErrorMessage(typeof data?.error === "string" ? data.error : "Something went wrong. Try again.")
        return
      }
      setStatus("success")
      setShowSuccess(true)
      onSuccess()
    } catch {
      setStatus("error")
      setErrorMessage("Something went wrong. Try again.")
    }
  }

  return (
    <>
      <div className={styles.signupBox}>
        {errorMessage ? (
          <p className={styles.signupNote} style={{ color: "var(--rust-l)", marginBottom: 12 }}>
            {errorMessage}
          </p>
        ) : null}
        {!showSuccess ? (
          <div className={styles.emailForm}>
            <input
              className={styles.emailInput}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={status === "loading"}
            />
            <button
              type="button"
              className={styles.emailSubmit}
              onClick={submit}
              disabled={status === "loading"}
            >
              {status === "loading" ? "..." : "Roll The Dice →"}
            </button>
          </div>
        ) : (
          <div className={`${styles.signupSuccess} ${styles.show}`}>
            <span className={styles.check}>✦</span>
            <div className={styles.msg}>You're on the list.</div>
            <div className={styles.sub}>We'll let you know the moment we launch.</div>
          </div>
        )}
        <div className={styles.signupNote}>No spam. Just one email when we launch.</div>
      </div>
      <div className={styles.socialProof}>
        <div className={styles.proofAvatars}>
          <div className={styles.proofAv}>🎧</div>
          <div className={styles.proofAv}>🎹</div>
          <div className={styles.proofAv}>🎷</div>
          <div className={styles.proofAv}>🥁</div>
          <div className={styles.proofAv}>🎸</div>
        </div>
        <div className={styles.proofText}>
          <strong>{count != null ? count.toLocaleString() : "—"}</strong> producers finding gems
        </div>
      </div>
    </>
  )
}

function FinalCtaForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [showSuccess, setShowSuccess] = useState(false)

  const submit = async () => {
    if (!email?.includes("@")) return
    setStatus("loading")
    setErrorMessage("")
    try {
      const res = await fetch("/api/prelaunch/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus("error")
        setErrorMessage(typeof data?.error === "string" ? data.error : "Something went wrong. Try again.")
        return
      }
      setStatus("success")
      setShowSuccess(true)
      onSuccess()
    } catch {
      setStatus("error")
      setErrorMessage("Something went wrong. Try again.")
    }
  }

  return (
    <>
      {errorMessage ? (
        <p className={styles.finalNote} style={{ color: "var(--rust)", marginBottom: 12 }}>
          {errorMessage}
        </p>
      ) : null}
      {!showSuccess ? (
        <div className={styles.emailFormLight}>
          <input
            className={styles.emailInputLight}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            disabled={status === "loading"}
          />
          <button
            type="button"
            className={styles.emailSubmitLight}
            onClick={submit}
            disabled={status === "loading"}
          >
            {status === "loading" ? "..." : "Notify Me →"}
          </button>
        </div>
      ) : (
        <div className={`${styles.signupSuccessLight} ${styles.show}`}>
          <span className={styles.check}>✦</span>
          <div className={styles.msg}>You're on the list.</div>
          <div className={styles.sub}>We'll let you know the moment we launch.</div>
        </div>
      )}
      <div className={styles.finalNote}>No spam, ever. Unsubscribe anytime.</div>
    </>
  )
}

export default function PrelaunchContent() {
  const count = useSignupCount()
  const revealRef = useRef<HTMLDivElement>(null)
  const [mockupVideoError, setMockupVideoError] = useState(false)

  useEffect(() => {
    const el = revealRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.on)
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    const nodes = el.querySelectorAll(`.${styles.reveal}`)
    nodes.forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const el = revealRef.current
    if (!el) return
    const heroReveals = el.querySelectorAll(`.${styles.hero} .${styles.reveal}`)
    heroReveals.forEach((node, i) => {
      const t = setTimeout(() => node.classList.add(styles.on), 100 + i * 140)
      return () => clearTimeout(t)
    })
  }, [])

  const displayCount = count

  return (
    <div ref={revealRef} className={styles.wrap}>
      <Link href="/login" className={styles.landingSignIn} aria-label="Sign in">
        Sign in
      </Link>
      <section className={styles.hero}>
        <div className={styles.heroVinyl} aria-hidden />
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroGlow2} aria-hidden />
        <div className={styles.heroLines} aria-hidden />

        <div className={`${styles.heroLogo} ${styles.reveal}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/SampleRoll-text.svg"
            alt="Sample Roll"
            width={1384}
            height={279}
            className="h-8 w-auto object-contain"
            style={{ height: 32, width: "auto" }}
          />
        </div>

        {/* Coming soon — commented out (landing page, product is live and free)
        <div className={`${styles.heroEyebrow} ${styles.reveal} ${styles.d1}`}>
          Coming Soon
        </div>
        */}

        <h1 className={`${styles.heroH1} ${styles.reveal} ${styles.d2}`}>
          <span className={styles.heroH1Top}>Sample digging</span>
          <RotatingWord />
        </h1>

        <p className={`${styles.heroSub} ${styles.reveal} ${styles.d3}`}>
          YouTube's infinite record collection, at your fingertips.
          <br />
          Roll the dice. Save gold. Make music.
        </p>

        <div className={`${styles.reveal} ${styles.d4}`}>
          <div className={styles.signupBox}>
            <Link href="/register" className={styles.heroCtaButton}>
              Roll The Dice →
            </Link>
          </div>
          <div className={styles.socialProof}>
            <div className={styles.proofAvatars}>
              <div className={styles.proofAv}>🎧</div>
              <div className={styles.proofAv}>🎹</div>
              <div className={styles.proofAv}>🎷</div>
              <div className={styles.proofAv}>🥁</div>
              <div className={styles.proofAv}>🎸</div>
            </div>
            <div className={styles.proofText}>
              <strong>{displayCount != null ? displayCount.toLocaleString() : "—"}</strong> producers finding gems
            </div>
          </div>
        </div>

      </section>

      <div className={styles.ticker} aria-hidden>
        <div className={styles.tickerT}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((label, i) => (
            <span key={i} className={styles.tickerItem}>
              {label} <span className={styles.td}>✦</span>
            </span>
          ))}
        </div>
      </div>

      <section className={styles.features}>
        <div className={styles.previewIn}>
          <div className={`${styles.secEy} ${styles.reveal}`}>Sneak Peek</div>
          <h2 className={`${styles.previewH} ${styles.reveal} ${styles.d1}`}>
            A tool that <em>thinks</em> like a producer
          </h2>
          <p className={`${styles.previewSub} ${styles.reveal} ${styles.d2}`}>
            Obsessively crafted for producers, beat-makers & crate diggers.
          </p>
          <div className={`${styles.mockupFrame} ${styles.reveal} ${styles.d3}`}>
            <div className={styles.mockupBar}>
              <div className={styles.mockupDot} />
              <div className={styles.mockupDot} />
              <div className={styles.mockupDot} />
              <span className={styles.mockupUrl}>sampleroll.com/dig</span>
            </div>
            <div className={styles.mockupBody}>
              <div className={styles.mockDigVideoWrap}>
                {mockupVideoError ? (
                  <div className={styles.mockDigVideoPlaceholder} aria-hidden>
                    <span>Dig preview</span>
                  </div>
                ) : (
                  <video
                    key="prelaunch-video"
                    src={
                      typeof process.env.NEXT_PUBLIC_PRELAUNCH_VIDEO_URL === "string" && process.env.NEXT_PUBLIC_PRELAUNCH_VIDEO_URL
                        ? process.env.NEXT_PUBLIC_PRELAUNCH_VIDEO_URL
                        : "/prelaunch/previewvid.mp4"
                    }
                    className={styles.mockDigVideo}
                    loop
                    muted
                    autoPlay
                    playsInline
                    aria-label="Sample Roll Dig page preview"
                    onError={() => setMockupVideoError(true)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.preview} aria-labelledby="about-try-pro-title">
        <div className="w-full max-w-[960px] mx-auto px-2 sm:px-4">
          <TryProOfferingBlock headingTag="h2" headingId="about-try-pro-title" />
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalIn}>
          <div
            className={`${styles.secEy} ${styles.reveal}`}
            style={{ color: "var(--rust)" }}
          >
            Find Samples Today
          </div>
          <h2 className={`${styles.finalH} ${styles.reveal} ${styles.d1}`}>
            The <em>crate</em>
            <br />
            is open.
          </h2>
          <p className={`${styles.finalSub} ${styles.reveal} ${styles.d2}`}>
            It&apos;s free. No credit card. Just dig in.
          </p>

          <div className={`${styles.reveal} ${styles.d3}`}>
            <Link
              href="/register"
              className={styles.finalCtaButton}
            >
              Start free →
            </Link>
          </div>

          <div className={`${styles.orn} ${styles.reveal} ${styles.d4}`}>
            <div className={styles.ornL} />
            <div className={styles.ornD} />
            <div className={styles.ornL} />
          </div>
        </div>
      </section>

      <footer className={styles.prelaunchFooter}>
        <div className={styles.fLogoWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/SampleRoll-logo-white-long.svg"
            alt="Sample Roll"
            width={160}
            height={26}
            style={{ height: 16, width: "auto", opacity: 1 }}
          />
        </div>
        <div className={styles.fCopy}>
          © {new Date().getFullYear()} Sample Roll · All rights reserved
        </div>
        <ul className={styles.fLinks}>
          <li>
            <Link href="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/terms">Terms and Conditions</Link>
          </li>
          <li>
            <a href="mailto:hello@sampleroll.com">Contact</a>
          </li>
        </ul>
      </footer>
    </div>
  )
}
