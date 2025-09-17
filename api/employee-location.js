// api/employee-location.js
// Receives employee location data via POST

let employeeLocations = [];

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, lat, lng, timestamp } = req.body;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number' || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    // Store location (in-memory for now)
    employeeLocations.push({ name, lat, lng, timestamp });
    return res.status(200).json({ success: true });
  }
  // Optionally, allow GET to fetch all locations
  if (req.method === 'GET') {
    return res.status(200).json({ locations: employeeLocations });
  }
  res.status(405).json({ error: 'Method not allowed.' });
}
