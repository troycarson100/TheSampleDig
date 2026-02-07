# Quick Start: Scaling Setup

## Step 1: Add Environment Variable

Add to your `.env` file:

```bash
POPULATE_SECRET=your-secret-key-change-this
```

## Step 2: Initial Database Population

Run the pre-population script to seed your database with samples:

```bash
node scripts/populate-database.js 500
```

This will:
- Search YouTube using all query templates
- Store 500 high-quality samples in your database
- Take ~10-15 minutes (depends on API quota)

## Step 3: Verify It's Working

Check database stats:
```bash
curl http://localhost:3000/api/samples/populate
```

You should see:
```json
{
  "totalSamples": 500,
  "message": "Database contains 500 pre-populated samples"
}
```

## Step 4: Test the New Flow

1. Start your dev server: `npm run dev`
2. Go to `/dig` page
3. Click the dice button
4. Check server logs - you should see:
   ```
   [Dig] Step 1: Checking database for pre-populated samples...
   [Dig] ✓ Found sample in database: abc123xyz
   ```

If you see this, the database-first approach is working! 🎉

## Step 5: Schedule Nightly Updates (Production)

Add to cron to run daily at 2 AM:

```bash
crontab -e
```

Add:
```
0 2 * * * cd /path/to/thesampledig && node scripts/populate-database.js 200
```

This will add 200 new samples every night, keeping your database fresh.

## How It Works Now

1. **User clicks "Dig"** → System checks database first
2. **If samples exist** → Returns immediately (no API call!)
3. **If database empty** → Falls back to YouTube API
4. **Results are cached** → Future searches are faster

## Expected Results

- **95%+ of requests** served from database (0 API calls)
- **4% of requests** served from cache (0 API calls)
- **<1% of requests** need YouTube API

This means you can handle **10,000+ users** with just **1-2 API keys**!

## Troubleshooting

**Q: All requests still hitting YouTube API**
- A: Run the pre-population script first to seed the database

**Q: Getting "Database empty" errors**
- A: Check that samples were created: `curl http://localhost:3000/api/samples/populate`

**Q: Pre-population script fails**
- A: Check your `YOUTUBE_API_KEY` is set and has quota remaining

**Q: Want to populate more samples?**
- A: Increase the limit: `node scripts/populate-database.js 1000`
