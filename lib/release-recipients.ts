// Who a release announcement may go to. One rule, used by both the recipient
// count shown in the admin UI and the query the send loop actually mails
// from, so the two can never disagree.
//
// Both flags must be on. emailMarketingOptIn is the account-wide "email me"
// switch from signup and Settings; a release notice is not transactional, so
// it must respect that first. productUpdateOptIn is the narrower opt-out the
// unsubscribe link in these emails flips, letting someone keep the newsletter
// and drop version notices without touching anything else.
//
// Deliberately import-free so it can be unit tested without loading Prisma.
export const RELEASE_RECIPIENT_USER_FILTER = {
  productUpdateOptIn: true,
  emailMarketingOptIn: true,
} as const
