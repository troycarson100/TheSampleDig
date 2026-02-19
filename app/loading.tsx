export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--theme-bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--theme-fg)] border-t-transparent" />
        <p className="text-sm text-[var(--theme-fg)] opacity-80">Loading…</p>
      </div>
    </div>
  )
}
