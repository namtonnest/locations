// User profile management system
const users = [];
const userSessions = new Map(); // Simple session storage

export default async function handler(req, res) {
  // CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { action, username, email, password, modelId, profileData } = req.body;

    if (action === 'register') {
      // Register new user
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if user already exists
      const existingUser = users.find(u => u.username === username || u.email === email);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const newUser = {
        id: Date.now().toString(),
        username,
        email,
        password, // In production, hash this!
        modelId: modelId || null,
        createdAt: new Date().toISOString(),
        lastLocation: null,
        profileData: profileData || {}
      };

      users.push(newUser);
      return res.status(201).json({ 
        success: true, 
        userId: newUser.id,
        message: 'User registered successfully' 
      });
    }

    if (action === 'login') {
      // Login user
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Create simple session token
      const sessionToken = `session_${user.id}_${Date.now()}`;
      userSessions.set(sessionToken, {
        userId: user.id,
        username: user.username,
        createdAt: Date.now()
      });

      return res.status(200).json({
        success: true,
        sessionToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          modelId: user.modelId,
          profileData: user.profileData
        }
      });
    }

    if (action === 'updateLocation') {
      // Update user's GPS location
      const { sessionToken, lat, lng } = req.body;
      
      if (!sessionToken || !lat || !lng) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const session = userSessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const user = users.find(u => u.id === session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.lastLocation = {
        lat,
        lng,
        timestamp: new Date().toISOString()
      };

      return res.status(200).json({ success: true, message: 'Location updated' });
    }

    if (action === 'linkModel') {
      // Link user to a specific model
      const { sessionToken, modelId } = req.body;
      
      if (!sessionToken || !modelId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const session = userSessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const user = users.find(u => u.id === session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.modelId = modelId;
      return res.status(200).json({ success: true, message: 'Model linked successfully' });
    }
  }

  if (req.method === 'GET') {
    const { sessionToken, action } = req.query;

    if (action === 'profile' && sessionToken) {
      // Get user profile
      const session = userSessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const user = users.find(u => u.id === session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          modelId: user.modelId,
          lastLocation: user.lastLocation,
          profileData: user.profileData
        }
      });
    }

    if (action === 'all') {
      // Get all users (admin only - simplified for demo)
      return res.status(200).json({
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          modelId: u.modelId,
          lastLocation: u.lastLocation,
          createdAt: u.createdAt
        }))
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}