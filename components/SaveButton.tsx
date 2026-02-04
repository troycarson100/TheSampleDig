"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"

interface SaveButtonProps {
  sampleId: string
  isSaved?: boolean
  onSaveChange?: (saved: boolean) => void
}

export default function SaveButton({
  sampleId,
  isSaved: initialIsSaved = false,
  onSaveChange,
}: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved)
  const [loading, setLoading] = useState(false)
  const { data: session } = useSession()

  if (!session) {
    return null
  }

  const handleClick = async () => {
    setLoading(true)
    try {
      const endpoint = isSaved ? "/api/samples/unsave" : "/api/samples/save"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId }),
      })

      if (response.ok) {
        const newSavedState = !isSaved
        setIsSaved(newSavedState)
        onSaveChange?.(newSavedState)
      }
    } catch (error) {
      console.error("Error saving/unsaving sample:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
        isSaved
          ? "bg-green-600 hover:bg-green-700 text-white"
          : "bg-gray-700 hover:bg-gray-600 text-gray-200"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          ...
        </span>
      ) : isSaved ? (
        "✓ Saved"
      ) : (
        "Save Sample"
      )}
    </button>
  )
}
