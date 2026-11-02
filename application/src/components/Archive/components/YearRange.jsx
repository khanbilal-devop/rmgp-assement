import { useEffect, useState } from 'react'
import Icon from './icons.jsx'
import DecadeButtons from './DecadeButtons.jsx'

const COMMIT_DELAY_MS = 250

// Two-handled year slider limited to the years in the collection, with the chosen range shown
// as a label and a button for each decade. The range is sent on once the handles stop moving.
// The parent gives it a key built from the range, so it starts afresh when the range changes elsewhere.
function YearRange({ minYear, maxYear, from, to, decades, activeDecade, onChange, onSelectDecade }) {
  const [shown, setShown] = useState([from, to])
  const pct = (year) => ((year - minYear) / (maxYear - minYear)) * 100

  useEffect(() => {
    if (shown[0] === from && shown[1] === to) return undefined
    const timer = setTimeout(() => onChange(shown[0], shown[1]), COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [shown, from, to, onChange])

  return (
    <div className="panel-box year-range">
      <div className="year-range-top">
        <h3 className="box-title"><Icon name="calendar" /> Release Year</h3>
        <span className="year-label">{shown[0]} - {shown[1]}</span>
      </div>

      <div className="dual-range">
        <span className="dual-range-fill" style={{ left: `${pct(shown[0])}%`, right: `${100 - pct(shown[1])}%` }} />
        <input
          type="range" min={minYear} max={maxYear} value={shown[0]} aria-label="From year"
          onChange={(e) => setShown([Math.min(+e.target.value, shown[1]), shown[1]])}
        />
        <input
          type="range" min={minYear} max={maxYear} value={shown[1]} aria-label="To year"
          onChange={(e) => setShown([shown[0], Math.max(+e.target.value, shown[0])])}
        />
      </div>

      <DecadeButtons decades={decades} active={activeDecade} onSelect={onSelectDecade} />
    </div>
  )
}

export default YearRange
