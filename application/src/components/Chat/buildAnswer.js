// Writes the guide's reply from the API's answer, so every game it names really is in the collection.

export const NOT_IN_COLLECTION = "That isn't in this collection."
export const UNKNOWN = "I can only answer questions about the games in this collection. Try a decade, a device, a country, players or a title."

export const GREETING_TEXT = "Hi! I'm the collection guide. I answer questions about the games on this page, using only their records. What would you like to know?"

export const HELP_TEXT = 'You can ask things like "Which games are from the 1980s?", "Which games are for two players?", "Games from Japan in the 1990s", "How many phone games are there?" or "Who made Snake?". I only know the games in this collection.'

const LIST_LIMIT = 8

const describe = (params) => {
  const parts = []
  if (params.decade) parts.push(`from the ${params.decade}`)
  if (params.year_min && params.year_min === params.year_max) parts.push(`from ${params.year_min}`)
  else if (params.year_min && params.year_max) parts.push(`from ${params.year_min} to ${params.year_max}`)
  else if (params.year_min) parts.push(`from ${params.year_min} on`)
  else if (params.year_max) parts.push(`up to ${params.year_max}`)
  if (params.players === 'Multiplayer') parts.push('for two or more players')
  if (params.players === 'Single-player') parts.push('for one player')
  ;['device', 'type', 'play_style', 'connectivity'].forEach((key) => params[key] && parts.push(`(${params[key].split(',').join(' or ')})`))
  if (params.origin) parts.push(`from ${params.origin.split(',').join(' or ')}`)
  if (params.maker) parts.push(`made by ${params.maker.split(',').join(' or ')}`)
  if (params.photos) parts.push('with photos')
  if (params.q) parts.push(`matching "${params.q}"`)
  return parts.join(' ')
}

function oneGame(game) {
  const maker = game.maker.join(', ') || game.developer || 'an unlisted maker'
  const origin = game.origin.length ? `, from ${game.origin.join(', ')}` : ''
  const players = game.players.length ? ` It is ${game.players.join(' or ').toLowerCase()}.` : ''
  const firstSentence = (game.description.match(/^.*?[.!?](\s|$)/) || [game.description])[0].trim()
  return `${game.title} (${game.year}) is a ${game.type.toLowerCase()} by ${maker}${origin}, on ${game.device}.${players}${firstSentence ? ` ${firstSentence}` : ''}`
}

export function buildAnswer(parsed, result) {
  if (result.total === 0) return { text: NOT_IN_COLLECTION }

  const what = describe(parsed.params)
  const noun = result.total === 1 ? 'game' : 'games'

  if (parsed.countOnly) return { text: `There ${result.total === 1 ? 'is' : 'are'} ${result.total} ${noun} ${what}.`.replace(/\s+\./, '.') }

  // When exactly one game matches, give its full record instead of a one-line list.
  if (result.total === 1) return { text: oneGame(result.items[0]) }

  const shown = result.items.slice(0, LIST_LIMIT)
  const more = result.total - shown.length
  return {
    text: `I found ${result.total} ${noun} ${what}:`.replace(/\s+:/, ':'),
    games: shown.map((g) => `${g.title} (${g.year}, ${g.device})`),
    footer: more > 0 ? `…and ${more} more. Use the filters above to see them all.` : undefined,
  }
}
