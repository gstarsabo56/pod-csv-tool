export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const CF_API_TOKEN = process.env.CF_API_TOKEN;

  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return res.status(500).json({ 
      success: false,
      error: 'CF credentials not configured. Add CF_ACCOUNT_ID and CF_API_TOKEN in Vercel Environment Variables.' 
    });
  }

  try {
    const endpoint = req.query.endpoint || 'stats';
    let cfUrl;

    if (endpoint === 'stats') {
      cfUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1/stats`;
    } else if (endpoint === 'upload') {
      cfUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid endpoint' });
    }

    const authHeader = `Bearer ${CF_API_TOKEN}`;

    if (req.method === 'POST' && endpoint === 'upload') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);

      const cfRes = await fetch(cfUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': req.headers['content-type'],
        },
        body: body,
      });
      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    const cfRes = await fetch(cfUrl, {
      headers: { 'Authorization': authHeader },
    });
    const data = await cfRes.json();
    return res.status(cfRes.status).json(data);

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export const config = { api: { bodyParser: false } };
