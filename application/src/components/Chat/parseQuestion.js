// Turns a typed question into the same filters the archive uses. No AI model is involved:
// it only recognises decades, years, players, photos and the filter values that exist in the
// collection, and treats any other words as a title search.

const DECADE_WORDS = {
  seventies: '1970s', eighties: '1980s', nineties: '1990s', noughties: '2000s', 'two thousands': '2000s', 'twenty tens': '2010s',
}

const MULTIPLAYER = /\b(two|2|multi)[- ]?players?\b|\bmulti-?player\b|\bwith friends\b|\bplay together\b/
const SINGLE_PLAYER = /\b(one|1|single)[- ]?players?\b|\bsingle-?player\b|\bsolo\b/
const PHOTOS = /\bwith (a )?(photos?|pictures?|images?)\b/
const HELP = /^(help|\?)$|\bwhat can (you|i)\b|\bhow (do|does) (this|you) work\b/
const GREETING = /^(hi|hello|hey|hiya|good (morning|afternoon|evening))\b[!. ]*$/
const COUNT = /\bhow many\b|\bnumber of\b|\bcount\b/

// Everyday words for some filter values.
const ALIASES = {
  origin: { 'United States': ['usa', 'u.s.', 'america', 'american'], Japan: ['japanese'], 'United Kingdom': ['uk', 'britain', 'british', 'england'], Finland: ['finnish'], Germany: ['german'], China: ['chinese'] },
  device: { 'Mobile phone': ['phone', 'phones', 'cell phone', 'cellphone', 'mobile phones'] },
  type: { Calculator: ['calculators'] },
}

const FACET_KEYS = ['type', 'device', 'play_style', 'connectivity', 'origin', 'maker']

const STOP_WORDS = new Set(`a about all an and any anything are as at be by can collection archive could did do does
  find for from game games get give have i in is it its list made make maker makers me of on one or please released
  release run runs show some tell than that the their them there these this those to was were what when where which who whose
  with you your years year decade decades between until till played play people`.split(/\s+/))

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const contains = (text, phrase) => new RegExp(`(^|[^a-z0-9])${escape(phrase)}([^a-z0-9]|$)`).test(text)
const strip = (text, phrase) => text.replace(new RegExp(`(^|[^a-z0-9])${escape(phrase)}(?=[^a-z0-9]|$)`, 'g'), '$1 ')

function findDecade(text) {
  const written = text.match(/\b(19[7-9]0|20[01]0)'?s\b/) || text.match(/(?:^|\s)'?([7-9]0|00|10)s\b/)
  if (written) {
    const value = written[1].length === 4 ? written[1] : `${['00', '10'].includes(written[1]) ? '20' : '19'}${written[1]}`
    return { decade: `${value}s`, rest: text.replace(written[0], ' ') }
  }
  const word = Object.keys(DECADE_WORDS).find((w) => contains(text, w))
  return word ? { decade: DECADE_WORDS[word], rest: strip(text, word) } : { rest: text }
}

function findYears(text) {
  const range = text.match(/\b(19\d{2}|20[01]\d)\s*(?:-|–|to|and|until)\s*(19\d{2}|20[01]\d)\b/)
  if (range) return { years: [+range[1], +range[2]].sort(), rest: text.replace(range[0], ' ') }
  const after = text.match(/\b(?:after|since)\s+(19\d{2}|20[01]\d)\b/)
  if (after) return { years: [+after[1], null], rest: text.replace(after[0], ' ') }
  const before = text.match(/\bbefore\s+(19\d{2}|20[01]\d)\b/)
  if (before) return { years: [null, +before[1]], rest: text.replace(before[0], ' ') }
  const single = text.match(/\b(19\d{2}|20[01]\d)\b(?!')/)
  if (single) return { years: [+single[1], +single[1]], rest: text.replace(single[0], ' ') }
  return { rest: text }
}

// Matches the longest filter values first, so "Game Boy Color" wins over "Game Boy".
function findFacets(text, options) {
  const candidates = []
  FACET_KEYS.forEach((key) => {
    ;(options[key] || []).forEach((value) => {
      candidates.push({ key, value, phrase: value.toLowerCase() })
      ;(ALIASES[key]?.[value] || []).forEach((alias) => candidates.push({ key, value, phrase: alias }))
    })
  })
  candidates.sort((a, b) => b.phrase.length - a.phrase.length)

  const chosen = {}
  let rest = text
  candidates.forEach(({ key, value, phrase }) => {
    if (phrase.length < 3 && !['uk'].includes(phrase)) return
    if (!contains(rest, phrase)) return
    chosen[key] = [...new Set([...(chosen[key] || []), value])]
    rest = strip(rest, phrase)
  })
  return { chosen, rest }
}

export function parseQuestion(question, options = {}) {
  const original = question.trim()
  let text = ` ${original.toLowerCase().replace(/[?!.,;:"]/g, ' ')} `

  if (!original) return { kind: 'empty' }
  if (GREETING.test(original.toLowerCase())) return { kind: 'greeting' }
  if (HELP.test(original.toLowerCase())) return { kind: 'help' }

  const params = {}
  const countOnly = COUNT.test(text)
  text = text.replace(COUNT, ' ')

  if (MULTIPLAYER.test(text)) {
    params.players = 'Multiplayer'
    text = text.replace(MULTIPLAYER, ' ')
  } else if (SINGLE_PLAYER.test(text)) {
    params.players = 'Single-player'
    text = text.replace(SINGLE_PLAYER, ' ')
  }
  if (PHOTOS.test(text)) {
    params.photos = 'true'
    text = text.replace(PHOTOS, ' ')
  }

  const decade = findDecade(text)
  text = decade.rest
  if (decade.decade) params.decade = decade.decade
  else {
    const years = findYears(text)
    text = years.rest
    if (years.years) {
      if (years.years[0]) params.year_min = String(years.years[0])
      if (years.years[1]) params.year_max = String(years.years[1])
    }
  }

  const facets = findFacets(text, options)
  text = facets.rest
  Object.entries(facets.chosen).forEach(([key, values]) => { params[key] = values.join(',') })

  const words = text.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w) && !/^(players?|multiplayer|photos?|pictures?|images?)$/.test(w))
  if (words.length) params.q = words.join(' ')

  if (Object.keys(params).length === 0) return { kind: 'unknown' }
  return { kind: 'search', params, countOnly }
}
