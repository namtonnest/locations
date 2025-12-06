// User-specific state management API
const { Redis } = require('@upstash/redis');

let cachedRedis = null;

function normalizeUpstashUrl(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (raw.startsWith('redis-cli')) {
    const m = raw.match(/-u\s+([^\s]+)/);
    if (m) raw = m[1];
  }
  return raw;
}

function getRedis() {
  if (cachedRedis) return cachedRedis;
  const url = normalizeUpstashUrl(process.env.UPSTASH_REDIS_REST_URL);
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Missing Redis credentials');
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

async function getUserFromSession(sessionToken) {
  if (!sessionToken) return null;
  const redis = getRedis();
  const userId = await redis.get(`session:${sessionToken}`);
  if (!userId) return null;
  
  const username = await redis.get(`userid:${userId}`);
  const userData = await redis.get(`user:${username}`);
  return userData ? JSON.parse(userData) : null;
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
    const redis = getRedis();
    
    // Get session token from header or body
    const sessionToken = req.headers['x-session-token'] || req.body?.sessionToken || req.query?.sessionToken;
    
    // Verify user authentication
    const user = await getUserFromSession(sessionToken);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.method === 'POST') {
      // Save a new state for this user
      const { state, name } = req.body;
      if (!state) {
        return res.status(400).json({ error: 'State data required' });
      }

      // Use dynamic import for nanoid since it's ESM only
      const { nanoid } = await import('nanoid');
      const stateId = nanoid(8);
      
      const stateRecord = {
        id: stateId,
        userId: user.id,
        username: user.username,
        name: name || 'Unnamed State',
        state: state,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save the state
      await redis.set(`userstate:${user.id}:${stateId}`, JSON.stringify(stateRecord));
      
      // Update user's state list
      const userKey = `user:${user.username}`;
      user.savedStates = user.savedStates || [];
      user.savedStates.unshift({
        id: stateId,
        name: name || 'Unnamed State',
        createdAt: stateRecord.createdAt
      });
      // Keep only latest 100 states
      user.savedStates = user.savedStates.slice(0, 100);
      await redis.set(userKey, JSON.stringify(user));

      return res.json({ 
        success: true, 
        id: stateId,
        message: 'State saved successfully'
      });
    }

    if (req.method === 'GET') {
      const { stateId } = req.query;

      if (stateId) {
        // Get specific state
        const stateData = await redis.get(`userstate:${user.id}:${stateId}`);
        if (!stateData) {
          return res.status(404).json({ error: 'State not found' });
        }

        const stateRecord = JSON.parse(stateData);
        return res.json({ 
          success: true, 
          state: stateRecord.state,
          name: stateRecord.name,
          createdAt: stateRecord.createdAt
        });
      } else {
        // List all states for this user
        const userStates = user.savedStates || [];
        return res.json({
          success: true,
          states: userStates,
          username: user.username
        });
      }
    }

    if (req.method === 'DELETE') {
      const { stateId } = req.body;
      if (!stateId) {
        return res.status(400).json({ error: 'State ID required' });
      }

      // Delete the state
      await redis.del(`userstate:${user.id}:${stateId}`);
      
      // Update user's state list
      const userKey = `user:${user.username}`;
      user.savedStates = (user.savedStates || []).filter(s => s.id !== stateId);
      await redis.set(userKey, JSON.stringify(user));

      return res.json({ 
        success: true, 
        message: 'State deleted successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('User states error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};