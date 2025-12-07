export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get session token from various possible headers
    const sessionToken = req.headers['x-session-token'] || 
                         req.headers.authorization?.replace('Bearer ', '') ||
                         req.headers.cookie?.match(/session_token=([^;]*)/)?.[1];
    
    console.log('Debug Auth - Method:', req.method);
    console.log('Debug Auth - Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Debug Auth - Session Token:', sessionToken);
    
    // Extract userId like the main API does
    function getUserIdFromToken(sessionToken) {
      if (sessionToken && sessionToken.startsWith('temp_')) {
        const parts = sessionToken.split('_');
        const username = parts.slice(2).join('_') || 'unknown';
        return username;
      }
      return 'unknown';
    }
    
    const userId = getUserIdFromToken(sessionToken);
    
    return res.json({
      success: true,
      debug: {
        sessionToken: sessionToken,
        userId: userId,
        headers: req.headers,
        hasToken: !!sessionToken,
        isValidToken: sessionToken && sessionToken.startsWith('temp_')
      }
    });
    
  } catch (error) {
    console.error('Debug Auth Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
}