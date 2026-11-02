import { useEffect, useRef, useState } from 'react'
import Icon from '../Archive/components/icons.jsx'
import './About.css'

// The photo is one of the games in the collection, loaded from RMGP's own image store.
const PHOTO_URL = 'https://retromobilegamingproject.s3.us-east-1.amazonaws.com/games/IMG_6509.jpeg'
const RMGP_URL = 'https://www.rmgd.org/about'

// "About" section: a photo on the left and a short text on the right, which slide in once
// when the section scrolls into view (as on rmgd.org).
function About() {
  const gridRef = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(gridRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="about" aria-labelledby="about-title">
      <div className="about-pattern" aria-hidden="true" />

      <div ref={gridRef} className={`about-grid${shown ? ' about-shown' : ''}`}>
        <div className="about-photo">
          <img src={PHOTO_URL} alt="A pink Watara Supervision handheld console from 1992" loading="lazy" />
        </div>

        <div className="about-text">
          <span className="about-label">About RMGP</span>
          <h2 id="about-title">
            Saving the
            <br />
            Story of
            <br />
            <span>Mobile Play</span>
          </h2>
          <p>
            RMGP is a research archive at Northeastern University that collects and documents early mobile
            games and devices from 1975 to 2008, so their history stays open to everyone. These early
            handhelds, phones and games shaped how we play today, yet many are wearing out or have
            disappeared from stores, and once they are gone their story is lost with them.
          </p>
          <a className="about-link" href={RMGP_URL} target="_blank" rel="noreferrer">
            Learn More <Icon name="arrow" size={16} />
          </a>
        </div>
      </div>
    </section>
  )
}

export default About
