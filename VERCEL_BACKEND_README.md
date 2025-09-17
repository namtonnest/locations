Vercel serverless backend for short state IDs (Upstash Redis)

What this provides
- POST /api/state -> create a short 8-char id. Request body: { state: <object> }. Response: { id: 'abcd1234' }
- GET /api/state/:id -> retrieve stored state. Response: { state: <object> }

How to deploy
1. Create an Upstash Redis database (https://upstash.com) and note the REST URL and REST token.
2. In your Vercel project settings, add two Environment Variables:
   - UPSTASH_REDIS_REST_URL (the REST URL from Upstash)
   - UPSTASH_REDIS_REST_TOKEN (the REST token)

3. Ensure the following dependencies are installed in the project (run locally before deploying):

   npm install nanoid @upstash/redis

4. Deploy to Vercel (push to GitHub and import project into Vercel or use Vercel CLI).

Usage from your frontend
- Save (POST): POST to https://<your-vercel-app>/api/state with JSON { state: <yourStateObject> } — response contains { id }
- Load (GET): GET https://<your-vercel-app>/api/state/<id> — response contains { state }

Notes & recommendations
- The code stores JSON as a string in Redis. If you expect very large payloads (> few hundred KB), consider storing in S3 and saving the S3 key instead.
- Add rate-limiting / abuse protections if you expect public write access.
- Optionally set key expiry by uncommenting the expire call in api/state/index.js.
- Keep Upstash credentials secret — use Vercel environment variables (do not embed in frontend).

Example: set BACKEND_STATE_ENDPOINT in your frontend to
https://<your-vercel-app>.vercel.app/api/state

That's it — once deployed, the frontend will POST state and receive a short 8-char id for compact share URLs.
