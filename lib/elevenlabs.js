'use strict';

const WINDOW_MS = 60_000;
const buckets = globalThis.__avLineReaderRateBuckets || new Map();
globalThis.__avLineReaderRateBuckets = buckets;

function getApiKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

function getAllowedVoiceIds() {
  return (process.env.ELEVENLABS_VOICE_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function rateLimit(req, route, limit) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || 'unknown')
    .split(',')[0]
    .trim();
  const key = `${route}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    bucket = { startedAt: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 5000) {
    for (const [id, value] of buckets) {
      if (now - value.startedAt >= WINDOW_MS) buckets.delete(id);
    }
  }
  return bucket.count <= limit;
}

function configError() {
  if (!getApiKey()) return 'Add ELEVENLABS_API_KEY to the deployment environment.';
  if (!getAllowedVoiceIds().length) return 'Add one or more approved voice IDs to ELEVENLABS_VOICE_IDS.';
  return '';
}

async function providerFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'xi-api-key': getApiKey(),
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(25_000),
  });
  return response;
}

module.exports = { getApiKey, getAllowedVoiceIds, rateLimit, configError, providerFetch };
