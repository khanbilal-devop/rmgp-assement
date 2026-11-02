import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Archive from './Archive.jsx'
import { fetchGames } from '../../api/gamesApi.js'
import { fakeFetchGames, games } from '../../test/fakeApi.js'
import { intersect } from '../../test/setup.js'

vi.mock('../../api/gamesApi.js', () => ({ fetchGames: vi.fn() }))

const TOTAL = games.length

// The page is rendered against the fake API and left once the first answer has arrived.
async function openArchive() {
  const user = userEvent.setup()
  render(<Archive />)
  await screen.findByText(`of ${TOTAL} items matching criteria`)
  return user
}

const group = (name) => screen.getByRole('group', { name: new RegExp(`^${name}`) })
const option = (groupName, label) => within(group(groupName)).getByRole('checkbox', { name: new RegExp(`^${label}`) })
const rowText = (groupName, label) => option(groupName, label).closest('label').textContent
const found = () => document.querySelector('.found-number').textContent
const chips = () => [...document.querySelectorAll('.active-chip')].map((chip) => chip.textContent)
const titles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent).filter((t) => games.some((g) => g.title === t))
const lastQuery = () => new URLSearchParams(fetchGames.mock.calls.at(-1)[0].toString())
const waitForFound = (count) => waitFor(() => expect(found()).toBe(String(count)))

beforeEach(() => {
  fetchGames.mockReset()
  fetchGames.mockImplementation(fakeFetchGames)
})

describe('loading the collection', () => {
  it('shows a loading message and then the filters and games', async () => {
    render(<Archive />)
    expect(screen.getByText('Loading the collection…')).toBeInTheDocument()
    await screen.findByText(`of ${TOTAL} items matching criteria`)
    expect(screen.queryByText('Loading the collection…')).not.toBeInTheDocument()
    expect(found()).toBe(String(TOTAL))
  })

  it('shows an error with a button to try again', async () => {
    fetchGames.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    render(<Archive />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The games could not be loaded.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText(`of ${TOTAL} items matching criteria`)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks the API for the first page with no filters', async () => {
    await openArchive()
    expect(fetchGames.mock.calls[0][0].toString()).toBe('')
  })

  it('fades the heading in once it scrolls into view', async () => {
    await openArchive()
    const header = document.querySelector('.archive-header')
    expect(header).not.toHaveClass('archive-header-shown')
    intersect()
    await waitFor(() => expect(header).toHaveClass('archive-header-shown'))
  })
})

describe('filter options come from the games', () => {
  it('lists every group with its options and counts', async () => {
    await openArchive()
    for (const name of ['Type', 'Platform', 'Play Style', 'Connectivity', 'Players', 'Origin', 'Maker']) {
      expect(group(name)).toBeInTheDocument()
    }
    expect(rowText('Type', 'Game / software')).toBe('Game / software5')
    expect(rowText('Origin', 'Japan')).toBe('Japan4')
    expect(rowText('Players', 'Multiplayer')).toBe('Multiplayer3')
  })

  it('drops a group that has no options left', async () => {
    const user = await openArchive()
    expect(group('Play Style')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1970s' }))
    await waitForFound(3)
    expect(screen.queryByRole('group', { name: /^Play Style/ })).not.toBeInTheDocument()
    expect(group('Connectivity')).toBeInTheDocument()
  })

  it('narrows the counts to the games the other filters leave', async () => {
    const user = await openArchive()
    await user.click(option('Origin', 'Japan'))
    await waitForFound(4)
    expect(rowText('Type', 'Game / software')).toBe('Game / software2')
    expect(within(group('Maker')).queryByRole('checkbox', { name: /^Nokia/ })).not.toBeInTheDocument()
    // a group still lists its own other options, so another country can be added
    expect(option('Origin', 'Finland')).toBeInTheDocument()
  })

  it('keeps a ticked option listed even when it now matches nothing', async () => {
    const user = await openArchive()
    await user.click(option('Platform', 'Nintendo DS'))
    await waitForFound(1)
    await user.click(screen.getByRole('button', { name: '1970s' }))
    await waitForFound(0)
    expect(option('Platform', 'Nintendo DS')).toBeChecked()
    expect(rowText('Platform', 'Nintendo DS')).toBe('Nintendo DS0')
  })

  it('filters the maker list by what is typed in its own box', async () => {
    const user = await openArchive()
    await user.type(screen.getByRole('searchbox', { name: 'Search makers' }), 'nin')
    const makers = within(group('Maker'))
    expect(makers.getByRole('checkbox', { name: /^Nintendo/ })).toBeInTheDocument()
    expect(makers.queryByRole('checkbox', { name: /^Tomy/ })).not.toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search makers' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search makers' }), 'zzz')
    expect(makers.getByText('No maker found.')).toBeInTheDocument()
  })
})

