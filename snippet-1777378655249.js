// backend/src/services/streaming.js
import { redis } from '../config/db.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'streaming-availability.p.rapidapi.com';

export async function getStreamingProviders(tmdbId, region = 'us') {
  const cacheKey = `streaming:${tmdbId}:${region}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // If no RapidAPI key, fall back to TMDB watch providers
  if (!RAPIDAPI_KEY) {
    return getProvidersFromTMDB(tmdbId, region);
  }

  try {
    const url = `https://${RAPIDAPI_HOST}/shows/movie/${tmdbId}`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    });

    if (!res.ok) return getProvidersFromTMDB(tmdbId, region);
    const data = await res.json();

    const streamingInfo = data.streamingInfo?.[region] || [];
    const providers = streamingInfo.map(s => ({
      provider_name: s.service,
      type: s.streamingType,
      link: s.link,
      leaving_date: s.leaving ? new Date(s.leaving * 1000).toISOString().slice(0, 10) : null,
      region
    }));

    await redis.setex(cacheKey, 86400, JSON.stringify(providers));
    return providers;
  } catch {
    return getProvidersFromTMDB(tmdbId, region);
  }
}

async function getProvidersFromTMDB(tmdbId, region) {
  const cacheKey = `tmdb_providers:${tmdbId}:${region}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${process.env.TMDB_API_KEY}`
    );
    const data = await res.json();
    const regionData = data.results?.[region.toUpperCase()];

    if (!regionData) return [];

    const providers = [];
    const IMG = 'https://image.tmdb.org/t/p/w92';

    for (const p of (regionData.flatrate || [])) {
      providers.push({
        provider_name: p.provider_name,
        provider_logo: `${IMG}${p.logo_path}`,
        type: 'subscription',
        link: regionData.link,
        region
      });
    }
    for (const p of (regionData.rent || [])) {
      providers.push({
        provider_name: p.provider_name,
        provider_logo: `${IMG}${p.logo_path}`,
        type: 'rent',
        link: regionData.link,
        region
      });
    }
    for (const p of (regionData.buy || [])) {
      providers.push({
        provider_name: p.provider_name,
        provider_logo: `${IMG}${p.logo_path}`,
        type: 'buy',
        link: regionData.link,
        region
      });
    }

    await redis.setex(cacheKey, 86400, JSON.stringify(providers));
    return providers;
  } catch {
    return [];
  }
}