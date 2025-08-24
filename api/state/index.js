// nanoid is published as an ES module; require() fails in the Vercel runtime.
// Use dynamic import inside the handler to load it at runtime.
let nanoid;
const { Redis } = require('@upstash/redis');

// Expect these env vars to be set in Vercel dashboard
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    return res.status(204).end();
  }

  setCors(res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
    await redis.set(`state:${id}`, JSON.stringify(state));

    // optionally set TTL by uncommenting the next line (seconds). Example: 30 days -> 30*24*60*60
    // await redis.expire(`state:${id}`, 30 * 24 * 60 * 60);

    return res.status(201).json({ id });
  } catch (err) {
    console.error('save error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