describe('checkbox filters', () => {
  it('sends the ticked option to the API and updates the result', async () => {
    const user = await openArchive()
    await user.click(option('Origin', 'Japan'))
    await waitForFound(4)
    expect(lastQuery().get('origin')).toBe('Japan')
    expect(titles()).toEqual(['Hamburger', 'Super Mario Land', 'Pokémon Ranger', 'Nintendo Switch'])
  })

  it('treats several options in one group as "any of them"', async () => {
    const user = await openArchive()
    await user.click(option('Origin', 'Japan'))
    await waitForFound(4)
    await user.click(option('Origin', 'Finland'))
    await waitForFound(5)
    expect(lastQuery().get('origin')).toBe('Japan,Finland')
  })

  it('treats options in different groups as "all of them"', async () => {
    const user = await openArchive()
    await user.click(option('Origin', 'Japan'))
    await waitForFound(4)
    await user.click(option('Players', 'Multiplayer'))
    await waitForFound(1)
    expect(titles()).toEqual(['Hamburger'])
  })

  it('shows "Clear (n)" on a group with ticks and clears only that group', async () => {
    const user = await openArchive()
    expect(screen.queryByRole('button', { name: /^Clear \(/ })).not.toBeInTheDocument()
    await user.click(option('Origin', 'Japan'))
    await user.click(option('Players', 'Multiplayer'))
    await waitForFound(1)
    expect(within(group('Origin')).getByRole('button', { name: 'Clear (1)' })).toBeInTheDocument()
    await user.click(within(group('Origin')).getByRole('button', { name: 'Clear (1)' }))
    await waitForFound(3)
    expect(lastQuery().get('origin')).toBeNull()
    expect(lastQuery().get('players')).toBe('Multiplayer')
  })
})

describe('year range and decades', () => {
  it('sets the year range from a decade button and shows it as pressed', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: '1980s' }))
    await waitForFound(2)
    expect(screen.getByRole('button', { name: '1980s' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.year-label')).toHaveTextContent('1980 - 1989')
    expect(lastQuery().get('year_min')).toBe('1980')
    expect(lastQuery().get('year_max')).toBe('1989')
  })

  it('goes back to the whole range when the pressed decade is clicked again', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: '1980s' }))
    await waitForFound(2)
    await user.click(screen.getByRole('button', { name: '1980s' }))
    await waitForFound(TOTAL)
    expect(screen.getByRole('button', { name: '1980s' })).toHaveAttribute('aria-pressed', 'false')
    expect(lastQuery().get('year_min')).toBeNull()
  })

  it('starts the slider at the first and last year of the collection', async () => {
    await openArchive()
    expect(document.querySelector('.year-label')).toHaveTextContent('1977 - 2017')
    expect(screen.getByLabelText('From year')).toHaveAttribute('min', '1977')
    expect(screen.getByLabelText('To year')).toHaveAttribute('max', '2017')
  })

  it('sends the range once the slider handle stops moving', async () => {
    await openArchive()
    const callsBefore = fetchGames.mock.calls.length
    fireEvent.change(screen.getByLabelText('From year'), { target: { value: '1990' } })
    expect(document.querySelector('.year-label')).toHaveTextContent('1990 - 2017')
    expect(fetchGames.mock.calls.length).toBe(callsBefore)
    await waitForFound(5)
    expect(lastQuery().get('year_min')).toBe('1990')
    expect(lastQuery().get('year_max')).toBe('2017')
  })

  it('does not let the two handles cross', async () => {
    await openArchive()
    fireEvent.change(screen.getByLabelText('To year'), { target: { value: '1980' } })
    fireEvent.change(screen.getByLabelText('From year'), { target: { value: '2000' } })
    expect(document.querySelector('.year-label')).toHaveTextContent('1980 - 1980')
  })
})

