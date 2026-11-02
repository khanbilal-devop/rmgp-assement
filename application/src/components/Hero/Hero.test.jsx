import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Hero from './Hero.jsx'

afterEach(() => vi.useRealTimers())

const video = () => document.querySelector('video')

describe('Hero', () => {
  it('shows the project name as the page heading and the tagline', () => {
    render(<Hero />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Retro Mobile\s*Gaming Project/)
    expect(screen.getByText('Preserving the history of mobile gameplay from 1975 to 2008.')).toBeInTheDocument()
  })

  it('plays a muted, looping, inline video from RMGP', () => {
    render(<Hero />)
    expect(video().muted).toBe(true)
    expect(video()).toHaveAttribute('loop')
    expect(video()).toHaveAttribute('playsinline')
    expect(video()).toHaveAttribute('autoplay')
    expect(video()).toHaveAttribute('src', 'https://www.rmgd.org/RMGP.mp4')
  })

  it('does not autoplay for visitors who asked for less motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    render(<Hero />)
    expect(video()).not.toHaveAttribute('autoplay')
  })

  it('credits RMGP for the video', () => {
    render(<Hero />)
    expect(screen.getByText('Video: Retro Mobile Gaming Project (rmgd.org)')).toBeInTheDocument()
  })

  it('hides the title block about four seconds after load and keeps it hidden', () => {
    vi.useFakeTimers()
    render(<Hero />)
    const block = document.querySelector('.hero-text')
    expect(block).not.toHaveClass('hero-text-hidden')
    act(() => vi.advanceTimersByTime(3900))
    expect(block).not.toHaveClass('hero-text-hidden')
    act(() => vi.advanceTimersByTime(200))
    expect(block).toHaveClass('hero-text-hidden')
    act(() => vi.advanceTimersByTime(60000))
    expect(block).toHaveClass('hero-text-hidden')
  })

  it('scrolls down by one screen when the arrow is pressed', async () => {
    render(<Hero />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Scroll down' }))
    expect(window.scrollBy).toHaveBeenCalledWith({ top: window.innerHeight, behavior: 'smooth' })
  })
})
