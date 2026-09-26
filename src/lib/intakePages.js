// Long option lists arrive from the server with a page per option (none = 1) and a "More" label per further
// page. Pages open cumulatively, so a tick on an earlier page stays in view. "Not sure" (exclusive) comes with
// the last page, so a first page reads as a few options + "More"; the best guesses after an unclear typed
// answer come first whatever their page.

export function visibleOptions(q, shown, guesses = []) {
  if (!q) return []
  const first = guesses.map((id) => q.options.find((o) => o.id === id)).filter(Boolean)
  const last = !nextPage(q, shown)
  const rest = q.options.filter((o) => !guesses.includes(o.id) && (o.exclusive ? last : (o.page || 1) <= shown))
  // Keep "not sure" last.
  return [...first, ...rest.filter((o) => !o.exclusive), ...rest.filter((o) => o.exclusive)]
}

/** The next page's "More" button, or null when everything is shown. */
export const nextPage = (q, shown) => (q?.pages || []).find((p) => p.page === shown + 1) || null
