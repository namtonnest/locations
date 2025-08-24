const { nanoid } = require('nanoid');
const { Redis } = require('@upstash/redis');

// Expect these env vars to be set in Vercel dashboard
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const state = body.state || body;
    if (!state) return res.status(400).json({ error: 'Missing state in request body' });

    // generate an 8-char id
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
