import { campaignRoutes } from "@/lib/member-campaign-route"
import { BUNDLE_CAMPAIGN } from "@/lib/bundle-email"

// The bundle email (the fourth member email), for /admin/offers.
export const { GET, POST } = campaignRoutes(BUNDLE_CAMPAIGN)
