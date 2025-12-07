export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { Redis } = require('@upstash/redis');
    const redis = Redis.fromEnv();
    
    const { id, user } = req.query;
    
    if (!id) {
      return res.json({ error: 'State ID required' });
    }
    
    console.log('Diagnosing state ID:', id, 'for user:', user);
    
    // Try different key patterns
    const patterns = [
      `user_state:${user}:${id}`,
      `user_state:${user}@gmail.com:${id}`,
      `user_state:${user?.split('@')[0]}:${id}`,
      `user_state:namton@gmail.com:${id}`,
      `user_state:namton:${id}`
    ];
    
    const results = {};
    
    for (const pattern of patterns) {
      try {
        const data = await redis.get(pattern);
        results[pattern] = {
          exists: !!data,
          dataType: typeof data,
          dataLength: data ? data.length : 0,
          firstChars: data ? data.substring(0, 100) : null
        };
        
        if (data) {
          try {
            const parsed = JSON.parse(data);
            results[pattern].parseable = true;
            results[pattern].keys = Object.keys(parsed);
            results[pattern].structure = {
              hasId: !!parsed.id,
              hasName: !!parsed.name,
              hasState: !!parsed.state,
              hasCreatedAt: !!parsed.createdAt,
              hasMapCenter: !!(parsed.mapCenter || (parsed.state && parsed.state.mapCenter))
            };
          } catch (e) {
            results[pattern].parseable = false;
            results[pattern].parseError = e.message;
          }
        }
      } catch (e) {
        results[pattern] = { error: e.message };
      }
    }
    
    // Also check what keys exist with this state ID
    const allKeys = await redis.keys(`*${id}*`);
    
    return res.json({
      stateId: id,
      userId: user,
      patterns: results,
      relatedKeys: allKeys,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Diagnostic error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}