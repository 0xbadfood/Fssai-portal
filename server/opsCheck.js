// Cross-check for the ops case page: do the application's details agree with what was read from the documents?
// Each row is 'match', 'close' (same person or place written differently: initials, order, a missing word)
// or 'mismatch'. A first step towards the document ownership check (TODO.md).
import { E } from './intake/index.js'
import { isDocOk } from './intake/plan.js'
import { compareAddress, compareNames, words } from './compare.js'

export { compareNames }

const same = (a, b) => (a && b ? (words(a).join(' ') === words(b).join(' ') ? 'match' : 'mismatch') : null)

/** -> [{ field, label, application, document, source, result }] for the rows where both sides have a value. */
export function crossCheck(info = {}, docsByType = {}) {
  const id = isDocOk(docsByType.identity) ? docsByType.identity.verification?.extracted || {} : {}
  const addr = isDocOk(docsByType.address) ? docsByType.address.verification?.extracted || {} : {}
  const pin = (String(addr.pincode || '').match(/\b\d{6}\b/) || [])[0]
  const rows = [
    { field: 'applicant_name', label: 'Applicant name', application: info.applicant_name, document: id.holder_name, source: 'Identity proof', result: compareNames(info.applicant_name, id.holder_name) },
    { field: 'applicant_name', label: 'Name on address proof', application: info.applicant_name, document: addr.holder_name, source: 'Address proof', result: compareNames(info.applicant_name, addr.holder_name) },
    { field: 'holder_name', label: 'Name on ID vs address proof', application: id.holder_name, document: addr.holder_name, source: 'Identity vs address proof', result: compareNames(id.holder_name, addr.holder_name) },
    { field: 'premises_address', label: 'Premises address', application: info.premises_address, document: addr.address_line, source: 'Address proof', result: compareAddress(info.premises_address, addr.address_line) },
    { field: 'city', label: 'City', application: info.city, document: addr.city, source: 'Address proof', result: same(info.city, addr.city) },
    { field: 'pincode', label: 'PIN code', application: info.pincode, document: pin, source: 'Address proof', result: info.pincode && pin ? (String(info.pincode).trim() === pin ? 'match' : 'mismatch') : null },
    { field: 'state', label: 'State', application: info.state, document: addr.state, source: 'Address proof', result: info.state && addr.state ? (E.matchState(addr.state) === info.state ? 'match' : 'mismatch') : null },
  ]
  return rows.filter((r) => r.result)
}
