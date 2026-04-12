import { ADSENSE_CLIENT_ID } from "./adsense-dig"

export { ADSENSE_CLIENT_ID }

/** In-article (fluid) unit — all blog posts */
export const ADSENSE_BLOG_IN_ARTICLE_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_BLOG_IN_ARTICLE_SLOT ?? "7702909006"

/** Set `true` (or `NEXT_PUBLIC_BLOG_ADSENSE_ENABLED=true`) when ready to show in-article units. */
export const BLOG_IN_ARTICLE_ADS_ENABLED =
  String(process.env.NEXT_PUBLIC_BLOG_ADSENSE_ENABLED ?? "").toLowerCase() === "true"
