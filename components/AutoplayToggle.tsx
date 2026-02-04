"use client"

interface AutoplayToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export default function AutoplayToggle({ enabled, onChange }: AutoplayToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-purple-500/30 rounded-lg hover:border-purple-500/50 transition"
      aria-label="Toggle autoplay"
    >
      <div className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-purple-600' : 'bg-gray-700'}`}>
        <div
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </div>
      <span className="text-white text-sm font-medium">
        Auto-Play {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}
