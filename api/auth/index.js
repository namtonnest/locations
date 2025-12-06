// Simplified User authentication API for debugging
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.body || {};

    // Test action that doesn't require Redis
    if (action === 'test') {
      return res.json({ 
        success: true, 
        message: 'API is working',
        envStatus: {
          hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
          hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
        }
      });
    }

    // For now, return a simple response for register/login
    if (req.method === 'POST') {
      if (action === 'register') {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        // Temporary mock response
        const sessionToken = `temp_${Date.now()}_${username}`;
        return res.json({ 
          success: true, 
          userId: `user_${Date.now()}`,
          username,
          sessionToken,
          message: 'Registration temporarily disabled - using mock response' 
        });
      }

      if (action === 'login') {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        // Temporary mock response
        const sessionToken = `temp_${Date.now()}_${username}`;
        return res.json({ 
          success: true, 
          userId: `user_${Date.now()}`,
          username,
          sessionToken,
          message: 'Login temporarily using mock response' 
        });
      }

      if (action === 'verify') {
        const sessionToken = req.body.sessionToken || req.headers.authorization?.replace('Bearer ', '');
        
        // For mock sessions, accept any token that starts with 'temp_'
        if (sessionToken && sessionToken.startsWith('temp_')) {
          // Extract username from session token (format: temp_timestamp_username)
          const parts = sessionToken.split('_');
          const username = parts.slice(2).join('_') || 'MockUser';
          
          return res.json({ 
            success: true, 
            userId: `user_mock`,
            username: username,
            message: 'Mock session valid' 
          });
        }
        
        return res.status(401).json({ error: 'Invalid session' });
      }

      if (action === 'logout') {
        // Mock logout - just return success
        return res.json({ success: true, message: 'Logged out successfully' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    });
  }
};