import Icon from './icons.jsx'

// Button that shows or hides the filter groups.
function FilterToggleButton({ open, onClick }) {
  return (
    <button type="button" className="filter-toggle" aria-expanded={open} onClick={onClick}>
      <Icon name="sliders" size={16} />
      {open ? 'Hide Filters' : 'Show Filters'}
    </button>
  )
}

export default FilterToggleButton
