// Comparing what was read from documents with each other and with what the customer typed.
// Results: 'match', 'close' (same person or place written differently: initials, order, a missing word) or 'mismatch'.

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'shri', 'sri', 'smt', 'kumari', 'dr', 'm/s', 'ms.'])
export const words = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !HONORIFICS.has(w))

/** Names: the same words in any order = match; initials or one name contained in the other = close. */
export function compareNames(a, b) {
  const x = words(a)
  const y = words(b)
  if (!x.length || !y.length) return null
  const sx = [...x].sort().join(' ')
  const sy = [...y].sort().join(' ')
  if (sx === sy) return 'match'
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  const covered = short.every((w) => long.some((l) => l === w || (w.length === 1 && l.startsWith(w)) || (l.length === 1 && w.startsWith(l))))
  return covered ? 'close' : 'mismatch'
}

// House, flat and plot numbers ("3006", "A103", "2530/C1" → 2530, c1); 6-digit PIN codes are compared separately.
const numbers = (s) => new Set(words(String(s || '').replace(/\b\d{6}\b/g, ' ')).filter((w) => /\d/.test(w)))

/** Address lines: share of the shorter line's words found in the longer one; different house numbers = mismatch. */
export function compareAddress(a, b) {
  const x = words(a).filter((w) => w.length > 1)
  const y = new Set(words(b).filter((w) => w.length > 1))
  if (!x.length || !y.size) return null
  const nx = numbers(a)
  const ny = numbers(b)
  if (nx.size && ny.size && ![...nx].some((n) => ny.has(n))) return 'mismatch'
  const share = x.filter((w) => y.has(w)).length / x.length
  return share >= 0.8 ? 'match' : share >= 0.4 ? 'close' : 'mismatch'
}
