// Vercel serverless function: forwards /api requests to the games Lambda, as the Vite dev proxy does locally.
// Set API_URL (the Lambda Function URL) in the Vercel project's environment variables,
// so the URL stays out of the repository and the page code.

// Tolerates the usual copy-and-paste slips: spaces, quotes and a trailing slash.
function apiBase() {
  const value = (process.env.API_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
  return /^https:\/\/[^/?#\s]+$/.test(value) ? value : null
}

export default async function handler(req, res) {
  const target = apiBase()
  if (!target) {
    res.status(500).json({ error: 'API_URL is missing or is not a plain https:// address with no path' })
    return
  }

  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  try {
    const response = await fetch(`${target}/${query}`, { headers: { accept: 'application/json' } })
    const body = await response.text()
    if (!response.ok) {
      // Shown in Vercel's function logs, to tell a wrong address from a Lambda error.
      console.error(`Games API answered ${response.status} from ${new URL(target).host}: ${body.slice(0, 200)}`)
      res.status(502).json({ error: 'The games API returned an error', upstreamStatus: response.status })
      return
    }
    res.status(200)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    // Let Vercel's edge cache answers briefly, so repeated filters do not all reach the Lambda.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.send(body)
  } catch (error) {
    console.error(`Games API could not be reached: ${error.message}`)
    res.status(502).json({ error: 'The games API could not be reached' })
  }
}
