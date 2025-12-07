// Debug endpoint to inspect raw Redis data
const { Redis } = require('@upstash/redis');

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis credentials not configured');
  return new Redis({ url, token });
}

function getUserIdFromToken(sessionToken) {
  if (sessionToken && sessionToken.startsWith('temp_')) {
    const parts = sessionToken.split('_');
    return parts.slice(2).join('_') || 'unknown';
  }
  return 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Session-Token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.headers['x-session-token'];
    const { stateId } = req.query;
    
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token required' });
    }
    
    const redis = getRedis();
    const userId = getUserIdFromToken(sessionToken);
    
    if (stateId) {
      // Inspect specific state
      const key = `user_state:${userId}:${stateId}`;
      const rawData = await redis.get(key);
      
      let parsedData = null;
      let parseError = null;
      try {
        parsedData = rawData ? JSON.parse(rawData) : null;
      } catch (e) {
        parseError = e.message;
      }
      
      return res.json({
        success: true,
        userId,
        stateId,
        key,
        rawDataExists: !!rawData,
        rawDataType: typeof rawData,
        rawDataLength: rawData ? String(rawData).length : 0,
        rawDataPreview: rawData ? String(rawData).substring(0, 200) + '...' : null,
        parsedData,
        parseError
      });
    } else {
      // List all keys for this user
      const pattern = `user_state:${userId}:*`;
      const keys = await redis.keys(pattern);
      
      const keyDetails = [];
      for (const key of keys.slice(0, 5)) { // Only check first 5 keys
        try {
          const rawData = await redis.get(key);
          keyDetails.push({
            key,
            hasData: !!rawData,
            dataType: typeof rawData,
            dataLength: rawData ? String(rawData).length : 0,
            dataStructure: rawData ? Object.keys(JSON.parse(rawData)) : null
          });
        } catch (e) {
          keyDetails.push({
            key,
            error: e.message
          });
        }
      }
      
      return res.json({
        success: true,
        userId,
        pattern,
        totalKeys: keys.length,
        allKeys: keys,
        keyDetails
      });
    }
    
  } catch (error) {
    console.error('Inspect error:', error);
    return res.status(500).json({ 
      error: 'Failed to inspect Redis data',
      details: error.message 
    });
  }
};