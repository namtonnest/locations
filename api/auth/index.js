// User authentication and management API
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
    throw new Error('Missing Redis credentials. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

// Simple password hashing (use bcrypt in production)
function hashPassword(password) {
  return Buffer.from(password + process.env.PASSWORD_SALT || 'defaultsalt').toString('base64');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// Generate session token
function generateSessionToken() {
  return Buffer.from(Date.now() + Math.random().toString()).toString('base64');
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const redis = getRedis();
    const { action } = req.body || {};

    if (req.method === 'POST') {
      if (action === 'register') {
        const { username, password, email } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        // Check if user exists
        const existingUser = await redis.get(`user:${username}`);
        if (existingUser) {
          return res.status(400).json({ error: 'Username already exists' });
        }

        // Create user
        const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const hashedPassword = hashPassword(password);
        const user = {
          id: userId,
          username,
          email: email || '',
          passwordHash: hashedPassword,
          createdAt: new Date().toISOString(),
          savedStates: []
        };

        await redis.set(`user:${username}`, JSON.stringify(user));
        await redis.set(`userid:${userId}`, username);

        const sessionToken = generateSessionToken();
        await redis.setex(`session:${sessionToken}`, 86400 * 7, userId); // 7 days

        return res.json({ 
          success: true, 
          userId, 
          username,
          sessionToken,
          message: 'User created successfully' 
        });
      }

      if (action === 'login') {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        const userData = await redis.get(`user:${username}`);
        if (!userData) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = JSON.parse(userData);
        if (!verifyPassword(password, user.passwordHash)) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const sessionToken = generateSessionToken();
        await redis.setex(`session:${sessionToken}`, 86400 * 7, user.id); // 7 days

        return res.json({
          success: true,
          userId: user.id,
          username: user.username,
          sessionToken,
          message: 'Login successful'
        });
      }

      if (action === 'logout') {
        const { sessionToken } = req.body;
        if (sessionToken) {
          await redis.del(`session:${sessionToken}`);
        }
        return res.json({ success: true, message: 'Logged out' });
      }

      if (action === 'verify') {
        const { sessionToken } = req.body;
        if (!sessionToken) {
          return res.status(401).json({ error: 'No session token' });
        }

        const userId = await redis.get(`session:${sessionToken}`);
        if (!userId) {
          return res.status(401).json({ error: 'Invalid or expired session' });
        }

        const username = await redis.get(`userid:${userId}`);
        const userData = await redis.get(`user:${username}`);
        const user = JSON.parse(userData);

        return res.json({
          success: true,
          userId: user.id,
          username: user.username,
          email: user.email
        });
      }
    }

    if (req.method === 'GET') {
      const { sessionToken } = req.query;
      if (!sessionToken) {
        return res.status(401).json({ error: 'No session token' });
      }

      const userId = await redis.get(`session:${sessionToken}`);
      if (!userId) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const username = await redis.get(`userid:${userId}`);
      const userData = await redis.get(`user:${username}`);
      const user = JSON.parse(userData);

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          savedStates: user.savedStates || []
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = handler;