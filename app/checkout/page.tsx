import type { Metadata } from "next"
import SiteNav from "@/components/SiteNav"
import CheckoutForm from "./CheckoutForm"

// The step between the cart and Stripe. Its entire reason to exist is
// identifying the buyer before a charge happens: a signed-out visitor is
// otherwise unidentifiable at the moment they pay, which is how a returning
// customer ends up paying full price for a bundle containing plugins they
// already own. See CheckoutForm for the ownership check and the submit flow.
export const metadata: Metadata = {
  title: "Checkout | Sample Roll",
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen theme-vinyl" style={{ background: "var(--background)" }}>
      <header className="site-header w-full">
        <SiteNav />
      </header>
      <main className="max-w-5xl mx-auto px-3 sm:px-4 mt-[56px] pb-16 pt-8">
        <CheckoutForm />
      </main>
    </div>
  )
}
