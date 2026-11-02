import { useEffect, useState } from 'react'
import './Hero.css'

// The video is streamed from RMGP's site for this assignment only, and credited below.
const VIDEO_URL = 'https://www.rmgd.org/RMGP.mp4'

// As on rmgd.org, the title block is shown for a few seconds, then fades away for good.
const TEXT_VISIBLE_MS = 4000

function Hero() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [showText, setShowText] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowText(false), TEXT_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [])

  const scrollDown = () => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })

  return (
    <section className="hero" aria-labelledby="hero-title">
      <video
        className="hero-video"
        src={VIDEO_URL}
        autoPlay={!reduceMotion}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="hero-shade" />

      <div className={`hero-text${showText ? '' : ' hero-text-hidden'}`}>
        <h1 id="hero-title">
          <span className="hero-line hero-line-1">Retro Mobile</span>
          <span className="hero-line hero-line-2">Gaming Project</span>
        </h1>
        <p className="hero-line hero-line-3 hero-tagline">
          Preserving the history of mobile gameplay from 1975 to 2008.
        </p>
      </div>

      <button type="button" className="hero-scroll" aria-label="Scroll down" onClick={scrollDown}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <p className="hero-credit">Video: Retro Mobile Gaming Project (rmgd.org)</p>
    </section>
  )
}

export default Hero
