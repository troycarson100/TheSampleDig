// Where the creator program can pay. Sample Roll is a US Stripe platform, and
// Connect pays out from a US platform only to accounts in the US, the UK, the
// EEA, Canada and Switzerland (docs.stripe.com/connect/cross-border-payouts,
// checked 2026-10-06). Anywhere else - Australia, Israel, ... - needs Stripe
// to switch it on, so the apply form offers only these, and a creator's
// Stripe account is opened in the one they chose.

export const CREATOR_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
] as const

export type CreatorCountry = (typeof CREATOR_COUNTRIES)[number]["code"]

export function isCreatorCountry(value: unknown): value is CreatorCountry {
  return typeof value === "string" && CREATOR_COUNTRIES.some((c) => c.code === value)
}

export function creatorCountryName(code: string): string {
  return CREATOR_COUNTRIES.find((c) => c.code === code)?.name ?? code
}
