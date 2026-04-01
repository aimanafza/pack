// Format date range: "Jun 12 - Jun 19, 2026"
export function formatDateRange(start, end) {
  const opts = { month: 'short', day: 'numeric' }
  const s = new Date(start).toLocaleDateString('en-US', opts)
  const e = new Date(end).toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${s} - ${e}`
}

// Compute trip duration in days
export function tripDuration(start, end) {
  const diff = new Date(end) - new Date(start)
  return Math.round(diff / (1000 * 60 * 60 * 24))
}
