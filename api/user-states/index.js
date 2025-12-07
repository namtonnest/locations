// User-specific state management API with Redis
let Redis;
try {
  const upstashModule = require('@upstash/redis');
  Redis = upstashModule.Redis;
  console.log('Redis module imported successfully');
} catch (importError) {
  console.error('Failed to import Redis module:', importError.message);
  // Create a dummy handler that returns the error
  module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: 'Redis module import failed',
      details: importError.message 
    });
  };
  return;
}

// Redis connection with error handling
let cachedRedis = null;
function getRedis() {
  if (cachedRedis) {
    try {
      // Test the connection
      return cachedRedis;
    } catch (e) {
      console.log('Cached Redis connection failed, creating new one:', e.message);
      cachedRedis = null;
    }
  }
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  console.log('Redis env check:', { hasUrl: !!url, hasToken: !!token });
  
  if (!url || !token) {
    throw new Error('Redis credentials not configured');
  }
  
  try {
    cachedRedis = new Redis({ 
      url, 
      token,
      retry: {
        retries: 3,
        delayMin: 100,
        delayMax: 1000
      }
    });
    console.log('Redis connection created successfully');
    return cachedRedis;
  } catch (redisError) {
    console.error('Failed to create Redis connection:', redisError.message);
    throw redisError;
  }
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
  let startTime, requestId;
  
  // Absolute safeguards - these must work no matter what
  try {
    startTime = Date.now();
    requestId = Math.random().toString(36).substring(7);
    
    // Immediate response capability setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Session-Token');
    
    console.log(`[${requestId}] Handler starting - ${new Date().toISOString()}`);
    
  } catch (criticalError) {
    // If even basic setup fails, return minimal response
    console.error('CRITICAL: Basic setup failed:', criticalError);
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ error: 'System initialization failed' });
    } catch (finalError) {
      console.error('FATAL: Cannot send response:', finalError);
      return;
    }
  }
  
  // OPTIONS handling
  try {
    if (req.method === 'OPTIONS') {
      console.log(`[${requestId}] OPTIONS handled`);
      return res.status(200).end();
    }
  } catch (optionsError) {
    console.error(`[${requestId}] OPTIONS failed:`, optionsError);
    return res.status(500).json({ 
      error: 'OPTIONS handling failed',
      requestId: requestId 
    });
  }
  
  // Basic request info gathering with safeguards
  try {
    console.log(`[${requestId}] Method: ${req.method}`);
    console.log(`[${requestId}] URL: ${req.url || 'unknown'}`);
    console.log(`[${requestId}] Query keys: ${req.query ? Object.keys(req.query).join(',') : 'none'}`);
  } catch (loggingError) {
    console.error(`[${requestId}] Logging failed:`, loggingError);
  }
  
  // Authentication with maximum safety
  let sessionToken;
  try {
    sessionToken = req.headers['x-session-token'] || req.headers.authorization?.replace('Bearer ', '') || null;
    console.log(`[${requestId}] Session token extraction: ${!!sessionToken}`);
    
    if (!sessionToken || !sessionToken.startsWith('temp_')) {
      console.log(`[${requestId}] Auth failed - token: ${sessionToken ? 'invalid' : 'missing'}`);
      return res.status(401).json({ 
        error: 'Authentication required',
        requestId: requestId 
      });
    }
    
  } catch (authError) {
    console.error(`[${requestId}] Auth processing failed:`, authError);
    return res.status(500).json({ 
      error: 'Authentication processing failed',
      requestId: requestId 
    });
  }

  // Main request processing
  try {
    console.log(`[${requestId}] Starting main processing`);

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
      console.log('[GET] Request query:', req.query);
      
      let userId;
      try {
        userId = getUserIdFromToken(sessionToken);
        console.log('[GET] Extracted userId:', userId);
      } catch (userIdError) {
        console.error('[GET] Error extracting userId:', userIdError.message);
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid session token format' 
        });
      }
      
      try {
        const redis = getRedis();
        console.log('[GET] Redis connection established');
        
        if (id) {
          console.log('[GET] Processing state ID:', id);
          console.log('[GET] User ID from token:', userId);
          
          // Validate state ID format
          if (typeof id !== 'string' || id.trim().length === 0) {
            console.error('[GET] Invalid state ID format:', typeof id, id);
            return res.status(400).json({
              success: false,
              error: 'Invalid state ID format'
            });
          }
          
          // Get specific state for this user
          let stateKey = `user_state:${userId}:${id}`;
          console.log('[GET] Retrieving specific state with key:', stateKey);
          
          let stateData = null;
          try {
            console.log(`[${requestId}] Attempting Redis GET for primary key`);
            // Add timeout protection for Redis operations
            const redisOperation = redis.get(stateKey);
            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Redis operation timeout')), 5000)
            );
            stateData = await Promise.race([redisOperation, timeout]);
            console.log(`[${requestId}] Redis GET completed:`, !!stateData);
          } catch (redisError) {
            console.error(`[${requestId}] Redis get error for primary key:`, redisError.message);
            if (redisError.message.includes('timeout')) {
              return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable - please try again',
                requestId: requestId
              });
            }
          }
          
          // If not found, try alternative user ID patterns (like we do in listing)
          if (!stateData) {
            console.log('[GET] State not found with primary key, trying alternatives...');
            
            try {
              if (userId && userId.includes('@')) {
                const usernameOnly = userId.split('@')[0];
                const altKey = `user_state:${usernameOnly}:${id}`;
                console.log(`[${requestId}] Trying alternative key:`, altKey);
                try {
                  const altOperation = redis.get(altKey);
                  const altTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Redis alt operation timeout')), 3000)
                  );
                  stateData = await Promise.race([altOperation, altTimeout]);
                  if (stateData) stateKey = altKey;
                } catch (redisError) {
                  console.error(`[${requestId}] Redis get error for alt key:`, redisError.message);
                }
              } else if (userId) {
                const emailKey = `user_state:${userId}@gmail.com:${id}`;
                console.log(`[${requestId}] Trying email key:`, emailKey);
                try {
                  const emailOperation = redis.get(emailKey);
                  const emailTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Redis email operation timeout')), 3000)
                  );
                  stateData = await Promise.race([emailOperation, emailTimeout]);
                  if (stateData) stateKey = emailKey;
                } catch (redisError) {
                  console.error(`[${requestId}] Redis get error for email key:`, redisError.message);
                }
              }
            } catch (altKeyError) {
              console.error(`[${requestId}] Error in alternative key processing:`, altKeyError.message);
            }
            
            console.log('[GET] Alternative key result:', !!stateData);
          }
          
          if (stateData) {
            try {
              const parsedState = JSON.parse(stateData);
              console.log(`[${requestId}] Parsed state keys:`, Object.keys(parsedState));
              
              // Safely log parsed state (avoid potential circular reference issues)
              try {
                console.log(`[${requestId}] State structure sample:`, Object.keys(parsedState).slice(0, 5));
              } catch (logError) {
                console.log(`[${requestId}] Could not log state structure:`, logError.message);
              }
              
              // Handle different possible state data structures with extra safety
              let actualState;
              
              try {
                if (parsedState.state && typeof parsedState.state === 'object') {
                  // New format: state is nested under 'state' property
                  actualState = parsedState.state;
                  console.log(`[${requestId}] Using nested state structure`);
                } else if (parsedState.mapCenter || parsedState.models || parsedState.zoom !== undefined) {
                  // Direct state format: the parsedState IS the state
                  actualState = parsedState;
                  console.log(`[${requestId}] Using direct state structure`);
                } else if (parsedState.id && parsedState.createdAt && Object.keys(parsedState).length > 3) {
                  // Wrapper format: extract everything except metadata
                  try {
                    const { id, createdAt, userId, name, ...stateData } = parsedState;
                    actualState = stateData;
                    console.log(`[${requestId}] Extracted state from wrapper structure`);
                  } catch (destructureError) {
                    console.error(`[${requestId}] Destructuring failed, using whole object:`, destructureError.message);
                    actualState = parsedState;
                  }
                } else {
                  // Fallback: try to use the whole thing
                  actualState = parsedState;
                  console.log(`[${requestId}] Using fallback - whole parsed data as state`);
                }
              } catch (structureError) {
                console.error(`[${requestId}] State structure processing failed:`, structureError.message);
                return res.json({
                  success: false,
                  error: 'State data structure error: ' + structureError.message,
                  requestId: requestId
                });
              }
              
              // Validate that we have something that looks like a map state
              if (!actualState || typeof actualState !== 'object') {
                console.error(`[${requestId}] Invalid state structure - not an object:`, typeof actualState);
                return res.json({
                  success: false,
                  error: 'Invalid state data format - not an object',
                  requestId: requestId
                });
              }
              
              console.log(`[${requestId}] Final state keys:`, Object.keys(actualState).slice(0, 10));
              console.log(`[${requestId}] Returning state with mapCenter:`, !!actualState.mapCenter);
              
              // Safely create response
              try {
                const response = {
                  success: true,
                  state: actualState
                };
                console.log(`[${requestId}] Successful response prepared`);
                return res.json(response);
              } catch (responseError) {
                console.error(`[${requestId}] Response creation failed:`, responseError.message);
                return res.json({
                  success: false,
                  error: 'Response generation error: ' + responseError.message,
                  requestId: requestId
                });
              }
            } catch (e) {
              console.error('[GET] Error parsing state data:', e.message);
              console.error('[GET] Stack trace:', e.stack);
              console.error('[GET] Raw state data (first 500 chars):', stateData.substring(0, 500));
              return res.json({
                success: false,
                error: 'Invalid state data format: ' + e.message
              });
            }
          } else {
            console.log(`[${requestId}] No state found for any key pattern`);
            return res.json({
              success: false,
              error: 'State not found or not accessible',
              requestId: requestId
            });
          }
        } else {
          // List user states - get all states for this user
          console.log(`[${requestId}] Starting states listing for userId:`, userId);
          console.log(`[${requestId}] Session token:`, sessionToken ? 'present' : 'missing');
          
          try {
            const pattern = `user_state:${userId}:*`;
            console.log(`[${requestId}] Redis pattern:`, pattern);
            let keys = await redis.keys(pattern);
            console.log(`[${requestId}] Found keys for main pattern:`, keys.length);
            
            // Also try pattern without @ in case there's an email mismatch
            if (userId.includes('@')) {
              const usernameOnly = userId.split('@')[0];
              const altPattern = `user_state:${usernameOnly}:*`;
              console.log(`[${requestId}] Trying alternative pattern:`, altPattern);
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
                  console.log('[LIST] Raw data (first 200 chars):', stateData.substring(0, 200));
                  // Try to add a broken state indicator
                  const keyParts = key.split(':');
                  const stateId = keyParts[keyParts.length - 1];
                  statesList.push({
                    id: stateId,
                    name: 'Corrupted State Data',
                    createdAt: new Date().toISOString(),
                    error: true,
                    errorType: 'parse'
                  });
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
              console.error('[LIST] Stack trace:', e.stack);
              // Try to add at least something for this key
              try {
                const keyParts = key.split(':');
                const stateId = keyParts[keyParts.length - 1];
                statesList.push({
                  id: stateId,
                  name: 'Error Loading State',
                  createdAt: new Date().toISOString(),
                  error: true,
                  errorType: 'processing',
                  errorMessage: e.message
                });
                console.log('[LIST] Added error placeholder for key:', key);
              } catch (fallbackError) {
                console.error('[LIST] Even fallback failed for key:', key, fallbackError.message);
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
          } catch (listingError) {
            console.error(`[${requestId}] Error during states listing:`, listingError.message);
            throw listingError;
          }
        }
      } catch (error) {
        console.error(`[${requestId}] Failed to get states:`, error.message);
        console.error(`[${requestId}] Error stack:`, error.stack);
        console.error(`[${requestId}] Error details:`, {
          name: error.name,
          cause: error.cause,
          code: error.code
        });
        
        return res.status(500).json({ 
          error: 'Failed to retrieve states',
          details: error.message,
          requestId: requestId
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
    const duration = startTime ? Date.now() - startTime : 0;
    console.error(`[${requestId || 'unknown'}] ERROR after ${duration}ms:`, error.message);
    console.error(`[${requestId || 'unknown'}] Stack trace:`, error.stack);
    
    try {
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message,
        requestId: requestId || 'unknown'
      });
    } catch (finalError) {
      console.error('Cannot send error response:', finalError);
    }
  }
};