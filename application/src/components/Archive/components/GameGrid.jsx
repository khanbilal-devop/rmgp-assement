import GameCard from './GameCard.jsx'

// Responsive grid of game cards, or a clear message when nothing matches.
function GameGrid({ games, onOpen, onReset }) {
  if (games.length === 0) {
    return (
      <div className="no-results">
        <p>No games match these filters.</p>
        <button type="button" onClick={onReset}>Reset all filters</button>
      </div>
    )
  }
  return (
    <div className="game-grid">
      {games.map((game) => (
        <GameCard key={game.id} game={game} onOpen={onOpen} />
      ))}
    </div>
  )
}

export default GameGrid
