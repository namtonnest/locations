// Vercel serverless function: retrieve session by id from Upstash Redis
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');
  try {
    const id = req.query && (req.query.id || req.query.session_id) || (req.url && new URL(req.url, 'http://localhost').searchParams.get('id'));
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const url = process.env.UPSTASH_REDIS_REST_URL + '/get/session:' + encodeURIComponent(id);
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return res.status(200).json({ error: 'No Upstash configured' });
    const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!resp.ok) return res.status(500).json({ error: 'Upstash fetch failed' });
    const j = await resp.json();
    if (!j || !j.result) return res.status(404).json({ error: 'Not found' });
    const parsed = JSON.parse(j.result);
    return res.status(200).json({ session: parsed });
  } catch (e) { console.error(e); return res.status(500).json({ error: e.message || String(e) }); }
};
