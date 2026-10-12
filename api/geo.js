// Tells the page which country the visitor is in, so the site can open in that country's language.
// It only repeats the country header that Vercel adds to every request (x-vercel-ip-country) as {country}.
// The IP address is never read, logged or stored, and nothing is cached: each answer is for one visitor.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    res.statusCode = 405
    res.end(JSON.stringify({ country: null }))
    return
  }

  const raw = req.headers['x-vercel-ip-country']
  const value = Array.isArray(raw) ? raw[0] : raw
  const country = typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null

  res.statusCode = 200
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ country }))
}
