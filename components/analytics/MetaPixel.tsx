"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"
import { usePathname } from "next/navigation"
import { META_PIXEL_ID, isMetaPixelEnabled, trackMeta } from "@/lib/meta-pixel"

/**
 * Loads the Meta (Facebook) Pixel site-wide and fires PageView on every App
 * Router navigation. Renders nothing until NEXT_PUBLIC_META_PIXEL_ID is set.
 * Mounted once in app/layout.tsx.
 *
 * Uses usePathname() only (not useSearchParams) so it doesn't force a Suspense /
 * client-render bailout on every route.
 */
export default function MetaPixel() {
  const pathname = usePathname()
  const firstRun = useRef(true)

  useEffect(() => {
    if (!isMetaPixelEnabled) return
    // The base snippet already fired the initial PageView — skip the first run so
    // it isn't double-counted, then fire once per client-side navigation.
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    trackMeta("PageView")
  }, [pathname])

  if (!isMetaPixelEnabled) return null

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
