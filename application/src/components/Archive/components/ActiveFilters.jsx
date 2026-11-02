import Icon from './icons.jsx'

// One chip per chosen filter, each with a button to remove it, and a link to clear them all.
function ActiveFilters({ chips, onClearAll }) {
  if (chips.length === 0) return null
  return (
    <div className="active-filters">
      {chips.map((chip) => (
        <span key={chip.id} className="active-chip">
          {chip.label}
          <button type="button" aria-label={`Remove ${chip.label} filter`} onClick={chip.onRemove}>
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      <button type="button" className="active-clear-all" onClick={onClearAll}>Clear all</button>
    </div>
  )
}

export default ActiveFilters
