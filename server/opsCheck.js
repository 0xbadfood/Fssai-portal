// Cross-check for the ops case page: do the application's details agree with what was read from the documents?
// Each row is 'match', 'close' (same person or place written differently: initials, order, a missing word)
// or 'mismatch'. Only the ID / address-proof names block an upload (documentsService); everything here is for
// the ops team to look at, since premises, NOCs and company papers legitimately vary (a landlord, a group company).
import { E } from './intake/index.js'
import { isDocOk } from './intake/plan.js'
import { best, compareAddress, compareBusinessNames, compareNames, words } from './compare.js'

export { compareNames }

const same = (a, b) => (a && b ? (words(a).join(' ') === words(b).join(' ') ? 'match' : 'mismatch') : null)

const DOC_LABEL = { products: 'Product list', layout: 'Layout plan', 'importer-docs': 'Importer documents', 'transporter-proof': 'Turnover / vehicle proof', 'authority-letter': 'Authority letter' }

/** -> [{ field, label, application, document, source, result }] for the rows where both sides have a value. */
export function crossCheck(info = {}, docsByType = {}) {
  const id = isDocOk(docsByType.identity) ? docsByType.identity.verification?.extracted || {} : {}
  const addr = isDocOk(docsByType.address) ? docsByType.address.verification?.extracted || {} : {}
  const pin = (String(addr.pincode || '').match(/\b\d{6}\b/) || [])[0]
  const read = (type) => (isDocOk(docsByType[type]) ? docsByType[type].verification?.extracted || {} : {})
  const premise = read('premise')
  const premisePin = (String(premise.property_address || '').match(/\b\d{6}\b/) || [])[0]
  const person = (doc) => best(compareNames(info.applicant_name, doc), compareBusinessNames(info.legal_name, doc))
  const business = (label, type, field) => {
    const value = read(type)[field]
    return { field: 'legal_name', label, application: info.legal_name, document: value, source: DOC_LABEL[type], result: compareBusinessNames(info.legal_name, value) }
  }
  const rows = [
    { field: 'applicant_name', label: 'Applicant name', application: info.applicant_name, document: id.holder_name, source: 'Identity proof', result: compareNames(info.applicant_name, id.holder_name) },
    { field: 'applicant_name', label: 'Name on address proof', application: info.applicant_name, document: addr.holder_name, source: 'Address proof', result: compareNames(info.applicant_name, addr.holder_name) },
    { field: 'holder_name', label: 'Name on ID vs address proof', application: id.holder_name, document: addr.holder_name, source: 'Identity vs address proof', result: compareNames(id.holder_name, addr.holder_name) },
    { field: 'premises_address', label: 'Premises address', application: info.premises_address, document: addr.address_line, source: 'Address proof', result: compareAddress(info.premises_address, addr.address_line) },
    { field: 'city', label: 'City', application: info.city, document: addr.city, source: 'Address proof', result: same(info.city, addr.city) },
    { field: 'pincode', label: 'PIN code', application: info.pincode, document: pin, source: 'Address proof', result: info.pincode && pin ? (String(info.pincode).trim() === pin ? 'match' : 'mismatch') : null },
    { field: 'state', label: 'State', application: info.state, document: addr.state, source: 'Address proof', result: info.state && addr.state ? (E.matchState(addr.state) === info.state ? 'match' : 'mismatch') : null },
    // Premises proof: the occupant is the applicant or the business; the owner may be a landlord, so not compared.
    { field: 'applicant_name', label: 'Occupant on premise proof', application: [info.applicant_name, info.legal_name].filter(Boolean).join(' / '), document: premise.occupant_name, source: 'Premise proof', result: person(premise.occupant_name) },
    { field: 'premises_address', label: 'Premises address (premise proof)', application: info.premises_address, document: premise.property_address, source: 'Premise proof', result: compareAddress(info.premises_address, premise.property_address) },
    { field: 'pincode', label: 'PIN code (premise proof)', application: info.pincode, document: premisePin, source: 'Premise proof', result: info.pincode && premisePin ? (String(info.pincode).trim() === premisePin ? 'match' : 'mismatch') : null },
    business('Business on product list', 'products', 'business_name'),
    business('Business on layout plan', 'layout', 'business_name'),
    business('Firm on importer documents', 'importer-docs', 'firm_name'),
    business('Business on turnover / vehicle proof', 'transporter-proof', 'entity_name'),
    business('Company on authority letter', 'authority-letter', 'company_name'),
    { field: 'applicant_name', label: 'Person authorised in the letter', application: info.applicant_name, document: read('authority-letter').authorised_person, source: 'Authority letter', result: compareNames(info.applicant_name, read('authority-letter').authorised_person) },
    { field: 'legal_name', label: 'Applicant on local-authority NOC', application: [info.legal_name, info.applicant_name].filter(Boolean).join(' / '), document: read('noc').applicant_name, source: 'NOC', result: person(read('noc').applicant_name) },
  ]
  return rows.filter((r) => r.result)
}
