// A small stand-in for the games API (Lambda + DynamoDB) so the page can be tested without the network.
// It follows the same rules as aws/lambda_handler.py: OR inside a filter, AND across filters,
// option counts that ignore their own filter, 8 games per page, and a meta block.

const base = {
  hardware: '', genre: '', playStyle: [], connectivity: [], players: [], developer: '', maker: [],
  country: '', origin: [], description: 'A game from the collection.', image: 'https://example.test/photo.jpg',
  sourceUrl: 'https://www.rmgd.org/',
}

const make = (featuredRank, title, year, fields) => ({
  ...base, id: `game-${featuredRank}`, title, year, yearLabel: String(year), decade: `${Math.floor(year / 10) * 10}s`,
  featuredRank, platform: [fields.device], ...fields,
})

export const games = [
  make(1, 'Tomy Blip', 1977, { device: 'Built-in (dedicated device)', type: 'Handheld electronic game', connectivity: ['Standalone'], players: ['Single-player'], origin: ['United States'], maker: ['Tomy'], hardware: 'Game Console' }),
  make(2, 'Microvision', 1979, { device: 'Milton Bradley Microvision', type: 'Handheld console', players: ['Multiplayer'], maker: ['Milton Bradley'] }),
  make(3, 'TI Calculator', 1977, { device: 'Calculator', type: 'Calculator', origin: ['United States'], maker: ['Texas Instruments'], image: '' }),
  make(4, 'Hamburger', 1982, { device: 'Built-in (dedicated device)', type: 'Handheld electronic game', connectivity: ['Link cable'], players: ['Multiplayer'], origin: ['Japan'], maker: ['Takara'] }),
  make(5, 'Super Mario Land', 1989, { device: 'Game Boy', type: 'Game / software', players: ['Single-player'], origin: ['Japan'], maker: ['Nintendo'] }),
  make(6, 'Snake', 1997, { device: 'Nokia phones', type: 'Game / software', players: ['Single-player'], origin: ['Finland'], maker: ['Nokia'] }),
  make(7, 'Savannah', 2004, { device: 'Mobile phone', type: 'Game / software', playStyle: ['Location-based'], connectivity: ['GPS / location', 'Cellular network'], players: ['Multiplayer'], origin: ['United Kingdom'], maker: ['K. Facer', 'R. Joiner'], image: '' }),
  make(8, 'I Like Frank', 2004, { device: 'Mobile phone', type: 'Game / software', playStyle: ['Hybrid reality', 'Urban'], connectivity: ['Cellular network'], players: ['Single-player'], origin: ['Australia'], maker: ['Blast Theory'] }),
  make(9, 'Pokémon Ranger', 2006, { device: 'Nintendo DS', type: 'Game / software', players: ['Single-player'], origin: ['Japan'], maker: ['HAL Laboratory', 'Creatures'] }),
  make(10, 'Nintendo Switch', 2017, { device: 'Handheld console', type: 'Handheld console', origin: ['Japan'], maker: ['Nintendo'], image: '' }),
]

export const PAGE_SIZE = 8

const FACETS = { type: 'type', device: 'device', play_style: 'playStyle', connectivity: 'connectivity', players: 'players', origin: 'origin', maker: 'maker' }
const list = (value) => (Array.isArray(value) ? value : value ? [value] : [])
const split = (value) => (value || '').split(',').filter(Boolean)

// Lower-case text with accents removed, as the Lambda compares keywords.
const fold = (text) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function matches(game, params, skip) {
  const q = fold(params.get('q') || '')
  if (q && !fold(`${game.title} ${game.developer} ${game.country} ${game.description}`).includes(q)) return false
  if (params.get('year_min') && game.year < +params.get('year_min')) return false
  if (params.get('year_max') && game.year > +params.get('year_max')) return false
  if (params.get('decade') && game.decade !== params.get('decade')) return false
  if (params.get('photos') === 'true' && !game.image) return false
  return Object.entries(FACETS).every(([name, field]) => {
    const chosen = split(params.get(name))
    return name === skip || chosen.length === 0 || list(game[field]).some((value) => chosen.includes(value))
  })
}

const sorters = {
  newest: (a, b) => b.year - a.year,
  oldest: (a, b) => a.year - b.year,
  title: (a, b) => a.title.localeCompare(b.title),
  featured: (a, b) => a.featuredRank - b.featuredRank,
}

export function respond(query, data = games) {
  const params = new URLSearchParams(query)
  const found = data.filter((game) => matches(game, params)).sort(sorters[params.get('sort')] || sorters.featured)
  const page = +params.get('page') || 1
  const facets = Object.fromEntries(
    Object.entries(FACETS).map(([name, field]) => {
      const counts = {}
      data.filter((game) => matches(game, params, name)).forEach((game) => {
        list(game[field]).forEach((value) => { counts[value] = (counts[value] || 0) + 1 })
      })
      const rows = Object.entries(counts).map(([value, count]) => ({ value, count }))
      return [name, rows.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))]
    }),
  )
  const years = data.map((game) => game.year)
  return {
    total: found.length,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(found.length / PAGE_SIZE)),
    items: found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    facets,
    meta: { yearMin: Math.min(...years), yearMax: Math.max(...years), decades: [...new Set(data.map((game) => game.decade))].sort() },
  }
}

// What the page's fetchGames is replaced with in tests.
export const fakeFetchGames = (query) => Promise.resolve(respond(query.toString()))
