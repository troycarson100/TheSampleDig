"use client"

interface AutoplayToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export default function AutoplayToggle({ enabled, onChange }: AutoplayToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-2 px-4 py-2 rounded-full transition"
      style={{ background: "transparent", color: "var(--foreground)" }}
      aria-label="Toggle autoplay"
    >
      <div className={`toggle-track relative w-12 h-6 rounded-full transition-colors ${enabled ? "opacity-100 checked" : "opacity-50"}`} style={{ background: enabled ? "var(--primary)" : "var(--muted)" }}>
        <div
          className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform bg-white shadow-sm ${
            enabled ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </div>
      <span className="toggle-label text-sm font-medium">
        Auto-Play
      </span>
    </button>
  )
}
