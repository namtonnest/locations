// User-specific state management API with Redis
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

function getUserIdFromToken(sessionToken) {
  // Extract username from session token (format: temp_timestamp_username)
  if (sessionToken && sessionToken.startsWith('temp_')) {
    const parts = sessionToken.split('_');
    const username = parts.slice(2).join('_') || 'unknown';
    return username;
  }
  return 'unknown';
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sessionToken = req.headers['x-session-token'] || req.headers.authorization?.replace('Bearer ', '');
    
    // For mock sessions, accept any token that starts with 'temp_'
    if (!sessionToken || !sessionToken.startsWith('temp_')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.method === 'POST') {
      // Save state
      const { name, state } = req.body;
      
      if (!name || !state) {
        return res.status(400).json({ error: 'Name and state required' });
      }

      try {
        const redis = getRedis();
        const userId = getUserIdFromToken(sessionToken);
        const stateId = `state_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Save state to Redis
        const stateData = {
          id: stateId,
          name: name,
          state: state,
          createdAt: new Date().toISOString(),
          userId: userId
        };
        
        await redis.set(`user_state:${userId}:${stateId}`, JSON.stringify(stateData));
        
        return res.json({
          success: true,
          id: stateId,
          message: 'State saved successfully',
          shareUrl: `${req.headers.origin || 'https://localhost'}?user_state_id=${stateId}`
        });
      } catch (error) {
        console.error('Failed to save state:', error);
        return res.status(500).json({ 
          error: 'Failed to save state',
          details: error.message 
        });
      }
    }

    if (req.method === 'GET') {
      const { id } = req.query;
      const userId = getUserIdFromToken(sessionToken);
      
      try {
        const redis = getRedis();
        
        if (id) {
          // Get specific state for this user
          const stateData = await redis.get(`user_state:${userId}:${id}`);
          if (stateData) {
            const parsedState = JSON.parse(stateData);
            return res.json({
              success: true,
              state: parsedState.state
            });
          } else {
            return res.json({
              success: false,
              error: 'State not found or not accessible'
            });
          }
        } else {
          // List user states - get all states for this user
          const pattern = `user_state:${userId}:*`;
          const keys = await redis.keys(pattern);
          
          const statesList = [];
          for (const key of keys) {
            try {
              const stateData = await redis.get(key);
              if (stateData) {
                const parsedState = JSON.parse(stateData);
                statesList.push({
                  id: parsedState.id,
                  name: parsedState.name,
                  createdAt: parsedState.createdAt
                });
              }
            } catch (e) {
              // Skip invalid entries
              continue;
            }
          }
          
          // Sort by creation date (newest first)
          statesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          return res.json({
            success: true,
            states: statesList
          });
        }
      } catch (error) {
        console.error('Failed to get states:', error);
        return res.status(500).json({ 
          error: 'Failed to retrieve states',
          details: error.message 
        });
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'State ID required' });
      }

      try {
        const redis = getRedis();
        const userId = getUserIdFromToken(sessionToken);
        const key = `user_state:${userId}:${id}`;
        
        const result = await redis.del(key);
        
        if (result > 0) {
          return res.json({
            success: true,
            message: 'State deleted successfully'
          });
        } else {
          return res.json({
            success: false,
            error: 'State not found or not accessible'
          });
        }
      } catch (error) {
        console.error('Failed to delete state:', error);
        return res.status(500).json({ 
          error: 'Failed to delete state',
          details: error.message 
        });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('User states error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};