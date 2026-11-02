import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Navbar from './Navbar.jsx'

const scrollTo = (y) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  fireEvent.scroll(window)
}

describe('Navbar', () => {
  it('has only the logo and no navigation links', () => {
    render(<Navbar />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link')).toHaveAccessibleName('Retro Mobile Gaming Project, back to top')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('is clear at the top of the page', () => {
    scrollTo(0)
    render(<Navbar />)
    expect(screen.getByRole('banner')).not.toHaveClass('navbar-scrolled')
  })

  it('turns dark once the page has scrolled past 60px', () => {
    scrollTo(0)
    render(<Navbar />)
    scrollTo(60)
    expect(screen.getByRole('banner')).not.toHaveClass('navbar-scrolled')
    scrollTo(61)
    expect(screen.getByRole('banner')).toHaveClass('navbar-scrolled')
  })

  it('goes clear again when scrolled back to the top', () => {
    scrollTo(0)
    render(<Navbar />)
    scrollTo(400)
    expect(screen.getByRole('banner')).toHaveClass('navbar-scrolled')
    scrollTo(0)
    expect(screen.getByRole('banner')).not.toHaveClass('navbar-scrolled')
  })

  it('is already dark when the page loads part-way down', () => {
    scrollTo(500)
    render(<Navbar />)
    expect(screen.getByRole('banner')).toHaveClass('navbar-scrolled')
    scrollTo(0)
  })

  it('scrolls smoothly to the top when the logo is clicked', () => {
    render(<Navbar />)
    const notPrevented = fireEvent.click(screen.getByRole('link'))
    expect(notPrevented).toBe(false)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
