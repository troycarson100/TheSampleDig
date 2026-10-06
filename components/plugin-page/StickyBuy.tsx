"use client"

import { useEffect, useState } from "react"
import BuyButton from "./BuyButton"
import PluginGlyph from "./PluginGlyph"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import styles from "./plugin-page.module.css"

/** Appears once the hero has scrolled past, so the price is always reachable -
    and steps aside again for the closing buy section and the footer, which it
    would otherwise sit on top of. */
export default function StickyBuy({ id }: { id: PluginId }) {
  const { loading, error, owned } = usePluginOwnership()
  const [shown, setShown] = useState(false)
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 640)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const targets = [document.getElementById(`${id}-buy`), document.querySelector("footer[role=contentinfo]")].filter(
      (el): el is Element => el !== null,
    )
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return
    const visible = new Set<Element>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target)
        else visible.delete(e.target)
      }
      setAtEnd(visible.size > 0)
    })
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [id])

  // Unknown ownership (loading, or the request failed) never gets a buy
  // control — this component has no reserved-height placeholder, so staying
  // hidden is what "inert" means here.
  if (loading || error || owned[id] || !shown || atEnd) return null

  return (
    <div className={styles.sticky} data-sticky-buy>
      <span className={styles.stickyName}>
        <PluginGlyph id={id} /> {PLUGINS[id].name}
      </span>
      <BuyButton id={id} className={styles.stickyBtn} />
    </div>
  )
}
