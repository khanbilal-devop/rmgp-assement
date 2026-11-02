import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatBot from './ChatBot.jsx'
import { fetchGames } from '../../api/gamesApi.js'
import { fakeFetchGames } from '../../test/fakeApi.js'
import { NOT_IN_COLLECTION } from './buildAnswer.js'

vi.mock('../../api/gamesApi.js', () => ({ fetchGames: vi.fn() }))

beforeEach(() => {
  fetchGames.mockReset()
  fetchGames.mockImplementation(fakeFetchGames)
})

async function openChat() {
  const user = userEvent.setup()
  render(<ChatBot />)
  await user.click(screen.getByRole('button', { name: 'Open the collection guide' }))
  return user
}

async function ask(user, question) {
  await user.type(screen.getByRole('textbox', { name: 'Ask about the collection' }), question)
  await user.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(screen.queryByText('Looking through the collection…')).not.toBeInTheDocument())
  const bubbles = document.querySelectorAll('.chat-bubble-bot')
  return bubbles[bubbles.length - 1]
}

describe('ChatBot', () => {
  it('opens from the round button with a greeting, suggestions and focus in the text box', async () => {
    await openChat()
    const panel = screen.getByRole('dialog', { name: 'Collection guide' })
    expect(within(panel).getByText(/I'm the collection guide/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: /1980s games/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Ask about the collection' })).toHaveFocus()
  })

  it('lists the games from a decade, using only games from the API', async () => {
    const user = await openChat()
    const answer = await ask(user, 'Which games are from the 1980s?')
    expect(answer).toHaveTextContent('I found 2 games from the 1980s:')
    expect(within(answer).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Hamburger (1982, Built-in (dedicated device))',
      'Super Mario Land (1989, Game Boy)',
    ])
    expect(new URLSearchParams(fetchGames.mock.calls.at(-1)[0].toString()).get('decade')).toBe('1980s')
  })

  it('answers which games are for two players', async () => {
    const user = await openChat()
    const answer = await ask(user, 'Which games are for two players?')
    expect(answer).toHaveTextContent('I found 3 games for two or more players:')
    expect(within(answer).getAllByRole('listitem')).toHaveLength(3)
  })

  it('says so when something is not in the collection instead of inventing it', async () => {
    const user = await openChat()
    const answer = await ask(user, 'Is Tetris in the collection?')
    expect(answer).toHaveTextContent(NOT_IN_COLLECTION)
    expect(within(answer).queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('suggests close titles when a title search finds nothing, and asks one when clicked', async () => {
    const user = await openChat()
    const answer = await ask(user, 'pokemon rangr')
    expect(answer).toHaveTextContent("That isn't in this collection. Did you mean:")
    const suggestion = within(answer).getByRole('button', { name: 'Pokémon Ranger' })
    await user.click(suggestion)
    await waitFor(() => expect(document.querySelectorAll('.chat-bubble-bot')).toHaveLength(3))
    const last = [...document.querySelectorAll('.chat-bubble-bot')].pop()
    expect(last).toHaveTextContent(/^Pokémon Ranger \(2006\) is a game/)
  })

  it('reads every page of titles once to make suggestions', async () => {
    const user = await openChat()
    await ask(user, 'pokemn')
    const pageCalls = () => fetchGames.mock.calls.filter(([q]) => /^(page=2)?$/.test(q.toString())).length
    const afterFirst = pageCalls()
    await ask(user, 'lemings')
    expect(pageCalls()).toBe(afterFirst)
  })

  it('finds accented titles when asked without the accent', async () => {
    const user = await openChat()
    const answer = await ask(user, 'pokemon ranger')
    expect(answer).toHaveTextContent(/^Pokémon Ranger \(2006\)/)
  })

  it('says it can only talk about the collection when the question has nothing it can use', async () => {
    const user = await openChat()
    const answer = await ask(user, 'what are the games')
    expect(answer).toHaveTextContent('I can only answer questions about the games in this collection.')
  })

  it('describes one game in full when asked about it by name', async () => {
    const user = await openChat()
    const answer = await ask(user, 'Who made Snake?')
    expect(answer).toHaveTextContent('Snake (1997) is a game / software by Nokia, from Finland, on Nokia phones.')
  })

  it('gives the full record whenever exactly one game matches', async () => {
    const user = await openChat()
    const answer = await ask(user, 'games from Finland')
    expect(answer).toHaveTextContent(/^Snake \(1997\) is a game/)
    expect(within(answer).queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('answers "how many" questions with a count', async () => {
    const user = await openChat()
    const answer = await ask(user, 'How many games are from the 2000s?')
    expect(answer).toHaveTextContent('There are 3 games from the 2000s.')
  })

  it('combines several parts of one question', async () => {
    const user = await openChat()
    const answer = await ask(user, 'games from Japan in the 1980s')
    expect(within(answer).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Hamburger (1982, Built-in (dedicated device))',
      'Super Mario Land (1989, Game Boy)',
    ])
  })

  it('shortens a long list and points to the filters for the rest', async () => {
    const user = await openChat()
    const answer = await ask(user, 'games from 1977 to 2017')
    expect(within(answer).getAllByRole('listitem')).toHaveLength(8)
    expect(answer).toHaveTextContent('…and 2 more. Use the filters above to see them all.')
  })

  it('asks a suggestion when its chip is clicked, then hides the chips', async () => {
    const user = await openChat()
    await user.click(screen.getByRole('button', { name: /Two players/ }))
    expect(await screen.findByText('Which games are for two players?')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /1980s games/ })).not.toBeInTheDocument())
  })

  it('gives help with example questions', async () => {
    const user = await openChat()
    const answer = await ask(user, 'help')
    expect(answer).toHaveTextContent('Which games are for two players?')
  })

  it('apologises when the collection cannot be reached', async () => {
    const user = await openChat()
    fetchGames.mockRejectedValue(new Error('offline'))
    const answer = await ask(user, 'games from the 1990s')
    expect(answer).toHaveTextContent("Sorry, I couldn't reach the collection just now.")
  })

  it('does not send an empty question', async () => {
    await openChat()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('closes with Escape or the close button and returns focus to the round button', async () => {
    const user = await openChat()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open the collection guide' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Open the collection guide' }))
    await user.click(screen.getByRole('button', { name: 'Close the collection guide' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the conversation when it is closed and opened again', async () => {
    const user = await openChat()
    await ask(user, 'games from the 1990s')
    await user.click(screen.getByRole('button', { name: 'Close the collection guide' }))
    await user.click(screen.getByRole('button', { name: 'Open the collection guide' }))
    expect(screen.getByText('games from the 1990s')).toBeInTheDocument()
  })
})
