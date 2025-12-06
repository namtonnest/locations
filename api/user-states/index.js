// Simplified User-specific state management API
// Simple in-memory storage for mock functionality
const mockStates = {};

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

      // Mock successful save - store the actual state
      const stateId = `state_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Store the state in our mock storage
      mockStates[stateId] = {
        id: stateId,
        name: name,
        state: state,
        createdAt: new Date().toISOString()
      };
      
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
        const savedState = mockStates[id];
        if (savedState) {
          return res.json({
            success: true,
            state: savedState.state
          });
        } else {
          return res.json({
            success: false,
            error: 'State not found'
          });
        }
      } else {
        // List user states - return all saved states
        const statesList = Object.values(mockStates).map(state => ({
          id: state.id,
          name: state.name,
          createdAt: state.createdAt
        }));
        
        return res.json({
          success: true,
          states: statesList
        });
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'State ID required' });
      }

      if (mockStates[id]) {
        delete mockStates[id];
        return res.json({
          success: true,
          message: 'State deleted successfully'
        });
      } else {
        return res.json({
          success: false,
          error: 'State not found'
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