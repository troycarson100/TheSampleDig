"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import styles from "./prelaunch.module.css"

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
              {status === "loading" ? "..." : "Notify Me →"}
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
          <strong>{count != null ? count.toLocaleString() : "—"}</strong> producers already
          waiting
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
  const [bumpCount, setBumpCount] = useState(0)
  const revealRef = useRef<HTMLDivElement>(null)

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

  const displayCount = count != null ? count + bumpCount : 0

  return (
    <div ref={revealRef} className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroVinyl} aria-hidden />
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroGlow2} aria-hidden />
        <div className={styles.heroLines} aria-hidden />

        <div className={`${styles.heroLogo} ${styles.reveal}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/SampleRoll-logo-white-long.svg"
            alt="Sample Roll"
            width={320}
            height={52}
            className="h-8 w-auto object-contain"
            style={{ height: 32, width: "auto" }}
          />
        </div>

        <div className={`${styles.heroEyebrow} ${styles.reveal} ${styles.d1}`}>
          Coming Soon
        </div>

        <h1 className={`${styles.heroH1} ${styles.reveal} ${styles.d2}`}>
          <em>The crate</em>
          <span className={styles.bb}>Never Ends</span>
        </h1>

        <p className={`${styles.heroSub} ${styles.reveal} ${styles.d3}`}>
          YouTube's infinite record collection, at your fingertips.
          <br />
          Roll the dice. Split stems. Save gold. Make music.
        </p>

        <div className={`${styles.reveal} ${styles.d4}`}>
          <HeroForm onSuccess={() => setBumpCount((c) => c + 1)} count={displayCount} />
        </div>

        <div className={`${styles.scrollHint} ${styles.reveal} ${styles.d6}`}>
          <span>See what&apos;s coming</span>
          <div className={styles.scrollArrow} />
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
        <div className={styles.featuresIn}>
          <div className={`${styles.featuresHead} ${styles.reveal}`}>
            <div className={styles.secEy}>What You&apos;ll Get</div>
            <h2 className={styles.secH}>
              Built for the <em>obsessed</em>
            </h2>
          </div>
          <div className={styles.featGrid}>
            <div className={`${styles.featCard} ${styles.reveal}`}>
              <div className={styles.featIcon}>⚄</div>
              <div className={styles.featTitle}>The Infinite Dig</div>
              <div className={styles.featDesc}>
                Roll the dice and land on rare grooves you&apos;ve never heard. YouTube
                becomes your limitless crate — filtered by genre, era, BPM and key.
              </div>
            </div>
            <div className={`${styles.featCard} ${styles.reveal} ${styles.d1}`}>
              <div className={styles.featIcon}>⊗</div>
              <div className={styles.featTitle}>Stem Splitter</div>
              <div className={styles.featDesc}>
                AI-powered separation pulls up to 13 individual instruments from any track.
                Isolate the drums. Flip a vocal. Sample just the keys.
              </div>
            </div>
            <div className={`${styles.featCard} ${styles.reveal} ${styles.d2}`}>
              <div className={styles.featIcon}>♥</div>
              <div className={styles.featTitle}>Your Personal Crate</div>
              <div className={styles.featDesc}>
                Save every sample you love. Auto-tagged by BPM, key, genre and era. Build a
                library of gold you&apos;ll never lose — export to any DAW.
              </div>
            </div>
            <div className={`${styles.featCard} ${styles.reveal} ${styles.d3}`}>
              <div className={styles.featIcon}>♪</div>
              <div className={styles.featTitle}>Chop Mode</div>
              <div className={styles.featDesc}>
                Map samples to your keyboard and chop in real time. Tap tempo, metronome
                overlay, and drum break mode for the serious digger.
              </div>
            </div>
            <div className={`${styles.featCard} ${styles.reveal} ${styles.d4}`}>
              <div className={styles.featIcon}>◎</div>
              <div className={styles.featTitle}>BPM & Key Detection</div>
              <div className={styles.featDesc}>
                Every track is automatically analysed. Know the tempo and musical key
                before you even start chopping. Match samples perfectly.
              </div>
            </div>
            <div className={`${styles.featCard} ${styles.reveal} ${styles.d5}`}>
              <div className={styles.featIcon}>⟐</div>
              <div className={styles.featTitle}>20+ Genre Filters</div>
              <div className={styles.featDesc}>
                Jazz, soul, funk, disco, bossa nova, rare groove, afrobeat, psych, Latin,
                breaks — dial into exactly the sound you&apos;re hunting for.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.preview}>
        <div className={styles.previewIn}>
          <div className={`${styles.secEy} ${styles.reveal}`}>Sneak Peek</div>
          <h2 className={`${styles.previewH} ${styles.reveal} ${styles.d1}`}>
            A tool that <em>thinks</em> like a digger
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
              <div className={styles.mockupGlow} />
              <div className={styles.mockPlayer}>
                <div className={styles.mockScreen}>
                  <div className={styles.mockVinyl} />
                </div>
                <div className={styles.mockInfo}>
                  <div>
                    <div className={styles.mockTrack}>Bill — Space Lady</div>
                    <div className={styles.mockMeta}>
                      Rare Samples · Disco · 1960s
                    </div>
                  </div>
                  <div className={styles.mockHeart}>♥</div>
                </div>
                <div className={styles.mockProgress}>
                  <div className={styles.mockProgressFill} />
                </div>
              </div>
              <div className={styles.mockSidebar}>
                <div className={styles.mockSidebarTitle}>MY SAMPLES</div>
                <div className={styles.mockSampleRow}>
                  <div
                    className={styles.mockThumb}
                    style={{
                      background: "linear-gradient(135deg,#1A2845,#0A1428)",
                    }}
                  />
                  <div>
                    <div className={styles.mockSampleName}>
                      Ken-Ichiro Isoda — マジエル
                    </div>
                    <div className={styles.mockSampleBpm}>96 BPM · Dm</div>
                  </div>
                </div>
                <div className={styles.mockSampleRow}>
                  <div
                    className={styles.mockThumb}
                    style={{
                      background: "linear-gradient(135deg,#141414,#0E0E0E)",
                    }}
                  />
                  <div>
                    <div className={styles.mockSampleName}>チコ本田 — 待っている</div>
                    <div className={styles.mockSampleBpm}>56 BPM · Bm</div>
                  </div>
                </div>
                <div className={styles.mockSampleRow}>
                  <div
                    className={styles.mockThumb}
                    style={{
                      background: "linear-gradient(135deg,#2A0A08,#1A0604)",
                    }}
                  />
                  <div>
                    <div className={styles.mockSampleName}>
                      Count Buffalos — Emergency
                    </div>
                    <div className={styles.mockSampleBpm}>117 BPM · Em</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalIn}>
          <div
            className={`${styles.secEy} ${styles.reveal}`}
            style={{ color: "var(--rust)" }}
          >
            Don&apos;t Miss It
          </div>
          <h2 className={`${styles.finalH} ${styles.reveal} ${styles.d1}`}>
            The <em>crate</em>
            <br />
            is almost open.
          </h2>
          <p className={`${styles.finalSub} ${styles.reveal} ${styles.d2}`}>
            Be the first to know when we launch.
            <br />
            One email. No spam. Just the drop date.
          </p>

          <div className={`${styles.reveal} ${styles.d3}`}>
            <FinalCtaForm onSuccess={() => {}} />
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
            style={{ height: 16, width: "auto", opacity: 0.7 }}
          />
        </div>
        <div className={styles.fCopy}>
          © {new Date().getFullYear()} Sample Roll · All rights reserved
        </div>
        <ul className={styles.fLinks}>
          <li>
            <Link href="/privacy">Privacy</Link>
          </li>
          <li>
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms
            </a>
          </li>
          <li>
            <a href="mailto:hello@sampleroll.com">Contact</a>
          </li>
        </ul>
      </footer>
    </div>
  )
}
