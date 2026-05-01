// backend/src/services/recommendation.js
import { query } from '../config/db.js';
import { discoverMovies, getTrending, buildDiscoverFilters } from './tmdb.js';

function similarity(movieA, movieB) {
  let score = 0;

  // Genre overlap (weighted highest)
  const genresA = Array.isArray(movieA.genres) ? movieA.genres : [];
  const genresB = Array.isArray(movieB.genres) ? movieB.genres : [];
  const genreOverlap = genresA.filter(g => genresB.includes(g)).length;
  score += genreOverlap * 3;

  // Language match
  if (movieA.language === movieB.language) score += 2;

  // Year proximity
  if (movieA.release_year && movieB.release_year) {
    const diff = Math.abs(movieA.release_year - movieB.release_year);
    if (diff < 3) score += 2;
    else if (diff < 5) score += 1;
  }

  // Runtime proximity
  if (movieA.runtime && movieB.runtime) {
    if (Math.abs(movieA.runtime - movieB.runtime) < 20) score += 1;
  }

  // Rating proximity
  if (movieA.rating && movieB.rating) {
    if (Math.abs(movieA.rating - movieB.rating) < 1) score += 1;
  }

  return score;
}

// Mood → genre weighting
const MOOD_GENRES = {
  happy: ['Comedy', 'Animation', 'Family'],
  emotional: ['Drama', 'Romance'],
  excited: ['Action', 'Adventure', 'Sci-Fi'],
  relaxed: ['Comedy', 'Drama', 'Documentary'],
  curious: ['Mystery', 'Thriller', 'Science Fiction']
};

const VIBE_BOOST = {
  fun: ['Comedy', 'Action', 'Animation'],
  'deep story': ['Drama', 'Mystery'],
  emotional: ['Drama', 'Romance', 'War'],
  'fast thrill': ['Action', 'Thriller', 'Horror']
};

export async function getRecommendations(preferences, userId = null) {
  const filters = buildDiscoverFilters(preferences);
  let movies = [];

  // Fetch discover results
  try {
    const discovered = await discoverMovies(filters, 1);
    movies = discovered.results;
  } catch (e) {
    console.error('Discover failed, falling back to trending:', e.message);
  }

  // Fallback / supplement with trending
  if (movies.length < 10) {
    const trending = await getTrending('week');
    movies = [...movies, ...trending];
  }

  // Deduplicate
  const seen = new Set();
  movies = movies.filter(m => {
    if (seen.has(m.tmdb_id)) return false;
    seen.add(m.tmdb_id);
    return true;
  });

  // Score each movie against preferences
  const moodGenres = MOOD_GENRES[preferences.mood?.toLowerCase()] || [];
  const vibeGenres = VIBE_BOOST[preferences.vibe?.toLowerCase()] || [];

  const scored = movies.map(movie => {
    let matchScore = 0;
    const genres = Array.isArray(movie.genres) ? movie.genres.map(g =>
      typeof g === 'string' ? g : ''
    ) : [];

    // Mood alignment
    const moodHits = genres.filter(g =>
      moodGenres.some(mg => g.toLowerCase().includes(mg.toLowerCase()))
    ).length;
    matchScore += moodHits * 10;

    // Genre preference alignment
    const prefGenres = preferences.genres || [];
    const genreHits = genres.filter(g =>
      prefGenres.some(pg => g.toLowerCase().includes(pg.toLowerCase()))
    ).length;
    matchScore += genreHits * 15;

    // Vibe alignment
    const vibeHits = genres.filter(g =>
      vibeGenres.some(vg => g.toLowerCase().includes(vg.toLowerCase()))
    ).length;
    matchScore += vibeHits * 8;

    // Language bonus
    const langMap = { english: 'en', hindi: 'hi', korean: 'ko' };
    const prefLang = langMap[preferences.language?.toLowerCase()];
    if (prefLang && movie.language === prefLang) matchScore += 10