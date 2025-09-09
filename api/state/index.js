// nanoid is published as an ES module; require() fails in the Vercel runtime.
// Use dynamic import inside the handler to load it at runtime.
let nanoid;
const { Redis } = require('@upstash/redis');

// Lazily instantiate Redis and normalize common mis-configurations for the
// UPSTASH_REDIS_REST_URL environment variable. This prevents the function
// from throwing at module load time when the user accidentally pastes a
// redis-cli connection string (or similar) into the env var.
let cachedRedis = null;
function normalizeUpstashUrl(raw) {
  if (!raw) return null;
  // If the user pasted the redis-cli command that Upstash shows, strip it.
  // Example input sometimes seen: "redis-cli --tls -u redis://default:...@present-swift-17545.upstash.io:6379"
  raw = raw.trim();
  if (raw.startsWith('redis-cli')) {
    const m = raw.match(/-u\s+([^\s]+)/);
    if (m) raw = m[1];
  }

  // If it's a redis:// connection string (used for direct redis clients),
  // extract the hostname and return the HTTPS REST URL form which the
  // @upstash/redis HTTP client expects, e.g.
  // redis://default:<pwd>@present-swift-17545.upstash.io:6379 -> https://present-swift-17545.upstash.io
  const redisUrlMatch = raw.match(/^redis:\/\/(?:[^@]+@)?([^:\/]+)(?::\d+)?/i);
  if (redisUrlMatch) {
    return 'https://' + redisUrlMatch[1];
  }

  // If it already looks like an https URL, keep it.
  if (/^https?:\/\//i.test(raw)) return raw;

  // Otherwise return as-is; the Redis constructor will perform final validation
  return raw;
}

function getRedis() {
  if (cachedRedis) return cachedRedis;
  const raw = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!raw || !token) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables. Set them in Vercel (or your environment) to use the state backend. Example UPSTASH_REDIS_REST_URL: https://<your-id>.upstash.io');
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}



module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'POST') {
    try {
      if (!nanoid) {
        const mod = await import('nanoid');
        nanoid = mod.nanoid || (mod.default && mod.default.nanoid) || mod.default || mod;
      }
      const body = req.body || {};
      const state = body.state || body;
      if (!state || typeof state !== 'object') {
        res.status(400).json({ error: 'Missing or invalid state in request body' });
        return;
      }
      const id = nanoid(8);
      const redis = getRedis();
      console.log('[Upstash] Redis client config:', redis?.clientOptions || redis?.options || 'unknown');
      console.log('[Upstash] Saving state with id:', id);
      console.log('[Upstash] Payload:', JSON.stringify(state));
      await redis.set(`state:${id}`, JSON.stringify(state));
      console.log('[Upstash] State saved successfully:', id);
      // Optionally set TTL (uncomment if needed)
      // await redis.expire(`state:${id}`, 30 * 24 * 60 * 60); // 30 days
      res.status(201).json({ id });
    } catch (err) {
      console.error('[Upstash] Failed to save state:', err);
      res.status(500).json({ error: 'Failed to save state' });
    }
    return;
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
