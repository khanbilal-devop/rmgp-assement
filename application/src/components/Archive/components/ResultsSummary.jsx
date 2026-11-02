// The "Found N of M items" box with the photos-only checkbox.
function ResultsSummary({ found, total, photos, onPhotosChange }) {
  return (
    <div className="panel-box results-summary">
      <div aria-live="polite">
        <p className="found-label">Found</p>
        <p className="found-number">{found}</p>
        <p className="found-of">of {total} items matching criteria</p>
      </div>
      <label className="photos-toggle">
        <input type="checkbox" checked={photos} onChange={(e) => onPhotosChange(e.target.checked)} /> Only show items with photos
      </label>
    </div>
  )
}

export default ResultsSummary
