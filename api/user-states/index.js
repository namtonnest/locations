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
    
    console.log('User-states API called:', req.method, 'Token:', sessionToken ? sessionToken.substring(0, 15) + '...' : 'None');
    
    // For mock sessions, accept any token that starts with 'temp_'
    if (!sessionToken || !sessionToken.startsWith('temp_')) {
      console.log('Authentication failed: invalid token');
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.method === 'POST') {
      // Save state
      const { name, state } = req.body;
      
      if (!state) {
        return res.status(400).json({ error: 'State is required' });
      }

      try {
        const redis = getRedis();
        const userId = getUserIdFromToken(sessionToken);
        const stateId = `state_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        console.log('[SAVE] Saving state for user:', userId, 'with ID:', stateId);
        console.log('[SAVE] Session token:', sessionToken);
        console.log('[SAVE] Extracted userId:', userId);
        
        // Save state to Redis
        const stateData = {
          id: stateId,
          name: name || 'Unnamed State',
          state: state,
          createdAt: new Date().toISOString(),
          userId: userId
        };
        
        const redisKey = `user_state:${userId}:${stateId}`;
        console.log('[SAVE] Redis key:', redisKey);
        console.log('[SAVE] State data:', JSON.stringify(stateData, null, 2));
        
        await redis.set(redisKey, JSON.stringify(stateData));
        
        console.log('[SAVE] State saved successfully to Redis');
        
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
          const stateKey = `user_state:${userId}:${id}`;
          console.log('[GET] Retrieving specific state with key:', stateKey);
          
          const stateData = await redis.get(stateKey);
          console.log('[GET] Raw state data found:', !!stateData);
          
          if (stateData) {
            try {
              const parsedState = JSON.parse(stateData);
              console.log('[GET] Parsed state structure:', Object.keys(parsedState));
              
              // Return the actual state data - could be nested under 'state' property
              let actualState = parsedState.state || parsedState;
              
              return res.json({
                success: true,
                state: actualState
              });
            } catch (e) {
              console.error('[GET] Error parsing state data:', e.message);
              return res.json({
                success: false,
                error: 'Invalid state data format'
              });
            }
          } else {
            console.log('[GET] No state found for key:', stateKey);
            return res.json({
              success: false,
              error: 'State not found or not accessible'
            });
          }
        } else {
          // List user states - get all states for this user
          console.log('[LIST] Listing states for userId:', userId);
          console.log('[LIST] Session token:', sessionToken);
          const pattern = `user_state:${userId}:*`;
          console.log('[LIST] Redis pattern:', pattern);
          let keys = await redis.keys(pattern);
          console.log('[LIST] Found keys for main pattern:', keys);
          
          // Also try pattern without @ in case there's an email mismatch
          if (userId.includes('@')) {
            const usernameOnly = userId.split('@')[0];
            const altPattern = `user_state:${usernameOnly}:*`;
            console.log('[LIST] Trying alternative pattern:', altPattern);
            const altKeys = await redis.keys(altPattern);
            console.log('[LIST] Found keys for alt pattern:', altKeys);
            keys = [...keys, ...altKeys];
          } else {
            // Try with email domain if current userId doesn't have @
            const emailPattern = `user_state:${userId}@gmail.com:*`;
            console.log('[LIST] Trying email pattern:', emailPattern);
            const emailKeys = await redis.keys(emailPattern);
            console.log('[LIST] Found keys for email pattern:', emailKeys);
            keys = [...keys, ...emailKeys];
          }
          
          // Remove duplicates
          keys = [...new Set(keys)];
          console.log('[LIST] All unique keys found:', keys);
          
          // For debugging, also try to get some sample keys
          const allKeys = await redis.keys('user_state:*');
          console.log('[LIST] All user_state keys in Redis:', allKeys);
          
          const statesList = [];
          for (const key of keys) {
            try {
              console.log('[LIST] Processing key:', key);
              const stateData = await redis.get(key);
              console.log('[LIST] Raw data for key', key, ':', stateData ? 'DATA FOUND' : 'NO DATA');
              
              if (stateData) {
                let parsedState;
                try {
                  parsedState = JSON.parse(stateData);
                  console.log('[LIST] Parsed state keys:', Object.keys(parsedState));
                } catch (parseError) {
                  console.error('[LIST] Failed to parse JSON for key', key, ':', parseError.message);
                  console.log('[LIST] Raw data:', stateData.substring(0, 200));
                  continue;
                }
                
                // Handle different possible state structures more robustly
                let stateInfo;
                const keyParts = key.split(':');
                const stateId = keyParts[keyParts.length - 1]; // Last part of key
                
                // Try multiple extraction patterns
                if (parsedState.id && parsedState.name !== undefined && parsedState.createdAt) {
                  // New format: has id, name, createdAt directly
                  stateInfo = {
                    id: parsedState.id,
                    name: parsedState.name || 'Unnamed State',
                    createdAt: parsedState.createdAt
                  };
                } else if (parsedState.state) {
                  // Format where actual state is nested - extract metadata
                  stateInfo = {
                    id: stateId,
                    name: parsedState.name || parsedState.state.name || 'Unnamed State',
                    createdAt: parsedState.createdAt || parsedState.timestamp || new Date().toISOString()
                  };
                } else if (parsedState.mapCenter || parsedState.models || parsedState.zoom !== undefined) {
                  // Direct state data without wrapper - generate metadata
                  stateInfo = {
                    id: stateId,
                    name: parsedState.name || 'Unnamed State', 
                    createdAt: new Date().toISOString()
                  };
                } else {
                  // Try to extract anything useful
                  const extractedName = parsedState.name || 
                                      (typeof parsedState.state === 'object' && parsedState.state.name) ||
                                      'Unnamed State';
                  stateInfo = {
                    id: stateId,
                    name: extractedName,
                    createdAt: parsedState.createdAt || 
                              parsedState.timestamp ||
                              new Date().toISOString()
                  };
                  console.log('[LIST] Fallback extraction for unknown structure:', stateInfo);
                }
                
                statesList.push(stateInfo);
                console.log('[LIST] Added state to list:', stateInfo.id, stateInfo.name);
              } else {
                console.log('[LIST] No data found for key:', key);
              }
            } catch (e) {
              console.error('[LIST] Error processing key', key, ':', e.message);
              // Try to add at least something for this key
              try {
                const keyParts = key.split(':');
                const stateId = keyParts[keyParts.length - 1];
                statesList.push({
                  id: stateId,
                  name: 'Error Loading State',
                  createdAt: new Date().toISOString(),
                  error: true
                });
                console.log('[LIST] Added error placeholder for key:', key);
              } catch (fallbackError) {
                console.error('[LIST] Even fallback failed for key:', key);
              }
            }
          }
          
          // Sort by creation date (newest first)
          statesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          console.log('[LIST] Final states list:', statesList);
          console.log('[LIST] Returning', statesList.length, 'states');
          
          return res.json({
            success: true,
            states: statesList,
            debug: {
              userId: userId,
              pattern: pattern,
              keysFound: keys.length,
              allUserStateKeys: await redis.keys('user_state:*')
            }
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