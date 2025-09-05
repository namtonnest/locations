// Vercel serverless function: update session snapshot in Upstash Redis
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const id = body.id;
    const session = body.session;
    if (!id || !session) return res.status(400).json({ error: 'Missing id or session' });
    const url = process.env.UPSTASH_REDIS_REST_URL + '/set/session:' + encodeURIComponent(id);
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return res.status(500).json({ error: 'No Upstash configured' });
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ value: JSON.stringify(session) })
    });
    if (!resp.ok) return res.status(500).json({ error: 'Upstash set failed' });
    return res.status(200).json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: e.message || String(e) }); }
};
