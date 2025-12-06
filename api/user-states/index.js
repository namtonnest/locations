// Simplified User-specific state management API
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

      // Mock successful save
      const stateId = `state_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      return res.json({
        success: true,
        id: stateId,
        message: 'State saved successfully (mock)',
        shareUrl: `${req.headers.origin || 'https://localhost'}?user_state_id=${stateId}`
      });
    }

    if (req.method === 'GET') {
      const { id } = req.query;
      
      if (id) {
        // Get specific state
        return res.json({
          success: true,
          state: {
            name: 'Mock Saved State',
            mapCenter: [-79.3832, 43.6532],
            zoom: 15,
            pitch: 45,
            bearing: -17.6,
            models: [],
            draws: []
          }
        });
      } else {
        // List user states
        return res.json({
          success: true,
          states: [
            {
              id: 'mock_state_1',
              name: 'Mock State 1',
              createdAt: new Date().toISOString()
            }
          ]
        });
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'State ID required' });
      }

      return res.json({
        success: true,
        message: 'State deleted successfully (mock)'
      });
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