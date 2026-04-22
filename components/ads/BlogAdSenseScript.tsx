"use client"

import { AdSensePublisherScript } from "./AdSensePublisherScript"
import { BLOG_IN_ARTICLE_ADS_ENABLED } from "@/lib/adsense-blog"

/**
 * Injects the AdSense publisher script on all `/blog` routes (public, indexable content for policy review).
 */
export function BlogAdSenseScript() {
  return <AdSensePublisherScript active={BLOG_IN_ARTICLE_ADS_ENABLED} />
}
