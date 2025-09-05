// Vercel serverless function: create a new session and persist to Upstash Redis
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const id = crypto.randomBytes(8).toString('hex');
    const owner = body.ownerName || 'guest';
    const now = Date.now();
    const session = { id, owner, createdAt: now, models: [], draws: [], camera: null };

    // Persist to Upstash via REST API (require env vars UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
    const url = process.env.UPSTASH_REDIS_REST_URL + '/set/session:' + encodeURIComponent(id);
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      // fallback: return session without persistence (not ideal for production)
      return res.status(200).json({ id });
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ value: JSON.stringify(session) })
    });
    if (!resp.ok) {
      console.warn('Upstash set failed', resp.statusText);
      return res.status(500).json({ error: 'Upstash error' });
    }
    return res.status(200).json({ id });
  } catch (e) { console.error(e); return res.status(500).json({ error: e.message || String(e) }); }
};
