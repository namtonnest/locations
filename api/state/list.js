const { Redis } = require('@upstash/redis');

// Safe, lazy Redis init + normalization (same approach as other handlers)
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
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables.');
  }
  const url = normalizeUpstashUrl(raw);
  if (!url || !/^https:\/\//i.test(url)) {
    throw new Error(`Invalid UPSTASH_REDIS_REST_URL. Received: "${raw}"`);
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }
  setCors(res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Simple auth: require a token header to avoid exposing data publicly.
  const provided = req.headers['x-admin-token'] || req.headers['x-admin-token'.toLowerCase()];
  const expected = process.env.STATE_ADMIN_TOKEN;
  if (!expected || !provided || provided !== expected) {
    return res.status(403).json({ error: 'Forbidden - missing or invalid admin token' });
  }

  try {
    const redis = getRedis();
    // Use SCAN to safely fetch up to 100 keys matching 'state:*'
    let cursor = 0;
    let keys = [];
    let scanned = 0;
    const MAX_KEYS = 100;
    do {
      const result = await redis.scan(cursor, { match: 'state:*', count: MAX_KEYS });
      cursor = result[0];
      keys = keys.concat(result[1]);
      scanned += result[1].length;
      if (keys.length >= MAX_KEYS) {
        keys = keys.slice(0, MAX_KEYS);
        break;
      }
    } while (cursor !== 0);
    if (!keys || !keys.length) return res.json({ states: [] });

    // mget to fetch all values in one round trip
    const values = await redis.mget(...keys);
    const states = keys.map((k, i) => {
      const id = k.replace(/^state:/, '');
      let parsed = null;
      try { parsed = JSON.parse(values[i]); } catch (e) { parsed = values[i]; }
      return { id, state: parsed };
    });

    // Add a warning if there may be more states
    let warning = null;
    if (keys.length === MAX_KEYS) {
      warning = 'Showing first 100 states only. There may be more. Please implement pagination for full access.';
    }
    return res.json({ states, warning });
  } catch (err) {
    console.error('list error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
