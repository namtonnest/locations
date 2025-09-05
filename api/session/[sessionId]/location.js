const { Redis } = require('@upstash/redis');

let cachedRedis = null;
function normalizeUpstashUrl(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (raw.startsWith('redis-cli')) {
    const m = raw.match(/-u\s+([^\s]+)/);
    if (m) raw = m[1];
  }
  const redisUrlMatch = raw.match(/^redis:\/\/(?:[^@]+@)?([^:\/]+)(?::\d+)?/i);
  if (redisUrlMatch) return 'https://' + redisUrlMatch[1];
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw;
}

function getRedis() {
  if (cachedRedis) return cachedRedis;
  const raw = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!raw || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables.');
  }
  const url = normalizeUpstashUrl(raw);
  if (!url || !/^https:\/\//i.test(url)) {
    throw new Error('Invalid UPSTASH_REDIS_REST_URL');
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }
  setCors(res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { sessionId } = req.query || {};
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    const body = req.body || {};
    const { userId, nickname, lat, lng, timestamp, draws, models } = body;
    if (!userId || lat === undefined || lng === undefined) return res.status(400).json({ error: 'Missing userId or lat/lng' });

    const redis = getRedis();
    // store user data as a hash
    const key = `session:${sessionId}:user:${userId}`;
    const data = { userId, nickname: nickname || '', lat: String(lat), lng: String(lng), timestamp: String(timestamp || Date.now()) };
    // save optional blobs as JSON strings
    if (draws) data.draws = JSON.stringify(draws);
    if (models) data.models = JSON.stringify(models);

    await redis.hset(key, data);
    // add to session user set
    await redis.sadd(`session:${sessionId}:users`, userId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('post location error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
