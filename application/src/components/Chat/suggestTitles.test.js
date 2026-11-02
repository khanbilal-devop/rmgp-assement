import { describe, expect, it } from 'vitest'
import { suggestTitles } from './suggestTitles.js'

const titles = ['Pokémon Ranger', 'Pokémon Pikachu 2 GS', 'Lemmings', 'Lemmings', 'Super Mario Land', 'Snake', 'Tomy Blip']

describe('suggestTitles', () => {
  it('ignores accents, so "pokemon" finds the Pokémon titles', () => {
    expect(suggestTitles('pokemon', titles)).toEqual(['Pokémon Pikachu 2 GS', 'Pokémon Ranger'])
  })

  it('puts the closest title first when more words match', () => {
    expect(suggestTitles('pokemon ranger', titles)[0]).toBe('Pokémon Ranger')
  })

  it('allows small typos', () => {
    expect(suggestTitles('lemings', titles)).toEqual(['Lemmings'])
    expect(suggestTitles('super maro', titles)).toEqual(['Super Mario Land'])
  })

  it('matches the start of a word', () => {
    expect(suggestTitles('blip', titles)).toEqual(['Tomy Blip'])
  })

  it('suggests nothing for a title that is not close to anything', () => {
    expect(suggestTitles('tetris', titles)).toEqual([])
    expect(suggestTitles('weather', titles)).toEqual([])
  })

  it('lists each title once and at most three', () => {
    const many = ['Snake I', 'Snake II', 'Snake III', 'Snake IV']
    expect(suggestTitles('snake', many)).toHaveLength(3)
    expect(suggestTitles('lemmings', titles)).toEqual(['Lemmings'])
  })

  it('ignores words shorter than three letters', () => {
    expect(suggestTitles('a b', titles)).toEqual([])
  })
})
