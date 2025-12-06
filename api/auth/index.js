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
        return res.json({ 
          success: true, 
          userId: `user_${Date.now()}`,
          username,
          sessionToken: `temp_${Date.now()}`,
          message: 'Registration temporarily disabled - using mock response' 
        });
      }

      if (action === 'login') {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password required' });
        }

        // Temporary mock response
        return res.json({ 
          success: true, 
          userId: `user_${Date.now()}`,
          username,
          sessionToken: `temp_${Date.now()}`,
          message: 'Login temporarily using mock response' 
        });
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