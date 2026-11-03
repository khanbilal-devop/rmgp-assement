// Vercel serverless function: forwards /api requests to the games Lambda, as the Vite dev proxy does locally.
// Set API_URL (the Lambda Function URL, with no trailing slash) in the Vercel project's environment variables,
// so the URL stays out of the repository and the page code.
export default async function handler(req, res) {
  const target = process.env.API_URL
  if (!target) {
    res.status(500).json({ error: 'API_URL is not set on the server' })
    return
  }

  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  try {
    const response = await fetch(`${target}/${query}`)
    res.status(response.status)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    // Let Vercel's edge cache answers briefly, so repeated filters do not all reach the Lambda.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.send(await response.text())
  } catch {
    res.status(502).json({ error: 'The games API could not be reached' })
  }
}
