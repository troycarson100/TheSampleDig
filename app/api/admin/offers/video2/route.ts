import { campaignRoutes } from "@/lib/member-campaign-route"
import { VIDEO_2_CAMPAIGN } from "@/lib/video-email-2"

// The second video email (the fifth member email), for /admin/offers.
export const { GET, POST } = campaignRoutes(VIDEO_2_CAMPAIGN)
