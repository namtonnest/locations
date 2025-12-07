// Debug endpoint to test getUserIdFromToken function
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sessionToken = req.headers['x-session-token'] || req.body?.sessionToken || req.query.token;
    
    if (!sessionToken) {
      return res.status(400).json({ error: 'No session token provided' });
    }

    const userId = getUserIdFromToken(sessionToken);
    const parts = sessionToken.split('_');

    return res.json({
      success: true,
      sessionToken: sessionToken,
      extractedUserId: userId,
      tokenParts: parts,
      analysis: {
        isValidFormat: sessionToken.startsWith('temp_'),
        partsCount: parts.length,
        timestampPart: parts[1],
        usernamePart: parts.slice(2).join('_')
      }
    });
    
  } catch (error) {
    console.error('Token debug error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze token',
      details: error.message 
    });
  }
};