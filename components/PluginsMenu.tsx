"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import PluginGlyph from "@/components/plugin-page/PluginGlyph"
import styles from "@/components/plugins-menu.module.css"
import { pluginList } from "@/lib/plugins"
import { PRICING } from "@/lib/products"
import { usePluginOwnership } from "@/lib/use-plugin-ownership"

/** The rows themselves, shared by the desktop panel and the mobile drawer.
 *  `menuRole` applies `role="menuitem"` / `role="separator"` to the rows —
 *  pass it only from a mount that has a `role="menu"` ancestor (the desktop
 *  panel). Those roles are meaningless, and confuse assistive tech, without
 *  such an owner, so the mobile drawer (a plain `<div>`, not a menu) omits it
 *  and renders plain links instead. */
export function PluginsMenuRows({ onNavigate, menuRole = false }: { onNavigate?: () => void; menuRole?: boolean }) {
  const { loading, error, owned, ownedCount } = usePluginOwnership()
  // Until ownership resolves these are plain navigation: no owned marks, and no
  // bundle row, because offering the bundle to an owner sells them what they have.
  const known = !loading && !error

  return (
    <>
      {pluginList().map((p) => {
        const isOwned = known && owned[p.id]
        return (
          <Link
            key={p.id}
            href={isOwned ? "/products" : p.href}
            className={`${styles.row} ${styles.link}`}
            role={menuRole ? "menuitem" : undefined}
            data-menu-row={p.id}
            style={{ ["--row-accent" as string]: p.accent }}
            onClick={onNavigate}
          >
            <PluginGlyph id={p.id} className={styles.rowGlyph} />
            <span className={styles.rowText}>
              <span className={styles.rowName}>{p.name}</span>
              <span className={styles.rowCategory}>{isOwned ? "owned — download" : p.category}</span>
            </span>
          </Link>
        )
      })}

      {known && ownedCount === 0 && (
        <>
          <span className={styles.divider} role={menuRole ? "separator" : undefined} />
          <Link
            href="/plugins#bundle"
            className={`${styles.bundleRow} ${styles.link}`}
            role={menuRole ? "menuitem" : undefined}
            data-menu-row="bundle"
            onClick={onNavigate}
          >
            <span className={styles.rowText}>
              <span className={styles.rowName}>all three</span>
              <span className={styles.rowCategory}>every plugin, one price</span>
            </span>
            <span className={styles.bundlePrice}>${PRICING.bundle.price}</span>
          </Link>
        </>
      )}
    </>
  )
}

const CLOSE_DELAY_MS = 120

