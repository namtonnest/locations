// Simple image proxy for Vercel serverless functions
// Usage: /api/image-proxy?url={encodeURIComponent(imageUrl)}
// Returns the remote image with CORS headers so canvas.drawImage can access it.

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    // get ?url= param (works with both query object and direct parsing)
    let target = (req.query && req.query.url) || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('url'));
    if (!target) {
      res.statusCode = 400;
      res.end('Missing url parameter');
      return;
    }
    try { target = decodeURIComponent(target); } catch (e) { /* ignore */ }

    // basic validation: only http(s)
    if (!/^https?:\/\//i.test(target)) {
      res.statusCode = 400;
      res.end('Invalid URL scheme');
      return;
    }

    // Fetch the upstream image using global fetch (Node 18+ / Vercel environment)
    const upstream = await fetch(target, { method: 'GET' });
    if (!upstream.ok) {
      res.statusCode = 502;
      res.end('Upstream fetch failed: ' + upstream.status);
      return;
    }

    // Stream response back with content-type and CORS headers
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.statusCode = 200;
    res.end(buffer);
  } catch (err) {
    console.error('image-proxy error', err);
    res.statusCode = 500;
    res.end('Internal proxy error');
  }
};
