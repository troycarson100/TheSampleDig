# Supabase Setup Instructions

Follow these steps to set up your free Supabase database:

## Step 1: Create Supabase Account & Project

1. Go to https://supabase.com
2. Click "Start your project" or "Sign up"
3. Sign up with GitHub (recommended) or email
4. Click "New Project"
5. Fill in:
   - **Name**: `thesampledig` (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free
6. Click "Create new project"
7. Wait 2-3 minutes for project to initialize

## Step 2: Get Database Connection String

1. Once project is ready, go to **Project Settings** (gear icon in sidebar)
2. Click **Database** in the left menu
3. Scroll down to **Connection string**
4. Select **URI** tab
5. Copy the connection string (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the password you created in Step 1

## Step 3: Update .env File

The connection string will be updated automatically once you provide it, or you can manually add it to your `.env` file:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
```

**Note**: Add `?pgbouncer=true&connection_limit=1` for better connection pooling with Supabase.

## Step 4: Run Migrations

After updating the DATABASE_URL, run:
```bash
npx prisma db push
```

This will create all tables in your Supabase database.

## That's it!

Your database is now hosted on Supabase's free tier. You can:
- View your data in the Supabase dashboard
- Get automatic backups
- Scale up when needed
