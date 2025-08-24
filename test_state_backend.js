// Simple local tester for the Vercel state API using Upstash (requires env vars)
// Usage: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment and run:
// node test_state_backend.js

const fetch = require('node-fetch');
const urlBase = process.env.BACKEND_STATE_ENDPOINT || ''; // e.g. https://your-app.vercel.app/api/state

if (!urlBase) {
  console.error('Set BACKEND_STATE_ENDPOINT env var to your deployed Vercel endpoint (https://.../api/state)');
  process.exit(1);
}

(async () => {
  try {
    const state = { hello: 'world', ts: Date.now() };
    const res = await fetch(urlBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
    const j = await res.json();
    console.log('POST response:', j);
    if (!j.id) return;
    const id = j.id;
    const g = await fetch(urlBase + '/' + id);
    console.log('GET status', g.status);
    console.log('GET body', await g.json());
  } catch (e) { console.error('Test failed', e); }
})();
