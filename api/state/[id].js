const { Redis } = require('@upstash/redis');

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

module.exports = async (req, res) => {
  const { id } = req.query || {};
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!id) return res.status(400).json({ error: 'Missing id param' });
  try {
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
