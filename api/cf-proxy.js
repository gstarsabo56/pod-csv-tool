// Vercel Serverless Function — proxy requests to Cloudflare Images API
// Reads CF credentials from environment variables (set in Vercel dashboard)
//
// Deployed at: https://<your-project>.vercel.app/api/cf-proxy
//
// Browser → this proxy → Cloudflare API → browser
// Solves CORS + hides the API token from client code.

export default async function handler(req, res) {
  // CORS headers — allow browser to call this proxy from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-action');

  // Preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Read credentials from env vars (NOT from client — security)
  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const CF_TOKEN = process.env.CF_TOKEN;

  if (!CF_ACCOUNT_ID || !CF_TOKEN) {
    return res.status(500).json({
      success: false,
      errors: [{ message: 'Server not configured: CF_ACCOUNT_ID or CF_TOKEN env vars missing in Vercel' }]
    });
  }

  try {
    // Action determined by query param: ?action=test | upload
    const action = (req.query.action || '').toLowerCase();

    // TEST: lightweight call to verify credentials work
    if (action === 'test' || req.method === 'GET') {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1?per_page=1`,
        { headers: { 'Authorization': `Bearer ${CF_TOKEN}` } }
      );
      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    // UPLOAD: POST with body {url, id} — forward to CF as multipart form
    if (req.method === 'POST') {
      const body = req.body || {};
      const imageUrl = body.url;
      const customId = body.id || `pod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      if (!imageUrl) {
        return res.status(400).json({ success: false, errors: [{ message: 'Missing url in body' }] });
      }

      // Build multipart form
      const fd = new FormData();
      fd.append('url', imageUrl);
      fd.append('id', customId);

      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
          body: fd
        }
      );
      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    return res.status(405).json({ success: false, errors: [{ message: 'Method not allowed' }] });
  } catch (err) {
    return res.status(500).json({
      success: false,
      errors: [{ message: err.message || 'Proxy error' }]
    });
  }
}
