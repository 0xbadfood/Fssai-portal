// What an application still needs, worked out on the server from the intake result (graph v2):
// the licence and fee, the Form A/B details to collect, the documents to upload (and the ones prepared on the
// filing call), details read from uploaded documents, readiness, and the filled-in form.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from '../db.js'
import { E, resultFor, summaryFor } from './index.js'

const DOC_MAP = JSON.parse(readFileSync(path.join(repoRoot, 'config/intake/documents.json'), 'utf8'))
const DOC_TYPES = JSON.parse(readFileSync(path.join(repoRoot, 'config/document-types.json'), 'utf8')).types

const acts = (f) => f.activities || []
const trade = (f) => f.trade_kinds || []

// ---------- Details (Form A/B fields). Mostly taps; typing only where unavoidable. ----------

const PRODUCT_SUGGESTIONS = {
  cook: ['Meals & thalis', 'Snacks & fast food', 'Sweets & desserts', 'Tea, coffee & juices', 'Bakery items', 'Tiffin / meal boxes'],
  make: ['Bakery products', 'Namkeen & snacks', 'Pickles & preserves', 'Spices & masalas', 'Dairy products', 'Sweets & confectionery', 'Edible oil', 'Ready-to-eat food', 'Packaged drinking water'],
  sell: ['Groceries & provisions', 'Packaged foods', 'Fruits & vegetables', 'Dairy products', 'Beverages', 'Meat & fish'],
  import: ['Edible oils', 'Dry fruits & nuts', 'Chocolates & confectionery', 'Beverages', 'Packaged foods', 'Food ingredients'],
  export: ['Spices', 'Rice & grains', 'Processed foods', 'Tea & coffee', 'Marine products', 'Fruits & vegetables'],
}
const productSuggestions = (f) => [...new Set([...(f.products || []), ...acts(f).flatMap((a) => PRODUCT_SUGGESTIONS[a] || [])])]

export const FIELDS = [
  { id: 'legal_name', section: 'Business', label: 'Business name', type: 'text', example: 'Sharma Foods' },
  { id: 'entity_type', section: 'Business', label: 'Type of business', type: 'choice', options: ['Proprietorship', 'Partnership', 'LLP', 'Private Ltd company', 'Public Ltd company', 'Trust / Society / Co-op'] },
  { id: 'products', section: 'Business', label: 'What food do you make or sell?', type: 'multichoice', suggestions: productSuggestions },
  { id: 'operating_since', section: 'Business', label: 'How long have you been running?', type: 'choice', options: ['Not started yet', 'Less than 1 year', '1–5 years', 'More than 5 years'] },

  { id: 'applicant_name', section: 'You', label: 'Your full name', type: 'text', example: 'Rahul Kumar Sharma' },
  { id: 'designation', section: 'You', label: 'Your role', type: 'choice', options: ['Owner / Proprietor', 'Partner', 'Director', 'Manager', 'Authorised signatory'] },
  { id: 'mobile', section: 'You', label: 'Mobile number', type: 'text', example: '98765 43210', inputMode: 'tel' },
  { id: 'email', section: 'You', label: 'Email', type: 'text', example: 'you@business.com', inputMode: 'email' },

  { id: 'premises_address', section: 'Premises', label: 'Address of the premises', type: 'text', example: 'Shop 4, Ganesh Market, MG Road' },
  { id: 'city', section: 'Premises', label: 'City / town', type: 'text', example: 'Pune' },
  { id: 'pincode', section: 'Premises', label: 'PIN code', type: 'text', example: '411001', inputMode: 'numeric' },
  { id: 'state', section: 'Premises', label: 'State', type: 'choice', options: (f) => f.states || [], hideIfSingle: true },

  { id: 'employees', section: 'Operations', label: 'How many people work there?', type: 'choice', options: ['1–5', '6–20', '21–50', '51–200', 'More than 200'], forms: ['B'] },
  { id: 'water_source', section: 'Operations', label: 'Where does your water come from?', type: 'choice', options: ['Municipal supply', 'Borewell', 'Tanker / packaged water', 'Water not used'], forms: ['B'] },
  { id: 'capacity', section: 'Operations', label: 'How much do you produce per day?', type: 'choice', options: ['Up to 100 kg / L', '100 kg – 2 tonnes', '2 – 10 tonnes', 'More than 10 tonnes'], forms: ['B'], when: (f) => acts(f).includes('make') },
  { id: 'seating', section: 'Operations', label: 'How many seats for customers?', type: 'choice', options: ['Takeaway / delivery only', 'Up to 20', '21–50', 'More than 50'], forms: ['B'], when: (f) => acts(f).includes('cook') },
  { id: 'vehicles', section: 'Operations', label: 'Food transport vehicles you own', type: 'choice', options: ['None', '1', '2–5', 'More than 5'], forms: ['B'], when: (f) => trade(f).includes('transport') || f.place === 'vehicles' },
  { id: 'storage_type', section: 'Operations', label: 'What kind of storage?', type: 'choice', options: ['Dry storage / godown', 'Cold storage', 'Both'], forms: ['B'], when: (f) => trade(f).some((t) => t.startsWith('storage')) },
  { id: 'iec_number', section: 'Operations', label: 'Import Export Code (IEC)', type: 'text', example: '0512345678', inputMode: 'numeric', when: (f) => acts(f).includes('import') || acts(f).includes('export') },
]
export const FIELD_IDS = new Set(FIELDS.map((f) => f.id))

