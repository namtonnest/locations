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
  // Handle CORS preflight
  if (req.method === 'POST') {
    // Save a new state
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Missing or invalid payload' });
      return;
    }
    const id = nanoid(8);
    try {
      // Log Upstash Redis client config and payload
      console.log('[Upstash] Redis client config:', redis?.clientOptions || redis?.options || 'unknown');
      console.log('[Upstash] Saving state with id:', id);
      console.log('[Upstash] Payload:', JSON.stringify(payload));
      await redis.set(`state:${id}`, JSON.stringify(payload));
      console.log('[Upstash] State saved successfully:', id);
      res.status(200).json({ id });
    } catch (err) {
      console.error('[Upstash] Failed to save state:', err);
      res.status(500).json({ error: 'Failed to save state' });
    }
    return;
  }
      if (!raw) return res.status(404).json({ error: 'State not found' });
      let state = null;
      try { state = JSON.parse(raw); } catch (e) { state = raw; }
      return res.status(200).json({ id, state });
    } catch (err) {
      console.error('get error', err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  }

  // POST /api/state - save new state
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const state = body.state || body;
      if (!state) return res.status(400).json({ error: 'Missing state in request body' });

      // generate an 8-char id
      if (!nanoid) {
        const mod = await import('nanoid');
        nanoid = mod.nanoid || (mod.default && mod.default.nanoid) || mod.default || mod;
      }
      const id = nanoid(8);
      // save as stringified JSON under key state:<id>
      const redis = getRedis();
      await redis.set(`state:${id}`, JSON.stringify(state));

      // optionally set TTL by uncommenting the next line (seconds). Example: 30 days -> 30*24*60*60
      // await redis.expire(`state:${id}`, 30 * 24 * 60 * 60);

      return res.status(201).json({ id });
    } catch (err) {
      console.error('save error', err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
};