/** Desktop nav trigger + floating panel. */
export default function PluginsMenu({ active, className = "" }: { active: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // When the panel was opened by hover (not focus), the trigger has no focus
  // yet, so Escape's own `triggerRef.current?.focus()` below fires a genuine
  // native focus event — which bubbles to the wrap's onFocus handler and
  // reopens the panel it just closed. This flag tells that handler "this next
  // focus event is Escape returning focus, not a user tabbing in — ignore it".
  const suppressFocusOpen = useRef(false)
  const pathname = usePathname()

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }
  // A short delay so the diagonal travel from trigger to panel does not dismiss it.
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }, [])

  // Close on route change — the panel must not survive navigation. Setting
  // state during render when a tracked value changes (React's own pattern for
  // "adjusting state when a prop changes": react.dev/learn/you-might-not-need-an-effect)
  // rather than in a useEffect keyed on pathname, which is what the
  // react-hooks/set-state-in-effect lint rule flags as an unnecessary
  // extra render pass for exactly this case.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpen(false)
  }
  useEffect(() => () => cancelClose(), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        suppressFocusOpen.current = true
        setOpen(false)
        triggerRef.current?.focus()
        // If the trigger already had focus (panel was opened via Tab, not
        // hover), .focus() above is a no-op and fires no new focus event, so
        // nothing would ever clear the flag — leaving it stuck true and
        // silently swallowing the *next* legitimate focus-open. Clear it a
        // tick later as a safety net: a real focus event, if one fires, does
        // so synchronously inside .focus() above and will already have
        // consumed and reset the flag by the time this runs.
        setTimeout(() => { suppressFocusOpen.current = false }, 0)
      }
    }
    const onClickAway = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClickAway)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClickAway)
    }
  }, [open])

  /** Arrow keys move between rows; Home/End jump to the ends. Must not run
   *  while the panel is closed: the rows still exist in the `hidden` subtree
   *  (querySelectorAll finds them regardless of visibility), so without this
   *  guard every Arrow/Home/End keypress on the trigger would preventDefault()
   *  the browser's native scroll and then silently fail to focus anything
   *  inside a `hidden` panel — freezing keyboard scrolling on the page. */
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    const rows = Array.from(
      wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    )
    if (rows.length === 0) return
    // -1 (nothing in the panel focused yet — the trigger itself is focused)
    // must be handled explicitly for both directions: the wrap-around formula
    // below only happens to land ArrowDown on the first row by coincidence,
    // and lands ArrowUp on the second-to-last row instead of the last.
    const i = rows.indexOf(document.activeElement as HTMLElement)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      rows[i === -1 ? 0 : (i + 1) % rows.length]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      rows[i === -1 ? rows.length - 1 : (i - 1 + rows.length) % rows.length]?.focus()
    } else if (e.key === "Home") { e.preventDefault(); rows[0]?.focus() }
    else if (e.key === "End") { e.preventDefault(); rows[rows.length - 1]?.focus() }
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={() => { cancelClose(); setOpen(true) }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        if (suppressFocusOpen.current) { suppressFocusOpen.current = false; return }
        cancelClose()
        setOpen(true)
      }}
      // Closes the panel once focus leaves the wrapper entirely (e.g. tabbing
      // past "Plugins" into whatever comes next). `relatedTarget` is the
      // element about to receive focus; when it's still inside the wrapper —
      // moving from the trigger to a row, or between rows — this must NOT
      // close the panel out from under that focus move.
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={onPanelKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        // "nav-link-active" (not a styles.* class) is the sitewide active-tab
        // treatment SiteNav's own Dig / My Crate / Plugins links use — reusing
        // it here, rather than inventing a bespoke active style, is what makes
        // the trigger's active state (cream colour + rust underline) match its
        // neighbours pixel-for-pixel instead of approximately.
        className={`${styles.trigger} ${className} ${active ? "nav-link-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="plugins-menu-panel"
        aria-current={active ? "page" : undefined}
        // Open, don't toggle: onFocus/onMouseEnter above already open the panel
        // on hover and keyboard focus, and in browsers where a mouse click also
        // focuses the button (Chromium, Firefox/Windows) that focus event fires
        // before this click — toggling here would immediately re-close a panel
        // that had just opened from the same click. Touch has no hover, so the
        // first tap still opens it (there is nothing to toggle away from).
        onClick={() => setOpen(true)}
        // Enter/Space need to be a real toggle — a screen-reader user hears
        // "expanded" and expects collapsing it back to work — but they can't
        // just flip `open` here: both keys also fire this same button's native
        // click after keydown, which would immediately undo the toggle via the
        // onClick above. preventDefault() on the keydown cancels that synthetic
        // click for keyboard activation (Enter *and* Space; the browser only
        // dispatches click as a *default action* here, not a separate event),
        // so this is the only place the toggle happens. Mouse/touch stay
        // open-only, which is what dodges the race explained above.
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        Plugins
      </button>

      <div
        id="plugins-menu-panel"
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="menu"
        aria-label="Plugins"
        data-plugins-menu
        hidden={!open}
      >
        <PluginsMenuRows onNavigate={() => setOpen(false)} menuRole />
      </div>
    </div>
  )
}