describe('search, sort and photos', () => {
  it('waits for typing to pause, then searches', async () => {
    const user = await openArchive()
    const callsBefore = fetchGames.mock.calls.length
    await user.type(screen.getByRole('searchbox', { name: 'Search games' }), 'pokémon')
    expect(fetchGames.mock.calls.length).toBe(callsBefore)
    await waitForFound(1)
    expect(lastQuery().get('q')).toBe('pokémon')
    expect(titles()).toEqual(['Pokémon Ranger'])
  })

  it('ignores accents in the search box', async () => {
    const user = await openArchive()
    await user.type(screen.getByRole('searchbox', { name: 'Search games' }), 'pokemon')
    await waitForFound(1)
    expect(titles()).toEqual(['Pokémon Ranger'])
  })

  it('shows a clear message and a reset button when nothing matches', async () => {
    const user = await openArchive()
    await user.type(screen.getByRole('searchbox', { name: 'Search games' }), 'zzzz')
    expect(await screen.findByText('No games match these filters.')).toBeInTheDocument()
    expect(found()).toBe('0')
    await user.click(screen.getByRole('button', { name: 'Reset all filters' }))
    await waitForFound(TOTAL)
    expect(screen.getByRole('searchbox', { name: 'Search games' })).toHaveValue('')
  })

  it('sorts newest first, oldest first and by title', async () => {
    const user = await openArchive()
    const sort = screen.getByRole('combobox', { name: 'Sort by' })
    await user.selectOptions(sort, 'Newest first')
    await waitFor(() => expect(titles()[0]).toBe('Nintendo Switch'))
    await user.selectOptions(sort, 'Oldest first')
    await waitFor(() => expect(titles()[0]).toBe('Tomy Blip'))
    await user.selectOptions(sort, 'Title A–Z')
    await waitFor(() => expect(titles()[0]).toBe('Hamburger'))
    expect(lastQuery().get('sort')).toBe('title')
  })

  it('keeps the sort order when the filters are cleared', async () => {
    const user = await openArchive()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Newest first')
    await user.click(option('Origin', 'Japan'))
    await waitForFound(4)
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    await waitForFound(TOTAL)
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('newest')
  })

  it('shows only games with photos when the toggle is on', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('checkbox', { name: 'Only show items with photos' }))
    await waitForFound(7)
    expect(lastQuery().get('photos')).toBe('true')
    expect(titles()).not.toContain('Savannah')
  })
})

