// Simple in-memory store for demo purposes
const locations = [];

export default async function handler(req, res) {
  // CORS headers for all requests (set first)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method === 'POST') {
    const { name, lat, lng, timestamp } = req.body;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number' || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    locations.push({ name, lat, lng, timestamp });
    return res.status(200).json({ success: true });
  }
  if (req.method === 'GET') {
    // Return all tracked locations
    return res.status(200).json({ locations });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
