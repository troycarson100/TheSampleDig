"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link2 } from "lucide-react"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { VizSlider } from "@/components/visualizer/VizSlider"
import {
  AUDIO_SOURCE_LABELS,
  type AudioSource,
  type Binding,
  createBinding,
  QUICK_BIND_SOURCES,
  sourceAccent,
} from "@/lib/visualizer/modulation/AudioReactiveBinding"

const POP_Z = 50001

type BindingEditorProps = {
  paramKey: string
  paramLabel: string
  bindings: Binding[]
  allBindings: Binding[]
  onBindingsChange: (next: Binding[]) => void
}

export function BindingEditor({
  paramKey,
  paramLabel,
  bindings,
  allBindings,
  onBindingsChange,
}: BindingEditorProps) {
  const [open, setOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const linkRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const quickRef = useRef<HTMLDivElement>(null)
  const [popPos, setPopPos] = useState({ top: 0, left: 0 })

  const mine = bindings.filter((b) => b.target === paramKey)
  const hasActive = mine.length > 0

  useEffect(() => setMounted(true), [])

  const placePopover = useCallback(() => {
    const el = linkRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = 280
    let left = r.left
    let top = r.bottom + 8
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8
    if (left < 8) left = 8
    const maxH = Math.min(420, window.innerHeight * 0.72)
    if (top + maxH > window.innerHeight - 8) top = Math.max(8, r.top - maxH - 8)
    setPopPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open && !quickOpen) return
    placePopover()
    const onScroll = () => placePopover()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [open, quickOpen, placePopover])

  useEffect(() => {
    if (!open && !quickOpen) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || quickRef.current?.contains(t) || linkRef.current?.contains(t))
        return
      setOpen(false)
      setQuickOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open, quickOpen])

  const replaceMine = (nextMine: Binding[]) => {
    const others = allBindings.filter((b) => b.target !== paramKey)
    onBindingsChange([...others, ...nextMine])
  }

  const addBinding = () => {
    replaceMine([
      ...mine,
      createBinding({
        source: "energy",
        target: paramKey,
        amount: 0.35,
        smoothing: 0.45,
        invert: false,
      }),
    ])
  }

  const updateBinding = (id: string, patch: Partial<Binding>) => {
    replaceMine(mine.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const removeBinding = (id: string) => {
    replaceMine(mine.filter((b) => b.id !== id))
  }

  const popover = (
    <div
      ref={popRef}
      className="fixed max-h-[min(72vh,420px)] w-[280px] overflow-y-auto rounded-lg border p-3 text-left shadow-xl"
      style={{
        zIndex: POP_Z,
        top: popPos.top,
        left: popPos.left,
        borderColor: `${VIZ_COLORS.gold}55`,
        backgroundColor: "#1E1610F2",
        color: VIZ_COLORS.cream,
      }}
    >
      <p className="mb-2 text-xs font-medium" style={{ color: VIZ_COLORS.goldLight }}>
        Modulate · {paramLabel}
      </p>
      {mine.length === 0 ? (
        <p className="mb-2 text-xs opacity-80">No bindings. Add one to drive this parameter from audio.</p>
      ) : (
        <ul className="space-y-3">
          {mine.map((b) => (
            <li
              key={b.id}
              className="rounded-md border p-2 text-xs"
              style={{ borderColor: `${sourceAccent(b.source)}44` }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="sr-only" htmlFor={`src-${b.id}`}>
                  Source
                </label>
                <select
                  id={`src-${b.id}`}
                  value={b.source}
                  onChange={(e) =>
                    updateBinding(b.id, { source: e.target.value as AudioSource })
                  }
                  className="max-w-[140px] flex-1 rounded border bg-transparent px-1 py-0.5"
                  style={{ borderColor: `${VIZ_COLORS.gold}44` }}
                >
                  {(Object.keys(AUDIO_SOURCE_LABELS) as AudioSource[]).map((k) => (
                    <option key={k} value={k}>
                      {AUDIO_SOURCE_LABELS[k]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="shrink-0 text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
                  onClick={() => removeBinding(b.id)}
                >
                  Remove
                </button>
              </div>
              <div className="mb-1">
                <span className="text-[10px] opacity-80">Amount</span>
                <VizSlider
                  min={0}
                  max={1}
                  step={0.01}
                  value={b.amount}
                  onChange={(e) => updateBinding(b.id, { amount: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <span className="text-[10px] opacity-80">Smoothing</span>
                <VizSlider
                  min={0}
                  max={1}
                  step={0.01}
                  value={b.smoothing}
                  onChange={(e) => updateBinding(b.id, { smoothing: parseFloat(e.target.value) })}
                />
              </div>
              <label className="mt-1 flex cursor-pointer items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={b.invert}
                  onChange={(e) => updateBinding(b.id, { invert: e.target.checked })}
                />
                Invert
              </label>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="mt-2 w-full rounded border py-1.5 text-xs font-medium"
        style={{ borderColor: `${VIZ_COLORS.gold}66`, color: VIZ_COLORS.goldLight }}
        onClick={addBinding}
      >
        + Add binding
      </button>
    </div>
  )

  const quickMenu =
    quickOpen &&
    mounted &&
    createPortal(
      <div
        ref={quickRef}
        className="fixed min-w-[160px] rounded-lg border py-1 text-sm shadow-xl"
        style={{
          zIndex: POP_Z + 1,
          top: popPos.top,
          left: popPos.left,
          borderColor: `${VIZ_COLORS.gold}55`,
          backgroundColor: "#1E1610F2",
          color: VIZ_COLORS.cream,
        }}
      >
        <p className="px-2 py-1 text-[10px] uppercase tracking-wide opacity-70">Quick bind</p>
        {QUICK_BIND_SOURCES.map((src) => (
          <button
            key={src}
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5"
            onClick={() => {
              replaceMine([
                ...mine,
                createBinding({
                  source: src,
                  target: paramKey,
                  amount: 0.35,
                  smoothing: 0.45,
                  invert: false,
                }),
              ])
              setQuickOpen(false)
            }}
          >
            {AUDIO_SOURCE_LABELS[src]}
          </button>
        ))}
      </div>,
      document.body
    )

  return (
    <>
      <button
        ref={linkRef}
        type="button"
        title="Audio bindings"
        aria-label={`Modulate ${paramLabel}`}
        aria-expanded={open}
        onClick={() => {
          setQuickOpen(false)
          setOpen((o) => !o)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setOpen(false)
          setQuickOpen((o) => !o)
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors"
        style={{
          borderColor: hasActive ? sourceAccent(mine[0]!.source) : `${VIZ_COLORS.gold}44`,
          backgroundColor: hasActive ? `${sourceAccent(mine[0]!.source)}22` : "transparent",
          color: VIZ_COLORS.goldLight,
        }}
      >
        <Link2 className="h-4 w-4" strokeWidth={2} />
      </button>
      {open && mounted && createPortal(popover, document.body)}
      {quickMenu}
    </>
  )
}
