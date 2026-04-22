import { ADSENSE_CLIENT_ID } from "./adsense-dig"

export { ADSENSE_CLIENT_ID }

/** In-article (fluid) unit — all blog posts */
export const ADSENSE_BLOG_IN_ARTICLE_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_BLOG_IN_ARTICLE_SLOT ?? "7702909006"

/**
 * Public blog in-article units. Default on for policy-friendly placement next to real content;
 * set `NEXT_PUBLIC_BLOG_ADSENSE_ENABLED=false` to turn off.
 */
export const BLOG_IN_ARTICLE_ADS_ENABLED = (() => {
  const v = process.env.NEXT_PUBLIC_BLOG_ADSENSE_ENABLED
  if (v == null) return true
  return v.toLowerCase() === "true"
})()
