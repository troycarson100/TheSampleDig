import { campaignRoutes } from "@/lib/member-campaign-route"
import { VIDEO_CAMPAIGN } from "@/lib/video-email"

// The fltr video email (the third member email), for /admin/offers.
export const { GET, POST } = campaignRoutes(VIDEO_CAMPAIGN)
