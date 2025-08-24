const { Redis } = require('@upstash/redis');

// Reuse the same normalization logic as the POST handler. Keep a local
// lazy-instantiated Redis client to avoid crashing at module load time when
// env vars are misconfigured.
let cachedRedis = null;
function normalizeUpstashUrl(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (raw.startsWith('redis-cli')) {
    const m = raw.match(/-u\s+([^\s]+)/);
    if (m) raw = m[1];
  }
  const redisUrlMatch = raw.match(/^redis:\/\/(?:[^@]+@)?([^:\/]+)(?::\d+)?/i);
  if (redisUrlMatch) {
    return 'https://' + redisUrlMatch[1];
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw;
}

function getRedis() {
  if (cachedRedis) return cachedRedis;
  const raw = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!raw || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables. Set them in Vercel (or your environment) to use the state backend.');
  }
  const url = normalizeUpstashUrl(raw);
  if (!url || !/^https:\/\//i.test(url)) {
    throw new Error(`Invalid UPSTASH_REDIS_REST_URL. Expected an https URL like https://<id>.upstash.io, or a redis:// connection string; received: "${raw}"`);
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }
  setCors(res);

  const { id } = req.query || {};
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!id) return res.status(400).json({ error: 'Missing id param' });
  try {
  const redis = getRedis();
  const raw = await redis.get(`state:${id}`);
    if (raw === null || raw === undefined) return res.status(404).json({ error: 'Not found' });
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
    return res.json({ state: parsed });
  } catch (err) {
    console.error('fetch error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
