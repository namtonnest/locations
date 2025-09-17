// Backend endpoint for employee location tracking
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  const { employeeId, latitude, longitude } = data;
  if (!employeeId || typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({ error: 'Missing or invalid fields' });
    return;
  }
  // Save latest location and append to history
  await redis.set(`employee:${employeeId}:latest`, JSON.stringify({ latitude, longitude, ts: Date.now() }));
  await redis.lpush(`employee:${employeeId}:history`, JSON.stringify({ latitude, longitude, ts: Date.now() }));
  // Optionally trim history to last 100 marks
  await redis.ltrim(`employee:${employeeId}:history`, 0, 99);
  res.json({ ok: true });
}
