const { Redis } = require('@upstash/redis');

let nanoid;
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
    if (!nanoid) {
      const mod = await import('nanoid');
      nanoid = mod.nanoid || (mod.default && mod.default.nanoid) || mod.default || mod;
    }
    const id = nanoid(8);
    const redis = getRedis();
    // create empty session marker (could store metadata later)
    await redis.set(`session:${id}:created`, Date.now().toString());
    // set an empty set of users
    await redis.sadd(`session:${id}:users`, []);
    return res.status(201).json({ sessionId: id });
  } catch (err) {
    console.error('create session error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
