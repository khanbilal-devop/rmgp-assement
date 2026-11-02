// One row in a filter list: a checkbox, its label and how many games it matches.
function CheckboxOption({ label, count, checked, onChange }) {
  return (
    <label className="checkbox-option">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="checkbox-label">{label}</span>
      <span className="checkbox-count">{count}</span>
    </label>
  )
}

export default CheckboxOption
