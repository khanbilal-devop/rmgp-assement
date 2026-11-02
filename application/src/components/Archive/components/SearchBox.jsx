import Icon from './icons.jsx'

// Text box with a search icon. Used for the main search and for the maker list.
function SearchBox({ label, placeholder, value, onChange, small = false }) {
  return (
    <label className={`search-box${small ? ' search-box-small' : ''}`}>
      <span className="visually-hidden">{label}</span>
      <Icon name="search" size={small ? 16 : 20} />
      <input type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export default SearchBox
