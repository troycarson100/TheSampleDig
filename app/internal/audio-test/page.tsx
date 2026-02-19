import { notFound } from "next/navigation"
import AudioTestClient from "./AudioTestClient"

export const dynamic = "force-dynamic"

/**
 * Secret page: test BPM/key analysis by uploading audio.
 * If AUDIO_TEST_SECRET is set, the URL must include ?secret=YOUR_SECRET (e.g. /internal/audio-test?secret=xxx).
 * Bookmark the full URL including the secret so you can return to it.
 */
export default async function InternalAudioTestPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>
}) {
  const params = await searchParams
  const requiredSecret = process.env.AUDIO_TEST_SECRET
  const providedSecret = params.secret ?? ""

  if (requiredSecret && providedSecret !== requiredSecret) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-semibold text-[var(--foreground)]">
          Audio test — BPM & key
        </h1>
        <p className="mb-8 text-sm text-[var(--muted)]">
          Drop an audio file to run the same analysis used for samples (librosa). Requires Python + librosa on the server.
        </p>
        <AudioTestClient secret={requiredSecret ? providedSecret : null} />
      </div>
    </div>
  )
}
