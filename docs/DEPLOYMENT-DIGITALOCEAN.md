# Deploying to DigitalOcean App Platform

## Required environment variables

Set these in **DigitalOcean** → your app → **Settings** → **App-Level Environment Variables** (or the env vars section for your app/component). After changing env vars, **Redeploy** the app so the new values are used.

### Login (fixes "Server error – server configuration")

If you see **"There is a problem with the server configuration"** on login, the app is missing the secret or URL below. Add them in DO env vars and redeploy.

| Variable | Required | Example / notes |
|----------|----------|------------------|
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | **Yes** (one of them) | Generate with `openssl rand -base64 32`. Used to sign sessions; **must** be set in production or login fails. |
| `NEXTAUTH_URL` | **Yes** | Your production URL, e.g. `https://sampleroll.com` or `https://your-app-xxxx.ondigitalocean.app`. No trailing slash. Must match the URL users actually use. |

The app uses `trustHost: true` so it works behind DigitalOcean’s proxy; you still must set the secret and URL above.

### Sample Roll / Dig (no YouTube key for users)

Sample Roll is **DB-only** for end users. The app **never** uses the YouTube API on their behalf—no key is required or used for dig. Set a key only for **admin** use: populate API, discovery scripts, or cron jobs that add videos to the DB (e.g. from your own machine or a secured job).

| Variable | Required for dig? | Example / notes |
|----------|-------------------|------------------|
| `YOUTUBE_API_KEY` or `YOUTUBE_API_KEYS` | **No** | Admin-only (populate/discovery). Users never use it. |

### Database

| Variable | Required | Example / notes |
|----------|----------|------------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. Use DigitalOcean Managed Database or any Postgres; run `prisma migrate deploy` against it before or during deploy. |

### Optional (Stripe, populate, etc.)

- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` if you use Pro subscriptions.
- **Populate job:** `POPULATE_SECRET` if you call the populate API from a cron/job.

## Checklist

1. Add **NEXTAUTH_SECRET** (generate with `openssl rand -base64 32`).
2. Add **NEXTAUTH_URL** = your live app URL (e.g. `https://sampleroll.com`).
3. (Optional) **YOUTUBE_API_KEY** or **YOUTUBE_API_KEYS** only if you run populate/discovery; not needed for Sample Roll (DB-only).
4. Ensure **DATABASE_URL** is set and migrations are applied (`npx prisma migrate deploy`).
5. Save env vars and **Redeploy** the app.

After redeploy, login and Sample Roll work without a YouTube key.
