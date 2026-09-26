"use client"

import { Component, type ReactNode } from "react"

/**
 * Isolates a plugin landing page's content from the persistent chrome mounted
 * above it (see components/PluginChrome.tsx).
 *
 * A pre-existing bug — PRICING.crossgrade was removed from lib/products.ts but
 * app/plugins/PluginsStore.tsx, app/shft/ShftLanding.tsx and app/drft/DrftLanding.tsx
 * still read it — throws for a signed-out visitor shortly after mount, once the
 * legacy /api/{shft,drft}/ownership endpoints resolve with `crossgrade: true`.
 * Without this boundary that throw propagates to the nearest error boundary
 * (app/error.tsx), unmounting SiteNav and PluginChrome along with the broken
 * content — which defeats the point of a chrome meant to be on screen on every
 * plugin page. This is a stopgap until the later task that rewrites those
 * files lands; it can be removed once none of them reference PRICING.crossgrade.
 */
export default class PluginPageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("Plugin page content failed to render:", error)
  }

  render() {
    if (this.state.failed) {
      return (
        <div style={{ padding: "64px 16px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <p>Something went wrong loading this page. The plugin rail above still works.</p>
        </div>
      )
    }
    return this.props.children
  }
}
