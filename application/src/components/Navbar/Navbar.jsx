import { useEffect, useState } from 'react'
import './Navbar.css'

// The bar turns solid once the page has scrolled this far (same as rmgd.org).
const SCROLLED_AFTER_PX = 60

// Fixed top bar with the project logo only. It is clear over the hero and turns dark and blurred on scroll.
function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLLED_AFTER_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const backToTop = (event) => {
    event.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <header className={`navbar${scrolled ? ' navbar-scrolled' : ''}`}>
      <div className="navbar-inner">
        <a className="navbar-logo" href="/" aria-label="Retro Mobile Gaming Project, back to top" onClick={backToTop}>
          <span>Retro Mobile</span>
          <span className="navbar-mark" aria-hidden="true">
            <span className="navbar-dot navbar-dot-red" />
            <span className="navbar-dot navbar-dot-grey" />
          </span>
          <span>Gaming Project</span>
        </a>
      </div>
    </header>
  )
}

export default Navbar
