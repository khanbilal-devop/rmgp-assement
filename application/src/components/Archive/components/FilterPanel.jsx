import { useState } from 'react'
import SearchBox from './SearchBox.jsx'
import SortSelect from './SortSelect.jsx'
import FilterToggleButton from './FilterToggleButton.jsx'
import YearRange from './YearRange.jsx'
import ResultsSummary from './ResultsSummary.jsx'
import FilterGroup from './FilterGroup.jsx'
import ActiveFilters from './ActiveFilters.jsx'

// The frosted panel holding search, sort, year range, result count and every filter group.
function FilterPanel({ search, groups, found, total, meta, yearProps }) {
  const [open, setOpen] = useState(true)

  // The chosen filters in the order the groups appear, with the year range and photos first.
  const chips = []
  const [from, to] = search.yearRange
  if (from !== meta.yearMin || to !== meta.yearMax) {
    chips.push({ id: 'years', label: `${from}–${to}`, onRemove: () => search.changeYears(meta.yearMin, meta.yearMax) })
  }
  if (search.photos) chips.push({ id: 'photos', label: 'With photos', onRemove: () => search.changePhotos(false) })
  groups.forEach(({ key }) => {
    search.selected[key].forEach((value) => {
      chips.push({ id: `${key}-${value}`, label: value, onRemove: () => search.toggleOption(key, value) })
    })
  })

  return (
    <div className="filter-panel">
      <div className="filter-bar">
        <SearchBox
          label="Search games" placeholder="Search by title, developer, country or description…"
          value={search.searchText} onChange={search.setSearchText}
        />
        <div className="filter-bar-row">
          <SortSelect value={search.sort} onChange={search.changeSort} />
          <FilterToggleButton open={open} onClick={() => setOpen(!open)} />
        </div>
      </div>

      <ActiveFilters chips={chips} onClearAll={search.reset} />

      {open && (
        <div className="filter-body">
          <div className="filter-top">
            <YearRange key={`${yearProps.from}-${yearProps.to}`} minYear={meta.yearMin} maxYear={meta.yearMax} decades={meta.decades} {...yearProps} />
            <ResultsSummary found={found} total={total} photos={search.photos} onPhotosChange={search.changePhotos} />
          </div>
          <div className="filter-groups">
            {groups.map(({ key, ...group }) => (
              <FilterGroup
                key={key} {...group}
                selected={search.selected[key]} onToggle={(value) => search.toggleOption(key, value)}
                onClear={() => search.clearGroup(key)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterPanel
