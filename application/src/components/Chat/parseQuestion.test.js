import { describe, expect, it } from 'vitest'
import { parseQuestion } from './parseQuestion.js'
import { respond } from '../../test/fakeApi.js'

// The values the guide can recognise, taken from the fake collection the same way the guide does.
const facets = respond('').facets
const options = Object.fromEntries(Object.entries(facets).map(([key, rows]) => [key, rows.map((r) => r.value)]))
const params = (question) => parseQuestion(question, options).params

describe('parseQuestion', () => {
  it('recognises a written decade', () => {
    expect(params('Which games are from the 1980s?')).toEqual({ decade: '1980s' })
    expect(params("anything from the '90s")).toEqual({ decade: '1990s' })
    expect(params('games from the 70s')).toEqual({ decade: '1970s' })
    expect(params('show me the eighties')).toEqual({ decade: '1980s' })
  })

  it('recognises a single year, a range, and before or after', () => {
    expect(params('games from 1989')).toEqual({ year_min: '1989', year_max: '1989' })
    expect(params('between 1980 and 1995')).toEqual({ year_min: '1980', year_max: '1995' })
    expect(params('1995-2005')).toEqual({ year_min: '1995', year_max: '2005' })
    expect(params('after 2000')).toEqual({ year_min: '2000' })
    expect(params('before 1980')).toEqual({ year_max: '1980' })
  })

  it('recognises two-player and one-player questions', () => {
    for (const q of ['Which games are for two players?', 'two-player games', '2 player', 'multiplayer games', 'games to play with friends']) {
      expect(params(q)).toEqual({ players: 'Multiplayer' })
    }
    for (const q of ['single player games', 'one-player games', 'solo games']) {
      expect(params(q)).toEqual({ players: 'Single-player' })
    }
  })

  it('recognises filter values that exist in the collection, and everyday words for them', () => {
    expect(params('games from Japan')).toEqual({ origin: 'Japan' })
    expect(params('japanese games')).toEqual({ origin: 'Japan' })
    expect(params('american games')).toEqual({ origin: 'United States' })
    expect(params('Which games run on a mobile phone?')).toEqual({ device: 'Mobile phone' })
    expect(params('phone games')).toEqual({ device: 'Mobile phone' })
    expect(params('games on the Game Boy')).toEqual({ device: 'Game Boy' })
    expect(params('games made by Nintendo')).toEqual({ maker: 'Nintendo' })
    expect(params('location-based games')).toEqual({ play_style: 'Location-based' })
  })

  it('combines several parts of one question', () => {
    expect(params('two player games from Japan in the 1980s with photos')).toEqual({
      players: 'Multiplayer', origin: 'Japan', decade: '1980s', photos: 'true',
    })
  })

  it('treats the remaining words as a title search', () => {
    expect(params('Who made Snake?')).toEqual({ q: 'snake' })
    expect(params('Tell me about Microvision')).toEqual({ q: 'microvision' })
    // a maker's name in the question becomes the maker filter, the rest stays a title search
    expect(params('Tell me about Tomy Blip')).toEqual({ maker: 'Tomy', q: 'blip' })
    expect(params('Is Tetris in the collection?')).toEqual({ q: 'tetris' })
  })

  it('notices "how many" questions', () => {
    expect(parseQuestion('How many games are from the 2000s?', options)).toEqual({ kind: 'search', params: { decade: '2000s' }, countOnly: true })
  })

  it('knows greetings, help and questions it cannot use', () => {
    expect(parseQuestion('hello', options).kind).toBe('greeting')
    expect(parseQuestion('help', options).kind).toBe('help')
    expect(parseQuestion('What can you do?', options).kind).toBe('help')
    expect(parseQuestion('what are the games', options).kind).toBe('unknown')
    expect(parseQuestion('   ', options).kind).toBe('empty')
  })
})
