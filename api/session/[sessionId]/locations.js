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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }
  setCors(res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { sessionId } = req.query || {};
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    const redis = getRedis();
    const userIds = await redis.smembers(`session:${sessionId}:users`);
    if (!userIds || !userIds.length) return res.json({ users: [] });
    const pipelineKeys = userIds.map(uid => `session:${sessionId}:user:${uid}`);
    const values = await redis.mget(...pipelineKeys);
    const users = userIds.map((uid, i) => {
      const raw = values[i] || null;
      if (!raw) return { userId: uid };
      // parse raw hash-like response as object; Upstash HGETALL returns object already
      try {
        // Assuming hgetall returns an object; if a string, parse JSON
        if (typeof raw === 'string') return { userId: uid, raw };
        // raw is an object with fields
        const u = Object.assign({}, raw);
        if (u.draws) try { u.draws = JSON.parse(u.draws); } catch (e) {}
        if (u.models) try { u.models = JSON.parse(u.models); } catch (e) {}
        if (u.lat) u.lat = Number(u.lat);
        if (u.lng) u.lng = Number(u.lng);
        return u;
      } catch (e) {
        return { userId: uid, error: 'parse error' };
      }
    });
    return res.json({ users });
  } catch (err) {
    console.error('get locations error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
