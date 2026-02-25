import { prisma } from "@/lib/db"

/** Throttle: only record heartbeat if user has no event in this many ms */
const HEARTBEAT_THROTTLE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Record that a user was active. Use type "heartbeat" for general activity
 * (throttled to once per 5 min per user); use other types (e.g. "save_sample")
 * without throttle.
 */
export async function recordUserActivity(
  userId: string,
  type: "heartbeat" | "save_sample" | "unsave_sample",
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    if (type === "heartbeat") {
      const since = new Date(Date.now() - HEARTBEAT_THROTTLE_MS)
      const recent = await prisma.userEvent.findFirst({
        where: { userId, type: "heartbeat", createdAt: { gte: since } },
        select: { id: true },
      })
      if (recent) return
    }

    await prisma.userEvent.create({
      data: {
        userId,
        type,
        metadata: metadata ?? undefined,
      },
    })
  } catch (e) {
    console.error("[recordUserActivity] failed:", e instanceof Error ? e.message : String(e))
  }
}
