// backend/src/services/tmdb.js
import { redis } from '../config/db.js';

const BASE = 'https://api.themoviedb.org/3';
const KEY = process.env.TMDB_API_KEY;
const IMG = 'https://image.tmdb.org/t/p';

function posterUrl(path) { return path ? `${IMG}/w500${path}` : null; }
function backdropUrl(path) { return path ? `${IMG}/original${path}` : null; }

async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set('api_key', KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const cacheKey = `tmdb:${url.toString()}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  const data = await res.json();

  await redis.setex(cacheKey, 3600, JSON.stringify(data));
  return data;
}

export function normalizeMovie(m) {
  return {
    tmdb_id: m.id,
    title: m.title || m.name,
    overview: m.overview,
    genres: m.genres?.map(g => g.name) || m.genre_ids || [],
    release_year: parseInt((m.release_date || '').slice(0, 4)) || null,
    language: m.original_language,
    runtime: m.runtime || null,
    rating: m.vote_average || 0,
    poster_url: posterUrl(m.poster_path),
    backdrop_url: backdropUrl(m.backdrop_path),
    popularity: m.popularity || 0,
    keywords: []
  };
}

export async function searchMovies(queryStr, page = 1) {
  const data = await tmdbFetch('/search/movie', { query: queryStr, page });
  return {
    results: data.results.map(normalizeMovie),
    total_pages: data.total_pages,
    page: data.page
  };
}

export async function getMovieDetails(tmdbId) {
  const [movie, keywords, videos] = await Promise.all([
    tmdbFetch(`/movie/${tmdbId}`),
    tmdbFetch(`/movie/${tmdbId}/keywords`),
    tmdbFetch(`/movie/${tmdbId}/videos`)
  ]);

  const normalized = normalizeMovie(movie);
  normalized.genres = movie.genres?.map(g => g.name) || [];
  normalized.keywords = keywords.keywords?.map(k => k.name) || [];
  normalized.trailer = videos.results?.find(
    v => v.type === 'Trailer' && v.site === 'YouTube'
  )?.key || null;

  return normalized;
}

export async function discoverMovies(filters = {}, page = 1) {
  const params = { page, sort_by: 'popularity.desc' };
  if (filters.genre) params.with_genres = filters.genre;
  if (filters.language) params.with_original_language = filters.language;
  if (filters.yearFrom) params['primary_release_date.gte'] = `${filters.yearFrom}-01-01`;
  if (filters.yearTo) params['primary_release_date.lte'] = `${filters.yearTo}-12-31`;
  if (filters.ratingMin) params['vote_average.gte'] = filters.ratingMin;
  if (filters.runtimeMax) params['with_runtime.lte'] = filters.runtimeMax;

  const data = await tmdbFetch('/discover/movie', params);
  return { results: data.results.map(normalizeMovie), total_pages: data.total_pages, page: data.page };
}

export async function getTrending(timeWindow = 'week', page = 1) {
  const data = await tmdbFetch(`/trending/movie/${timeWindow}`, { page });
  return data.results.map(normalizeMovie);
}

export async function getGenreList() {
  const data = await tmdbFetch('/genre/movie/list');
  return data.genres;
}

// Map genre names to TMDB genre IDs
const GENRE_MAP = {
  action: 28, comedy: 35, horror: 27, romance: 10749,
  thriller: 53, 'sci-fi': 878, drama: 18, animation: 16,
  documentary: 99, mystery: 9648, fantasy: 14, crime: 80
};

const LANG_MAP = {
  english: 'en', hindi: 'hi', korean: 'ko', japanese: 'ja',
  french: 'fr', spanish: 'es'
};

export function buildDiscoverFilters(prefs) {
  const filters = {};

  if (prefs.genres?.length) {
    const ids = prefs.genres
      .map(g => GENRE_MAP[g.toLowerCase()])
      .filter(Boolean);
    if (ids.length) filters.genre = ids.join(',');
  }

  if (prefs.language && prefs.language !== 'any') {
    filters.language = LANG_MAP[prefs.language.toLowerCase()] || prefs.language;
  }

  if (prefs.time_pref) {
    const t = prefs.time_pref.toLowerCase();
    if (t.includes('under 90') || t.includes('< 90')) filters.runtimeMax = 90;
    else if (t.includes('90') && t.includes('120')) filters.runtimeMax = 120;
  }

  return filters;
}