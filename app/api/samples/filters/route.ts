import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * GET /api/samples/filters
 * Returns genre and era values that have at least one sample in the database.
 * Used by the dig page to show only filter options that have content.
 */
export async function GET() {
  try {
    const [genreRows, eraRows] = await Promise.all([
      prisma.sample.groupBy({
        by: ["genre"],
        where: { genre: { not: null } },
        _count: { genre: true },
      }),
      prisma.sample.groupBy({
        by: ["era"],
        where: { era: { not: null } },
        _count: { era: true },
      }),
    ])

    const genres = genreRows
      .map((r) => r.genre)
      .filter((g): g is string => g != null && g.trim() !== "")
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))

    const eras = eraRows
      .map((r) => r.era)
      .filter((e): e is string => e != null && e.trim() !== "")
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))

    return NextResponse.json({ genres, eras })
  } catch (error: unknown) {
    console.error("[Filters] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load filters" },
      { status: 500 }
    )
  }
}
