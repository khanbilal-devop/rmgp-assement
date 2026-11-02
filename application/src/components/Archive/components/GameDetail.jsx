import { useEffect, useRef } from 'react'

const FIELDS = [
  ['Platform', (g) => g.device],
  ['Type', (g) => g.type],
  ['Maker', (g) => g.maker.join(', ') || g.developer],
  ['Origin', (g) => g.origin.join(', ') || g.country],
  ['Hardware', (g) => g.hardware],
  ['Play style', (g) => g.playStyle.join(', ')],
  ['Connectivity', (g) => g.connectivity.join(', ')],
  ['Players', (g) => g.players.join(', ')],
]

// One game in full, in a dialog on the same page. Esc or the close button closes it
// and focus goes back to the card that opened it.
function GameDetail({ game, opener, onClose }) {
  const dialog = useRef(null)

  useEffect(() => {
    if (game && !dialog.current.open) dialog.current.showModal()
  }, [game])

  const handleClose = () => {
    opener?.focus()
    onClose()
  }

  return (
    <dialog
      ref={dialog} className="game-detail" aria-labelledby="game-detail-title"
      onClose={handleClose} onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      {game && (
        <div className="game-detail-content">
          {game.image && <img className="game-detail-image" src={game.image} alt={game.title} />}
          <div className="game-detail-body">
            <p className="game-detail-year">{game.year}</p>
            <h3 id="game-detail-title">{game.title}</h3>
            <dl>
              {FIELDS.map(([label, read]) => {
                const value = read(game)
                return value ? (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ) : null
              })}
            </dl>
            <p className="game-detail-description">{game.description || 'No description in the RMGP record.'}</p>
            <p className="game-detail-credit">
              Source: <a href={game.sourceUrl} target="_blank" rel="noreferrer">Retro Mobile Gaming Project (rmgd.org)</a>
            </p>
            <button type="button" className="game-detail-close" onClick={() => dialog.current.close()}>Close</button>
          </div>
        </div>
      )}
    </dialog>
  )
}

export default GameDetail
