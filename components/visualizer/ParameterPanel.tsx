"use client"

import { useVisualizerStudioStore } from "@/hooks/visualizer/useVisualizerStudioStore"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { VizSlider } from "@/components/visualizer/VizSlider"
import { BindingEditor } from "@/components/visualizer/BindingEditor"
import type { PreviewParamDef } from "@/lib/visualizer/previewTemplate"
import type { Binding } from "@/lib/visualizer/modulation/AudioReactiveBinding"

function formatParam(n: number, step: number): string {
  const p = step >= 0.05 ? 2 : step >= 0.01 ? 2 : 3
  return n.toFixed(p)
}

export function ParameterPanel() {
  const paramDefs = useVisualizerStudioStore((s) => s.paramDefs)
  const baseParams = useVisualizerStudioStore((s) => s.baseParams)
  const effectiveParams = useVisualizerStudioStore((s) => s.effectiveParams)
  const bindings = useVisualizerStudioStore((s) => s.bindings)
  const setBaseParam = useVisualizerStudioStore((s) => s.setBaseParam)
  const setBindings = useVisualizerStudioStore((s) => s.setBindings)
  const resetToTemplateDefaults = useVisualizerStudioStore((s) => s.resetToTemplateDefaults)

  const bindingCount = bindings.length

  return (
    <aside
      className="flex w-full max-w-sm flex-col rounded-lg border px-3 py-4 sm:max-w-md"
      style={{
        borderColor: `${VIZ_COLORS.gold}40`,
        backgroundColor: "#2A1F14AA",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-wide" style={{ color: VIZ_COLORS.goldLight }}>
          Look
        </h2>
        <button
          type="button"
          className="text-xs opacity-80 hover:opacity-100"
          style={{ color: VIZ_COLORS.cream }}
          onClick={() => resetToTemplateDefaults()}
        >
          Reset defaults
        </button>
      </div>

      <ul className="max-h-[min(70vh,520px)] space-y-4 overflow-y-auto pr-1">
        {paramDefs.map((def) => (
          <ParamRow
            key={def.key}
            def={def}
            baseValue={baseParams[def.key] ?? def.defaultValue}
            liveValue={effectiveParams[def.key] ?? baseParams[def.key] ?? def.defaultValue}
            bindings={bindings}
            onBindingsChange={setBindings}
            onBaseChange={(v) => setBaseParam(def.key, v)}
          />
        ))}
      </ul>

      <p className="mt-3 border-t pt-2 text-[10px] opacity-70" style={{ borderColor: `${VIZ_COLORS.gold}33`, color: VIZ_COLORS.warmGray }}>
        {bindingCount} audio binding{bindingCount === 1 ? "" : "s"}. Right-click the link icon for quick bind.
        Sliders set the base value; range shows min–max. Live output updates beside the arrow without moving the
        thumb.
      </p>
    </aside>
  )
}

function ParamRow({
  def,
  baseValue,
  liveValue,
  bindings,
  onBindingsChange,
  onBaseChange,
}: {
  def: PreviewParamDef
  baseValue: number
  liveValue: number
  bindings: Binding[]
  onBindingsChange: (b: Binding[]) => void
  onBaseChange: (v: number) => void
}) {
  const hasBindings = bindings.some((b) => b.target === def.key)

  return (
    <li>
      <div className="mb-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs font-medium" style={{ color: VIZ_COLORS.cream }}>
          {def.label}
        </span>
        <BindingEditor
          paramKey={def.key}
          paramLabel={def.label}
          bindings={bindings}
          allBindings={bindings}
          onBindingsChange={onBindingsChange}
        />
      </div>
      <div className="flex items-center gap-2 text-[10px] tabular-nums" style={{ color: VIZ_COLORS.warmGray }}>
        <span className="w-8 shrink-0 text-right">{formatParam(def.min, def.step)}</span>
        <VizSlider
          min={def.min}
          max={def.max}
          step={def.step}
          value={baseValue}
          onChange={(e) => onBaseChange(parseFloat(e.target.value))}
          className="min-w-0 flex-1"
          aria-label={`${def.label} base`}
        />
        <span className="w-8 shrink-0">{formatParam(def.max, def.step)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[10px]" style={{ color: VIZ_COLORS.warmGray }}>
        <span>
          Range {formatParam(def.min, def.step)}–{formatParam(def.max, def.step)}
        </span>
        <span style={{ color: VIZ_COLORS.cream }}>
          Base {formatParam(baseValue, def.step)}
          {hasBindings ? (
            <>
              {" "}
              → live{" "}
              <span style={{ color: VIZ_COLORS.goldLight }}>{formatParam(liveValue, def.step)}</span>
            </>
          ) : null}
        </span>
      </div>
    </li>
  )
}
