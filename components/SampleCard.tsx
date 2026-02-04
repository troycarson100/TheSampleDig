"use client"

import Link from "next/link"
import SaveButton from "./SaveButton"

interface SampleCardProps {
  id: string
  youtubeId: string
  title: string
  channel: string
  thumbnailUrl: string
  genre?: string | null
  era?: string | null
  isSaved?: boolean
  onUnsave?: () => void
}

export default function SampleCard({
  id,
  youtubeId,
  title,
  channel,
  thumbnailUrl,
  genre,
  era,
  isSaved = true,
  onUnsave,
}: SampleCardProps) {
  return (
    <div className="bg-black/50 backdrop-blur-sm rounded-lg overflow-hidden border border-purple-500/20 hover:border-purple-500/40 transition">
      <Link href={`https://www.youtube.com/watch?v=${youtubeId}`} target="_blank">
        <div className="aspect-video w-full bg-black relative group">
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition">
              <svg
                className="w-16 h-16 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
      <div className="p-4">
        <h3 className="text-white font-semibold mb-2 line-clamp-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-3">{channel}</p>
        {(genre || era) && (
          <div className="flex gap-2 flex-wrap mb-3">
            {genre && (
              <span className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-xs">
                {genre}
              </span>
            )}
            {era && (
              <span className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-xs">
                {era}
              </span>
            )}
          </div>
        )}
        <SaveButton
          sampleId={id}
          isSaved={isSaved}
          onSaveChange={(saved) => {
            if (!saved && onUnsave) {
              onUnsave()
            }
          }}
        />
      </div>
    </div>
  )
}