describe('chosen filters', () => {
  it('shows a chip for each filter in a fixed order, with a Clear all link', async () => {
    const user = await openArchive()
    expect(document.querySelector('.active-filters')).toBeNull()
    await user.click(option('Origin', 'Japan'))
    await user.click(screen.getByRole('checkbox', { name: 'Only show items with photos' }))
    await user.click(screen.getByRole('button', { name: '1980s' }))
    await waitFor(() => expect(chips()).toEqual(['1980–1989', 'With photos', 'Japan']))
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument()
  })

  it('removes one filter with the x on its chip', async () => {
    const user = await openArchive()
    await user.click(option('Origin', 'Japan'))
    await user.click(option('Players', 'Multiplayer'))
    await waitForFound(1)
    await user.click(screen.getByRole('button', { name: 'Remove Japan filter' }))
    await waitForFound(3)
    expect(chips()).toEqual(['Multiplayer'])
  })

  it('clears every filter, including the search text, with Clear all', async () => {
    const user = await openArchive()
    await user.click(option('Origin', 'Japan'))
    await user.click(screen.getByRole('button', { name: '1980s' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search games' }), 'ham')
    await waitFor(() => expect(lastQuery().get('q')).toBe('ham'))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    await waitForFound(TOTAL)
    expect(chips()).toEqual([])
    expect(screen.getByRole('searchbox', { name: 'Search games' })).toHaveValue('')
    expect(document.querySelector('.year-label')).toHaveTextContent('1977 - 2017')
  })

  it('hides and shows the filter groups with the Hide Filters button', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: 'Hide Filters' }))
    expect(screen.queryByRole('group', { name: /^Type/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show Filters' }))
    expect(group('Type')).toBeInTheDocument()
  })

  it('keeps the chips visible while the filters are hidden', async () => {
    const user = await openArchive()
    await user.click(option('Origin', 'Japan'))
    await user.click(screen.getByRole('button', { name: 'Hide Filters' }))
    expect(chips()).toEqual(['Japan'])
  })
})

describe('games and pages', () => {
  it('shows eight games on the first page and the rest on the second', async () => {
    const user = await openArchive()
    expect(screen.getAllByRole('button', { name: /Open details/ })).toHaveLength(8)
    expect(screen.getByText('Showing 1-8 of 10 games')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    await screen.findByText('Showing 9-10 of 10 games')
    expect(screen.getAllByRole('button', { name: /Open details/ })).toHaveLength(2)
    expect(lastQuery().get('page')).toBe('2')
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists every page number, not just arrows', async () => {
    await openArchive()
    expect(screen.getAllByRole('button', { name: /^Page \d+$/ }).map((b) => b.textContent)).toEqual(['1', '2'])
  })

  it('still shows page 1 as selected when there is only one page', async () => {
    const user = await openArchive()
    await user.type(screen.getByRole('searchbox', { name: 'Search games' }), 'blip')
    await screen.findByText('Showing 1-1 of 1 games')
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
  })

  it('goes back to page 1 when a filter changes', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    await screen.findByText('Showing 9-10 of 10 games')
    await user.click(option('Origin', 'Japan'))
    await screen.findByText('Showing 1-4 of 4 games')
    expect(lastQuery().get('page')).toBeNull()
  })

  it('shows "No photo" and a fallback maker on cards that lack them', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    await screen.findByText('Showing 9-10 of 10 games')
    expect(screen.getAllByText('No photo')).toHaveLength(1)
  })
})

describe('game detail', () => {
  it('opens the full record in a dialog on the same page', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: /Tomy Blip, 1977/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Tomy Blip' })).toBeInTheDocument()
    expect(within(dialog).getByText('Platform')).toBeInTheDocument()
    expect(within(dialog).getByText('Built-in (dedicated device)')).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'Tomy Blip' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Retro Mobile Gaming Project/ })).toHaveAttribute('href', 'https://www.rmgd.org/')
  })

  it('closes with the Close button and puts focus back on the card', async () => {
    const user = await openArchive()
    const card = screen.getByRole('button', { name: /Tomy Blip, 1977/ })
    await user.click(card)
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(card).toHaveFocus()
  })

  it('closes when the dark area around it is clicked', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: /Microvision, 1979/ }))
    fireEvent.click(await screen.findByRole('dialog'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says so when a game has no description or photo', async () => {
    const user = await openArchive()
    await user.click(screen.getByRole('button', { name: /TI Calculator, 1977/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument()
  })
})