/** The fields for this application, with options resolved (the browser gets plain data). */
function fieldsFor(facts, kind) {
  return FIELDS.filter((fd) => (!fd.forms || fd.forms.includes(kind)) && (!fd.when || fd.when(facts))).map(({ when, forms, options, suggestions, ...fd }) => ({
    ...fd,
    ...(options ? { options: typeof options === 'function' ? options(facts) : options } : {}),
    ...(suggestions ? { suggestions: suggestions(facts) } : {}),
  }))
}

const filled = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v != null)

// ---------- Details read from documents ----------

const titleCase = (x) => x.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
const clean = (x) => (typeof x === 'string' && x.trim() && x.trim().toLowerCase() !== 'null' ? x.trim() : null)
const readable = (x) => x && (x === x.toUpperCase() ? titleCase(x) : x)
// The ops team's review overrides the AI check either way.
export const isDocOk = (doc) => (doc?.opsStatus ? doc.opsStatus === 'approved' : doc?.status === 'accepted' || doc?.status === 'review')

/** Facts read from accepted documents, normalised by code. Each value carries its source label. */
export function docFacts(docsByType = {}) {
  const out = {}
  const id = isDocOk(docsByType.identity) ? docsByType.identity.verification?.extracted || {} : {}
  const addr = isDocOk(docsByType.address) ? docsByType.address.verification?.extracted || {} : {}
  const put = (k, v, source) => v && (out[k] = { value: v, source })
  put('applicant_name', readable(clean(id.holder_name)), 'your ID')
  put('premises_address', readable(clean(addr.address_line)), 'your address proof')
  put('city', readable(clean(addr.city)), 'your address proof')
  put('pincode', (String(addr.pincode || '').match(/\b\d{6}\b/) || String(addr.address_line || '').match(/\b\d{6}\b/) || [])[0], 'your address proof')
  put('state', E.matchState(addr.state) || E.matchState(addr.address_line), 'your address proof')
  return out
}

/** Saved details with gaps filled from documents first, then the account and the intake. */
function prefill(facts, user, info, read) {
  const sources = {}
  const out = { ...info }
  if (out.state && !(facts.states || []).includes(out.state)) delete out.state
  const docState = read.state && (facts.states || []).includes(read.state.value) ? read.state : null
  const candidates = {
    applicant_name: [read.applicant_name, { value: user.name, source: 'your account' }],
    legal_name: [{ value: user.businessName, source: 'your account' }],
    mobile: [{ value: user.phone, source: 'your account' }],
    email: [{ value: user.email, source: 'your account' }],
    premises_address: [read.premises_address],
    city: [read.city, { value: facts.city, source: 'your answers' }],
    pincode: [read.pincode],
    state: [docState, { value: facts.states?.length === 1 ? facts.states[0] : undefined, source: 'your answers' }],
    products: [{ value: facts.products, source: 'your answers' }],
  }
  for (const [k, list] of Object.entries(candidates)) {
    if (filled(out[k])) continue
    const hit = list.find((c) => c && filled(c.value))
    if (hit) {
      out[k] = hit.value
      sources[k] = hit.source
    }
  }
  return { info: out, sources }
}

// ---------- Documents ----------

/** Upload types for the result's documents, plus the ones prepared on the filing call. */
function documentsFor(result, kind, info) {
  const upload = new Map()
  const filingCall = []
  for (const d of result?.documents || []) {
    const targets = DOC_MAP.upload[d.id]
    if (!targets) {
      filingCall.push({ id: d.id, label: d.label })
      continue
    }
    for (const t of targets) {
      const prev = upload.get(t.type)
      const optional = !!t.optional && (prev ? prev.optional : true)
      upload.set(t.type, { id: t.type, why: prev?.why || t.why || d.label, optional })
    }
  }
  // A company, partnership or trust also authorises the person who signs (portal rule, alongside Form IX).
  if (kind === 'B' && info.entity_type && info.entity_type !== 'Proprietorship') {
    upload.set('authority-letter', { id: 'authority-letter', why: `Needed for ${info.entity_type === 'LLP' ? 'an LLP' : `a ${info.entity_type.toLowerCase()}`} to authorise the applicant`, optional: false })
  }
  return { docs: [...upload.values()].filter((d) => DOC_TYPES[d.id]), filingCall }
}

