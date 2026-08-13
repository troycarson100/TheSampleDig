"use client"

export default function GeneratePage() {
  const enabled = process.env.NEXT_PUBLIC_GENERATOR_ENABLED === "true"

  if (!enabled) {
    return <div className="min-h-screen" style={{ backgroundColor: "#111110" }} aria-hidden />
  }

  return (
    <main
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-14"
      style={{
        fontFamily: "var(--font-generate-body), system-ui, sans-serif",
      }}
    >
      <header className="space-y-3">
        <h1
          className="generate-text text-3xl font-normal italic tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-generate-heading), Georgia, serif" }}
        >
          AI Sample Pack Generator
        </h1>
        <p className="generate-text-muted text-base leading-relaxed">Describe your sound. We&apos;ll build the pack.</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="button" className="generate-btn-outline rounded-lg px-4 py-2 text-sm font-medium">
            Outline action
          </button>
          <button type="button" className="generate-btn-filled rounded-lg px-4 py-2 text-sm font-medium">
            Primary action
          </button>
        </div>
      </header>

      <section aria-label="Pack configuration" className="generate-panel rounded-lg p-6">
        <h2 className="generate-text-muted mb-3 text-xs font-medium uppercase tracking-[0.16em]">
          Pack Config Form
        </h2>
        <div className="generate-card rounded-md p-8 text-center generate-text-muted text-sm">[Placeholder]</div>
      </section>

      <section aria-label="Generation progress" className="generate-panel rounded-lg p-6">
        <h2 className="generate-text-muted mb-3 text-xs font-medium uppercase tracking-[0.16em]">
          Generation Progress
        </h2>
        <div className="generate-card rounded-md p-8 text-center generate-text-muted text-sm">[Placeholder]</div>
      </section>

      <section aria-label="Download" className="generate-panel rounded-lg p-6">
        <h2 className="generate-text-muted mb-3 text-xs font-medium uppercase tracking-[0.16em]">
          Download Area
        </h2>
        <div className="generate-card rounded-md p-8 text-center generate-text-muted text-sm">[Placeholder]</div>
      </section>
    </main>
  )
}
