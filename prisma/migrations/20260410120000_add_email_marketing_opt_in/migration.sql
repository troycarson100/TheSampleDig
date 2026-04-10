-- Opt-in for occasional email updates (Mailchimp / exports). Existing users default to subscribed.
ALTER TABLE "users" ADD COLUMN "email_marketing_opt_in" BOOLEAN NOT NULL DEFAULT true;
