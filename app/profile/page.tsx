"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import SampleCard from "@/components/SampleCard"
import Link from "next/link"

interface SavedSample {
  id: string
  youtubeId: string
  title: string
  channel: string
  thumbnailUrl: string
  genre?: string | null
  era?: string | null
  savedAt: string
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [samples, setSamples] = useState<SavedSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchSavedSamples()
    }
  }, [session])

  const fetchSavedSamples = async () => {
    try {
      const response = await fetch("/api/samples/saved")
      if (!response.ok) {
        throw new Error("Failed to fetch saved samples")
      }
      const data = await response.json()
      setSamples(data)
    } catch (err) {
      setError("Failed to load saved samples")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnsave = (sampleId: string) => {
    setSamples(samples.filter((s) => s.id !== sampleId))
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-black to-purple-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-900">
      <nav className="p-6 flex justify-between items-center">
        <Link href="/dig" className="text-2xl font-bold text-white">
          Sample Dig
        </Link>
        <div className="flex gap-4 items-center">
          <Link
            href="/dig"
            className="text-purple-300 hover:text-purple-200 transition"
          >
            Dig
          </Link>
          <Link
            href="/api/auth/signout"
            className="text-gray-400 hover:text-gray-300 transition"
          >
            Sign Out
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            My Saved Samples
          </h1>
          <p className="text-gray-400">
            {samples.length} {samples.length === 1 ? "sample" : "samples"} saved
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}

        {samples.length === 0 && !loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">
              You haven't saved any samples yet.
            </p>
            <Link
              href="/dig"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
            >
              Start Digging
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {samples.map((sample) => (
              <SampleCard
                key={sample.id}
                id={sample.id}
                youtubeId={sample.youtubeId}
                title={sample.title}
                channel={sample.channel}
                thumbnailUrl={sample.thumbnailUrl}
                genre={sample.genre}
                era={sample.era}
                isSaved={true}
                onUnsave={() => handleUnsave(sample.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
