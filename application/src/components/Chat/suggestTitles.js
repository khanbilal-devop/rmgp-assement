// Finds titles in the collection that are close to what was typed, for "Did you mean…?".
// It ignores case and accents ("pokemon" finds "Pokémon") and allows small typos ("lemings").

const MIN_SCORE = 0.75
const MAX_SUGGESTIONS = 3

const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = (text) => normalize(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 3)

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

const similarity = (a, b) => 1 - distance(a, b) / Math.max(a.length, b.length)

// How well the typed words match one title, from 0 to 1.
function score(typed, title) {
  const titleWords = words(title)
  if (typed.length === 0 || titleWords.length === 0) return 0
  const best = typed.map((word) => Math.max(...titleWords.map((t) => (t.startsWith(word) ? 1 : similarity(word, t)))))
  return best.reduce((sum, value) => sum + value, 0) / best.length
}

export function suggestTitles(query, titles) {
  const typed = words(query)
  return [...new Set(titles)]
    .map((title) => ({ title, score: score(typed, title) }))
    .filter((match) => match.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_SUGGESTIONS)
    .map((match) => match.title)
}
