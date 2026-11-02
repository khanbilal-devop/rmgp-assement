// Calls the games API (Lambda + DynamoDB). In development /api is proxied to the Function URL, see vite.config.js.
export async function fetchGames(params, signal) {
  const response = await fetch(`/api/?${params}`, { signal })
  if (!response.ok) {
    throw new Error(`The games API answered with status ${response.status}`)
  }
  return response.json()
}
