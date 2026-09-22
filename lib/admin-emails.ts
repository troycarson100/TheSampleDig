/** Parsing for the ADMIN_EMAILS allowlist.
 *
 *  Its own module, free of any next-auth import, so server code that only
 *  needs "who do I notify?" - the Stripe webhook, for one - can have the list
 *  without dragging the auth stack in behind it. lib/admin.ts builds its
 *  session checks on top of this.
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** The configured admin recipients, or an empty list when none are set. */
export function adminEmails(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS)
}
