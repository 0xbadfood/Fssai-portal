// Cross-check for the ops case page: do the application's details agree with what was read from the documents?
// Each row is 'match', 'close' (same person or place written differently: initials, order, a missing word)
// or 'mismatch'. A first step towards the document ownership check (TODO.md).
import { E } from './intake/index.js'
import { isDocOk } from './intake/plan.js'

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'shri', 'sri', 'smt', 'kumari', 'dr', 'm/s', 'ms.'])
const words = (s) =>
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

/** Address lines: share of the shorter line's words found in the longer one. */
function compareAddress(a, b) {
  const x = words(a).filter((w) => w.length > 1)
  const y = new Set(words(b).filter((w) => w.length > 1))
  if (!x.length || !y.size) return null
  const share = x.filter((w) => y.has(w)).length / x.length
  return share >= 0.8 ? 'match' : share >= 0.4 ? 'close' : 'mismatch'
}

const same = (a, b) => (a && b ? (words(a).join(' ') === words(b).join(' ') ? 'match' : 'mismatch') : null)

/** -> [{ field, label, application, document, source, result }] for the rows where both sides have a value. */
export function crossCheck(info = {}, docsByType = {}) {
  const id = isDocOk(docsByType.identity) ? docsByType.identity.verification?.extracted || {} : {}
  const addr = isDocOk(docsByType.address) ? docsByType.address.verification?.extracted || {} : {}
  const pin = (String(addr.pincode || '').match(/\b\d{6}\b/) || [])[0]
  const rows = [
    { field: 'applicant_name', label: 'Applicant name', application: info.applicant_name, document: id.holder_name, source: 'Identity proof', result: compareNames(info.applicant_name, id.holder_name) },
    { field: 'applicant_name', label: 'Name on address proof', application: info.applicant_name, document: addr.holder_name, source: 'Address proof', result: compareNames(info.applicant_name, addr.holder_name) },
    { field: 'premises_address', label: 'Premises address', application: info.premises_address, document: addr.address_line, source: 'Address proof', result: compareAddress(info.premises_address, addr.address_line) },
    { field: 'city', label: 'City', application: info.city, document: addr.city, source: 'Address proof', result: same(info.city, addr.city) },
    { field: 'pincode', label: 'PIN code', application: info.pincode, document: pin, source: 'Address proof', result: info.pincode && pin ? (String(info.pincode).trim() === pin ? 'match' : 'mismatch') : null },
    { field: 'state', label: 'State', application: info.state, document: addr.state, source: 'Address proof', result: info.state && addr.state ? (E.matchState(addr.state) === info.state ? 'match' : 'mismatch') : null },
  ]
  return rows.filter((r) => r.result)
}
