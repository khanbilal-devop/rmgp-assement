import { useEffect, useState } from 'react'
import { fetchGames } from '../../api/gamesApi.js'

export const FACET_KEYS = ['type', 'device', 'play_style', 'connectivity', 'players', 'origin', 'maker']

const SEARCH_DELAY_MS = 300

const emptySelection = () => Object.fromEntries(FACET_KEYS.map((key) => [key, []]))

// Turns the current filters into the query string the games API expects.
function buildParams({ q, sort, years, photos, selected, page }) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (sort !== 'featured') params.set('sort', sort)
  if (years) {
    params.set('year_min', years[0])
    params.set('year_max', years[1])
  }
  if (photos) params.set('photos', 'true')
  FACET_KEYS.forEach((key) => {
    if (selected[key].length) params.set(key, selected[key].join(','))
  })
  if (page > 1) params.set('page', page)
  return params
}

// Holds every filter, asks the API for the matching games and keeps the latest answer.
export function useGameSearch() {
  const [searchText, setSearchText] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('featured')
  const [years, setYears] = useState(null) // null means the whole span of the collection
  const [photos, setPhotos] = useState(false)
  const [selected, setSelected] = useState(emptySelection)
  const [page, setPage] = useState(1)

  const [result, setResult] = useState(null) // the latest games returned
  const [collection, setCollection] = useState(null) // total and meta of the unfiltered collection
  const [finished, setFinished] = useState(null) // the query that last completed, and its error if any
  const [attempt, setAttempt] = useState(0)

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchText.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  const query = buildParams({ q, sort, years, photos, selected, page }).toString()

  useEffect(() => {
    const controller = new AbortController()
    fetchGames(query, controller.signal)
      .then((data) => {
        setResult(data)
        setCollection((previous) => previous ?? { total: data.total, meta: data.meta })
        setFinished({ query })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setFinished({ query, error })
      })
    return () => controller.abort()
  }, [query, attempt])

  const loading = finished?.query !== query
  const error = loading ? null : finished.error ?? null

  const changeSort = (value) => {
    setSort(value)
    setPage(1)
  }

  const changePhotos = (value) => {
    setPhotos(value)
    setPage(1)
  }

  const toggleOption = (key, value) => {
    setSelected((previous) => ({
      ...previous,
      [key]: previous[key].includes(value) ? previous[key].filter((v) => v !== value) : [...previous[key], value],
    }))
    setPage(1)
  }

  const clearGroup = (key) => {
    setSelected((previous) => ({ ...previous, [key]: [] }))
    setPage(1)
  }

  const changeYears = (from, to) => {
    const { yearMin, yearMax } = collection.meta
    setYears(from <= yearMin && to >= yearMax ? null : [from, to])
    setPage(1)
  }

  const reset = () => {
    setSearchText('')
    setQ('')
    setYears(null)
    setPhotos(false)
    setSelected(emptySelection())
    setPage(1)
  }

  const yearRange = years ?? (collection ? [collection.meta.yearMin, collection.meta.yearMax] : null)

  return {
    searchText, setSearchText, sort, changeSort, photos, changePhotos, selected, toggleOption, clearGroup,
    yearRange, changeYears, page, setPage, reset,
    result, collection, loading, error, retry: () => {
      setFinished(null)
      setAttempt((n) => n + 1)
    },
  }
}
