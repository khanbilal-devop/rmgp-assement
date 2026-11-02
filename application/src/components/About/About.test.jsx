import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import About from './About.jsx'
import { intersect } from '../../test/setup.js'

describe('About', () => {
  it('describes RMGP as a whole under a clear heading', () => {
    render(<About />)
    expect(screen.getByText('About RMGP')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Saving the\s*Story of\s*Mobile Play/)
    expect(screen.getByText(/from 1975 to 2008/)).toBeInTheDocument()
  })

  it('links to the RMGP about page, opening in a new tab', () => {
    render(<About />)
    const link = screen.getByRole('link', { name: /Learn More/ })
    expect(link).toHaveAttribute('href', 'https://www.rmgd.org/about')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('has a photo with a description for screen readers', () => {
    render(<About />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/Watara Supervision/)
  })

  it('slides the photo and text in once, when the section scrolls into view', async () => {
    render(<About />)
    const grid = document.querySelector('.about-grid')
    expect(grid).not.toHaveClass('about-shown')
    intersect()
    await waitFor(() => expect(grid).toHaveClass('about-shown'))
  })
})
