export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const requestInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      cookies: req.headers.cookie,
      userAgent: req.headers['user-agent'],
      sessionToken: req.headers['x-session-token'] || req.headers.authorization?.replace('Bearer ', ''),
    };

    console.log('Debug request info:', JSON.stringify(requestInfo, null, 2));

    return res.json({
      success: true,
      message: 'Request captured successfully',
      requestInfo: requestInfo
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}