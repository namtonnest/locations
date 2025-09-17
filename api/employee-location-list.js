// Backend endpoint to list all employee latest locations
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // Find all keys matching employee:*:latest
  const keys = await redis.keys('employee:*:latest');
  const values = await redis.mget(...keys);
  const employees = keys.map((k, i) => {
    const id = k.replace(/^employee:/, '').replace(/:latest$/, '');
    let loc = null;
    try { loc = JSON.parse(values[i]); } catch (e) { loc = values[i]; }
    return { id, ...loc };
  }).filter(e => e && e.latitude && e.longitude);
  res.json({ employees });
}
