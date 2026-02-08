# Sample Dig

A platform for beat makers to discover and save rare vinyl samples from YouTube. Similar to sampleroulette.io but with user accounts and the ability to save your favorite finds.

## Features

- 🎵 **Random Sample Discovery**: Click "Dig" to find random rare vinyl samples from YouTube
- 💾 **Save Favorites**: Save samples to your profile for easy access later
- 🎨 **Curated Search**: Algorithm focuses on rare vinyl samples (bossa nova, prog-psych jazz, funk, soul, etc.)
- 👤 **User Accounts**: Register and login to save your collection
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎚️ **Stem Splitter** (optional): Split audio into vocals, drums, bass, and other stems using Demucs. Requires Python and `pip install -r requirements-stem.txt`. See [STEM-SPLITTER-SETUP.md](STEM-SPLITTER-SETUP.md) for setup.

## Tech Stack

- **Frontend**: Next.js 16 with React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **YouTube Integration**: YouTube Data API v3

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- YouTube Data API key ([Get one here](https://console.cloud.google.com/apis/credentials))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd thesampledig
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/thesampledig?schema=public"
NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
YOUTUBE_API_KEY="your-youtube-api-key-here"
```

To generate a `NEXTAUTH_SECRET`, run:
```bash
openssl rand -base64 32
```

4. Set up the database:
```bash
npx prisma migrate dev
```

5. Generate Prisma Client:
```bash
npx prisma generate
```

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
thesampledig/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   └── samples/      # Sample-related endpoints
│   ├── (auth)/           # Auth pages (login, register)
│   ├── dig/              # Main dig page
│   ├── profile/          # User profile with saved samples
│   └── layout.tsx        # Root layout
├── components/           # React components
├── lib/                  # Utility functions
│   ├── auth.ts          # NextAuth configuration
│   ├── db.ts            # Prisma client
│   └── youtube.ts       # YouTube API integration
├── prisma/              # Prisma schema
└── types/               # TypeScript type definitions
```

## Usage

1. **Register/Login**: Create an account or login
2. **Dig for Samples**: Go to the Dig page and click "Dig" to find random samples
3. **Save Samples**: Click "Save Sample" on any sample you like
4. **View Saved**: Go to your profile to see all saved samples

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Secret key for NextAuth (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your application URL
- `YOUTUBE_API_KEY`: YouTube Data API v3 key

## Database Schema

- **users**: User accounts
- **samples**: YouTube samples (cached)
- **user_samples**: Junction table for saved samples

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Make sure to set all environment variables in your Vercel project settings.
