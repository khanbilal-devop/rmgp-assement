import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { fetchGames } from './api/gamesApi.js'
import { fakeFetchGames } from './test/fakeApi.js'

vi.mock('./api/gamesApi.js', () => ({ fetchGames: vi.fn() }))

beforeEach(() => {
  fetchGames.mockReset()
  fetchGames.mockImplementation(fakeFetchGames)
})

describe('App', () => {
  it('puts the bar, the hero, the archive and the about section on one page in that order', async () => {
    render(<App />)
    await screen.findByText(/items matching criteria/)
    const sections = [...document.querySelectorAll('header.navbar, section')].map((el) => el.className.split(' ')[0])
    expect(sections).toEqual(['navbar', 'hero', 'archive', 'about'])
  })

  it('has one page heading and a heading for each section', async () => {
    render(<App />)
    await screen.findByText(/items matching criteria/)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: /From The Archive/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Saving the/ })).toBeInTheDocument()
  })
})
