// backend/src/db/migrate.js
import { query } from '../config/db.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    oauth_provider VARCHAR(50) DEFAULT 'google',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    overview TEXT,
    genres JSONB DEFAULT '[]',
    release_year INTEGER,
    language VARCHAR(20),
    runtime INTEGER,
    rating NUMERIC(3,1),
    poster_url TEXT,
    backdrop_url TEXT,
    keywords JSONB DEFAULT '[]',
    popularity NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS streaming_providers (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    provider_name VARCHAR(100) NOT NULL,
    provider_logo TEXT,
    region VARCHAR(10) DEFAULT 'US',
    link TEXT,
    type VARCHAR(30) DEFAULT 'subscription',
    leaving_date DATE,
    added_date DATE,
    UNIQUE(movie_id, provider_name, region)
  );

  CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, movie_id)
  );

  CREATE TABLE IF NOT EXISTS user_interactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('liked','skipped','watched')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    mood VARCHAR(50),
    genres JSONB DEFAULT '[]',
    time_pref VARCHAR(50),
    language VARCHAR(50),
    vibe VARCHAR(50),
    custom_inputs JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_key VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_key)
  );

  CREATE INDEX IF NOT EXISTS idx_movies_tmdb ON movies(tmdb_id);
  CREATE INDEX IF NOT EXISTS idx_movies_genres ON movies USING GIN(genres);
  CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_interactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlists(user_id);
  CREATE INDEX IF NOT EXISTS idx_providers_movie ON streaming_providers(movie_id);
`;

export async function runMigrations() {
  try {
    await query(SCHEMA);
    console.log('✓ Database migrations complete');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}