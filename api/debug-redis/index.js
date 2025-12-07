// Debug endpoint to check Redis keys
const { Redis } = require('@upstash/redis');

// Redis connection with error handling
let cachedRedis = null;
function getRedis() {
  if (cachedRedis) return cachedRedis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis credentials not configured');
  }
  
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    
    // Get all keys that start with user_state:
    const allUserStateKeys = await redis.keys('user_state:*');
    
    // Also get all keys to see what's in redis
    const allKeys = await redis.keys('*');
    
    return res.json({
      success: true,
      allKeys: allKeys,
      userStateKeys: allUserStateKeys,
      totalKeys: allKeys.length,
      userStateKeysCount: allUserStateKeys.length
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ 
      error: 'Failed to check Redis',
      details: error.message 
    });
  }
};