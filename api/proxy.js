const backend = new URL('https://xposure-hub-inspections.wandggroup.chatgpt.site');

export default async function proxy(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Unsupported method');
  }

  const { upstreamPath, ...query } = req.query;
  if (typeof upstreamPath !== 'string' || !/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(upstreamPath)) {
    return res.status(404).send('API endpoint not found');
  }

  const upstream = new URL('/api/' + upstreamPath, backend);
  for (const [name, values] of Object.entries(query)) {
    for (const value of [].concat(values)) upstream.searchParams.append(name, value);
  }

  const headers = {};
  if (req.headers['x-business-id']) headers['X-Business-ID'] = req.headers['x-business-id'];
  const cookies = (req.headers.cookie || '').split(';').map(part => part.trim())
    .filter(part => part.startsWith('xh_access=') || part.startsWith('xh_refresh='));
  if (cookies.length) headers.Cookie = cookies.join('; ');

  let body;
  if (req.method === 'POST') {
    const protocol = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
    if (req.headers.origin !== protocol + '://' + req.headers.host
        || !req.headers['content-type']?.startsWith('application/json')) {
      return res.status(403).send('Invalid request origin');
    }
    headers.Origin = backend.origin;
    headers['Content-Type'] = 'application/json';
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const response = await fetch(upstream, {
      method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000)
    });
    if (response.status >= 300 && response.status < 400) {
      return res.status(502).send('Unexpected redirect from inspection service');
    }
    const type = response.headers.get('content-type');
    if (type) res.setHeader('Content-Type', type);
    const sessions = response.headers.getSetCookie()
      .filter(cookie => cookie.startsWith('xh_access=') || cookie.startsWith('xh_refresh='));
    if (sessions.length) res.setHeader('Set-Cookie', sessions);
    return res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
  } catch {
    return res.status(502).send('The inspection service is temporarily unavailable.');
  }
}
