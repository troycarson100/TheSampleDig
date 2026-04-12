"use client"

/** Single square-style toggle (compact track + label) for use inside DigToggles. */
function SmallToggle({
  label,
  checked,
  onChange,
  ariaLabel,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 w-full rounded-md py-1.5 px-2 transition hover:opacity-90"
      style={{ background: "transparent", color: "var(--foreground)" }}
      aria-label={ariaLabel}
    >
      <div
        className="relative shrink-0 rounded transition-colors"
        style={{
          width: 32,
          height: 18,
          background: checked ? "var(--primary)" : "var(--muted)",
          opacity: checked ? 1 : 0.7,
        }}
      >
        <div
          className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-sm bg-white shadow-sm transition-transform"
          style={{
            transform: checked ? "translateX(14px)" : "translateX(0)",
          }}
        />
      </div>
      <span className="text-xs font-medium uppercase tracking-wider opacity-90">
        {label}
      </span>
    </button>
  )
}

export interface DigTogglesProps {
  autoplay: boolean
  onAutoplayChange: (v: boolean) => void
  drumBreak: boolean
  onDrumBreakChange: (v: boolean) => void
}

/** Stacked toggle box with square, smaller toggles for Auto-Play and Drum Break. */
export default function DigToggles({
  autoplay,
  onAutoplayChange,
  drumBreak,
  onDrumBreakChange,
}: DigTogglesProps) {
  return (
    <div
      className="flex flex-col rounded-lg border p-2 gap-0.5"
      style={{
        background: "var(--muted-light)",
        borderColor: "var(--border)",
      }}
    >
      <SmallToggle
        label="Auto-Play"
        checked={autoplay}
        onChange={onAutoplayChange}
        ariaLabel="Toggle autoplay"
      />
      <SmallToggle
        label="Drum Break"
        checked={drumBreak}
        onChange={onDrumBreakChange}
        ariaLabel="Toggle drum break mode"
      />
    </div>
  )
}
