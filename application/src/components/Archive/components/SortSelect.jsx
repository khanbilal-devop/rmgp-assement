import Icon from './icons.jsx'

const OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
]

// Dropdown for the sort order.
function SortSelect({ value, onChange }) {
  return (
    <label className="sort-select">
      <span className="visually-hidden">Sort by</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Icon name="chevron" size={16} />
    </label>
  )
}

export default SortSelect
