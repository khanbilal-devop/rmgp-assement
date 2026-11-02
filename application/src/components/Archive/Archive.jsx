import { useEffect, useRef, useState } from 'react'
import FilterPanel from './components/FilterPanel.jsx'
import GameGrid from './components/GameGrid.jsx'
import Pagination from './components/Pagination.jsx'
import GameDetail from './components/GameDetail.jsx'
import { useGameSearch } from './useGameSearch.js'
import './Archive.css'

// Which API filter feeds which group in the panel, in display order.
const FILTER_GROUPS = [
  { key: 'type', title: 'Type', icon: 'monitor' },
  { key: 'device', title: 'Platform', icon: 'gamepad' },
  { key: 'play_style', title: 'Play Style', icon: 'gamepad' },
  { key: 'connectivity', title: 'Connectivity', icon: 'wifi' },
  { key: 'players', title: 'Players', icon: 'users' },
  { key: 'origin', title: 'Origin', icon: 'globe' },
  { key: 'maker', title: 'Maker', icon: 'building', searchable: true },
]

// Options come from the games themselves; a ticked option stays listed even if it now matches nothing.
// A group with no options left is dropped, as on rmgd.org.
function buildGroups(facets, selected) {
  const groups = FILTER_GROUPS.map((group) => {
    const options = facets[group.key].map(({ value, count }) => ({ label: value, count }))
    selected[group.key].forEach((value) => {
      if (!options.some((o) => o.label === value)) options.push({ label: value, count: 0 })
    })
    return { ...group, options }
  })
  return groups.filter((group) => group.options.length > 0)
}

// "From The Archive" section: heading, the filter panel, the matching games and the paging.
function Archive() {
  const headerRef = useRef(null)
  const [headerShown, setHeaderShown] = useState(false)
  const [openGame, setOpenGame] = useState(null)
  const [opener, setOpener] = useState(null)
  const search = useGameSearch()
  const { result, collection, page } = search

  // The heading fades up once, when it reaches the middle of the screen (as on rmgd.org).
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHeaderShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -50% 0px' },
    )
    observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [])

  // The decade buttons set the year range; a button shows as pressed while its decade is the range.
  const decadeRange = (decade) => {
    const { yearMin, yearMax } = collection.meta
    const start = parseInt(decade, 10)
    return [Math.max(start, yearMin), Math.min(start + 9, yearMax)]
  }

  const yearProps = collection && {
    from: search.yearRange[0],
    to: search.yearRange[1],
    onChange: search.changeYears,
    activeDecade: collection.meta.decades.find((d) => {
      const [from, to] = decadeRange(d)
      return from === search.yearRange[0] && to === search.yearRange[1]
    }),
    onSelectDecade: (decade) => {
      const [from, to] = decadeRange(decade)
      const isActive = search.yearRange[0] === from && search.yearRange[1] === to
      search.changeYears(...(isActive ? [collection.meta.yearMin, collection.meta.yearMax] : [from, to]))
    },
  }

  const first = result ? (page - 1) * result.pageSize + 1 : 1

  return (
    <section className="archive" aria-labelledby="archive-title">
      <div className="archive-inner">
        <header ref={headerRef} className={`archive-header${headerShown ? ' archive-header-shown' : ''}`}>
          <h2 id="archive-title">
            From The <span>Archive</span>
          </h2>
          <p>
            Explore our comprehensive collection of preserved games, devices, and hardware. Filter by year,
            device, hardware, play style, players, connectivity, purpose, origin, and maker.
          </p>
        </header>

        {search.error && (
          <div className="archive-status" role="alert">
            <p>The games could not be loaded.</p>
            <button type="button" onClick={search.retry}>Try again</button>
          </div>
        )}
        {!search.error && !result && <p className="archive-status">Loading the collection…</p>}

        {result && collection && (
          <>
            <FilterPanel
              search={search} groups={buildGroups(result.facets, search.selected)}
              found={result.total} total={collection.total} meta={collection.meta} yearProps={yearProps}
            />
            <div className={`archive-results${search.loading ? ' archive-results-loading' : ''}`} aria-busy={search.loading}>
              <GameGrid
                games={result.items} onReset={search.reset}
                onOpen={(game, button) => { setOpener(button); setOpenGame(game) }}
              />
              {result.total > 0 && (
                <Pagination
                  page={result.page} pages={result.pages} total={result.total}
                  from={first} to={first + result.items.length - 1} onPage={(n) => { search.setPage(n); window.scrollTo({ top: headerRef.current.offsetTop + 200, behavior: 'smooth' }) }}
                />
              )}
            </div>
          </>
        )}
      </div>

      <GameDetail game={openGame} opener={opener} onClose={() => setOpenGame(null)} />
    </section>
  )
}

export default Archive
