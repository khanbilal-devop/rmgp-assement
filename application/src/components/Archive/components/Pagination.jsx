// Every page number is shown, even when there is only one, as on rmgd.org, with a "Showing x-y of z games" line.
function Pagination({ page, pages, from, to, total, onPage }) {
  return (
    <nav className="pagination" aria-label="Pages">
      <div className="pagination-buttons">
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => onPage(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="pagination-info">Showing {from}-{to} of {total} games</p>
    </nav>
  )
}

export default Pagination