// ---------- The filled-in form ----------

function buildForm(facts, info, result, kind, docs, docsByType) {
  const v = (x) => (Array.isArray(x) ? x.join(', ') : x) || null
  const row = (id) => summaryFor(facts).find((r) => r.id === id)?.value
  const sections = [
    { title: 'Particulars of the applicant', rows: [['Name of applicant', v(info.applicant_name)], ['Designation', v(info.designation)], ['Mobile', v(info.mobile)], ['Email', v(info.email)]] },
    {
      title: 'Particulars of the food business',
      rows: [
        ['Name of business', v(info.legal_name)],
        ['Constitution', v(info.entity_type)],
        ['Kind of business', v(result.kinds) || '—'],
        ['Activities', row('activity') || '—'],
        ['Food products / categories', v(info.products)],
        ['Operating since', v(info.operating_since)],
        ['Annual turnover', row('turnover') || 'Not needed for this licence'],
        ['Sells online', facts.sells_online ? 'Yes' : 'No'],
      ],
    },
    { title: 'Address of the premises', rows: [['Address', v(info.premises_address)], ['City / town', v(info.city)], ['PIN code', v(info.pincode)], ['State', v(info.state)]] },
  ]
  const iec = acts(facts).includes('import') || acts(facts).includes('export')
  if (kind === 'B') {
    const ops = [['Number of employees', v(info.employees)], ['Source of water', v(info.water_source)]]
    if (acts(facts).includes('make')) ops.push(['Production capacity per day', v(info.capacity)])
    if (acts(facts).includes('cook')) ops.push(['Seating capacity', v(info.seating)])
    if (trade(facts).includes('transport') || facts.place === 'vehicles') ops.push(['Transport vehicles', v(info.vehicles)])
    if (trade(facts).some((t) => t.startsWith('storage'))) ops.push(['Storage', v(info.storage_type)])
    if (iec) ops.push(['IEC number', v(info.iec_number)])
    if ((facts.states || []).length > 1) ops.push(['States of operation', v(facts.states)])
    sections.push({ title: 'Operations', rows: ops })
  } else if (iec) {
    sections[1].rows.push(['IEC number', v(info.iec_number)])
  }
  sections.push({
    title: 'Documents enclosed',
    rows: docs.map((d) => {
      const doc = docsByType[d.id]
      return [DOC_TYPES[d.id].label, isDocOk(doc) ? `✓ ${doc.file?.name || 'uploaded'}` : d.optional ? 'Not enclosed (optional)' : null]
    }),
  })
  return { kind, title: kind === 'A' ? 'Form A — Application for Registration' : `Form B — Application for ${result.licence}`, licence: result.licence, sections }
}

// ---------- Everything together ----------

/**
 * The plan for an application: { result, kind, intakeDone, fields, prefill, readFromDocs, docs, filingCall,
 * missingFields, missingDocs, ready, form }. user: { name, businessName, phone, email }.
 */
export function planFor(facts, info = {}, docsByType = {}, user = {}) {
  const result = resultFor(facts)
  const intakeDone = !!result
  const kind = result?.form || null
  const readFromDocs = docFacts(docsByType)
  const fields = intakeDone && kind ? fieldsFor(facts, kind) : []
  const { docs, filingCall } = intakeDone && kind ? documentsFor(result, kind, info) : { docs: [], filingCall: [] }
  const missingFields = fields.filter((fd) => !filled(info[fd.id])).map((fd) => fd.id)
  const missingDocs = docs.filter((d) => !d.optional && !isDocOk(docsByType[d.id])).map((d) => d.id)
  const { documents, ...publicResult } = result || {}
  return {
    result: result ? publicResult : null,
    kind,
    intakeDone,
    fields,
    prefill: prefill(facts, user, info, readFromDocs),
    readFromDocs,
    docs,
    filingCall,
    missingFields,
    missingDocs,
    ready: intakeDone && !!kind && !missingFields.length && !missingDocs.length,
    form: intakeDone && kind ? buildForm(facts, info, publicResult, kind, docs, docsByType) : null,
  }
}
