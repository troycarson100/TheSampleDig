"use client"

import { useEffect, useState } from "react"
import BuyButton from "./BuyButton"
import PluginGlyph from "./PluginGlyph"
import { PLUGINS, type PluginId } from "@/lib/plugins"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"
import styles from "./plugin-page.module.css"

/** Appears once the hero has scrolled past, so the price is always reachable. */
export default function StickyBuy({ id }: { id: PluginId }) {
  const { loading, owned } = usePluginOwnership()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 640)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (loading || owned[id] || !shown) return null

  return (
    <div className={styles.sticky} data-sticky-buy>
      <span className={styles.stickyName}>
        <PluginGlyph id={id} /> {PLUGINS[id].name}
      </span>
      <BuyButton id={id} className={styles.stickyBtn} />
    </div>
  )
}
