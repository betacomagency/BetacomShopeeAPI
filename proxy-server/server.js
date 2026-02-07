const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3456;
const SECRET = process.env.PROXY_SECRET || '';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Proxy-Secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ip: '76.13.180.121' }));
    return;
  }

  // Verify secret if configured
  if (SECRET && req.headers['x-proxy-secret'] !== SECRET) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  // Extract target URL from query parameter
  const parsed = url.parse(req.url, true);
  const targetUrl = parsed.query.url;

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
    return;
  }

  // Only allow Shopee API calls
  if (!targetUrl.startsWith('https://partner.shopeemobile.com/')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only Shopee API URLs allowed' }));
    return;
  }

  console.log(`[proxy] ${req.method} -> ${targetUrl}`);

  // Collect request body
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const targetParsed = url.parse(targetUrl);
    const options = {
      hostname: targetParsed.hostname,
      port: 443,
      path: targetParsed.path,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && req.method === 'POST') {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const proxyReq = https.request(options, (proxyRes) => {
      let responseBody = '';
      proxyRes.on('data', (chunk) => { responseBody += chunk; });
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(responseBody);
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy] Error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
    });

    if (body && req.method === 'POST') {
      proxyReq.write(body);
    }

    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`[proxy] Shopee Proxy Server running on port ${PORT}`);
  console.log(`[proxy] Health check: http://localhost:${PORT}/health`);
});
