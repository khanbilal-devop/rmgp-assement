import { useState } from 'react'
import Icon from './icons.jsx'
import SearchBox from './SearchBox.jsx'
import CheckboxOption from './CheckboxOption.jsx'

// A titled, scrollable list of checkbox options (Type, Platform, Maker and so on).
function FilterGroup({ title, icon, options, selected, onToggle, onClear, searchable = false }) {
  const [search, setSearch] = useState('')
  const shown = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <fieldset className="filter-group">
      <legend className="box-title">
        <Icon name={icon} /> {title}
        {selected.length > 0 && (
          <button type="button" className="filter-clear" onClick={onClear}>Clear ({selected.length})</button>
        )}
      </legend>
      {searchable && (
        <SearchBox
          small label={`Search ${title.toLowerCase()}s`} placeholder={`Search ${title.toLowerCase()}s…`}
          value={search} onChange={setSearch}
        />
      )}
      <div className={`filter-options${searchable ? ' filter-options-short' : ''}`}>
        {shown.map((o) => (
          <CheckboxOption
            key={o.label} label={o.label} count={o.count}
            checked={selected.includes(o.label)} onChange={() => onToggle(o.label)}
          />
        ))}
        {shown.length === 0 && <p className="filter-empty">No {title.toLowerCase()} found.</p>}
      </div>
    </fieldset>
  )
}

export default FilterGroup
