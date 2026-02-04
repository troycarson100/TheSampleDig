-- PostgreSQL Schema for Sample Dig Platform
-- This is a reference schema. Prisma will manage the actual database.

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Samples table
CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  youtube_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  genre TEXT,
  era TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User samples junction table (for saved samples)
CREATE TABLE IF NOT EXISTS user_samples (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, sample_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_samples_user_id ON user_samples(user_id);
CREATE INDEX IF NOT EXISTS idx_user_samples_sample_id ON user_samples(sample_id);
CREATE INDEX IF NOT EXISTS idx_samples_youtube_id ON samples(youtube_id);
