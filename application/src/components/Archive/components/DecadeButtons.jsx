// One small button per decade, used to jump the year range to that decade.
function DecadeButtons({ decades, active, onSelect }) {
  return (
    <div className="decade-buttons">
      {decades.map((decade) => (
        <button
          key={decade} type="button" className="decade-button"
          aria-pressed={active === decade} onClick={() => onSelect(decade)}
        >
          {decade}
        </button>
      ))}
    </div>
  )
}

export default DecadeButtons
