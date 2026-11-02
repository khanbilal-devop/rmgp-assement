import Icon from './icons.jsx'

// One game in the results grid: photo, year badge, title, maker and device tag.
function GameCard({ game, onOpen }) {
  return (
    <article className="game-card">
      <button
        type="button" className="game-card-button"
        aria-label={`${game.title}, ${game.year}. Open details`}
        onClick={(event) => onOpen(game, event.currentTarget)}
      >
        <div className="game-card-image">
          {game.image ? <img src={game.image} alt="" loading="lazy" /> : <span>No photo</span>}
          <span className="game-card-year">{game.year}</span>
        </div>
        <div className="game-card-body">
          <h3>{game.title}</h3>
          <p className="game-card-maker">{game.maker[0] || game.developer || 'Maker not listed'}</p>
          <div className="game-card-footer">
            <span className="game-card-tag">{game.device}</span>
            <Icon name="arrow" size={16} />
          </div>
        </div>
      </button>
    </article>
  )
}

export default GameCard
