// MOVED: api/publish.js
// Disabled to reduce number of serverless functions deployed to Vercel.
// To restore, move this file back into api/.

module.exports = function handler(req, res) {
  res.status(410).json({ error: 'Endpoint disabled in this deployment. Restore file from api_disabled/ if needed.' });
};
