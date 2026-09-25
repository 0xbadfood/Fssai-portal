import { STATUS } from './eligibility.js'

export const kpis = [
  { id: 'active', label: 'Active Applications', value: '12', hint: '↑ 2 new this month', tone: 'blue' },
  { id: 'docs', label: 'Documents Verified', value: '28', hint: '95% verification rate', tone: 'green' },
  { id: 'pending', label: 'Pending Actions', value: '4', hint: 'Needs your attention', tone: 'orange' },
  { id: 'compliance', label: 'Compliance Score', value: '92%', hint: 'Excellent', tone: 'blue' },
]

export const liveApplication = {
  reference: 'FCPL-2024-08173',
  type: 'State Licence – Restaurants',
  status: STATUS.UNDER_SCRUTINY,
  submittedOn: '12 Mar 2024',
  steps: [
    { label: 'Business Details', date: '12 Mar', done: true },
    { label: 'KoB Selection', date: '13 Mar', done: true },
    { label: 'Documents', date: '15 Mar', done: true },
    { label: 'Fee Payment', date: '15 Mar', done: true },
    { label: 'Submission', date: '16 Mar', done: true },
    { label: 'Scrutiny', date: '', done: false, current: true },
    { label: 'Approval', date: '', done: false },
  ],
}

export const documentChecklist = {
  common: [
    { id: 'identity', label: 'Identity Proof (Aadhaar / PAN / Passport)', tag: 'Common' },
    { id: 'address', label: 'Address Proof (Electricity bill / Rent agreement)', tag: 'Common' },
    { id: 'premise', label: 'Premise Proof (Ownership / Rent / NOC)', tag: 'Common' },
    { id: 'products', label: 'Product List (Food products to be manufactured / sold)', tag: 'Common' },
  ],
  conditional: [
    { id: 'layout', label: 'Layout Plan (Premises layout plan)', tag: 'Conditional', businessTypes: ['manufacturer'] },
    { id: 'noc', label: 'NOC (if applicable, from local authority)', tag: 'Conditional', businessTypes: ['manufacturer', 'foodService'] },
  ],
  specific: [
    { id: 'importer-docs', label: 'Importer Documents (IEC, Import details)', tag: 'Business-Type Specific', businessTypes: ['importer'] },
    { id: 'water-test', label: 'Water Test Report (For food businesses using water)', tag: 'Business-Type Specific', businessTypes: ['manufacturer', 'foodService'] },
    { id: 'authority-letter', label: 'Authority Letter (Authorisation / Board resolution)', tag: 'Business-Type Specific', businessTypes: ['multiStateHeadOffice'] },
    { id: 'hracc', label: 'HRACC Certificate (as applicable)', tag: 'Business-Type Specific', businessTypes: ['foodService'] },
    { id: 'transporter-proof', label: 'Turnover proof or vehicle declaration', tag: 'Business-Type Specific', businessTypes: ['tradeRetailStorageTransport'] },
  ],
}

export const documentVault = [
  { id: 'identity', label: 'ID Proof (Director/Proprietor)', status: 'Verified' },
  { id: 'address', label: 'Address Proof (Business)', status: 'Verified' },
  { id: 'premise', label: 'Premise Proof', status: 'Uploaded' },
  { id: 'products', label: 'Product List', status: 'Uploaded' },
  { id: 'layout', label: 'Layout Plan', status: 'Action Needed' },
  { id: 'noc', label: 'NOC (if applicable)', status: 'Not Required' },
  { id: 'importer', label: 'Importer Documents', status: 'Uploaded' },
]

export const businessTypeOptions = [
  { id: 'manufacturer', label: 'Manufacturer', icon: 'Factory' },
  { id: 'importer', label: 'Importer', icon: 'Ship' },
  { id: 'foodService', label: 'Restaurant', icon: 'UtensilsCrossed' },
  { id: 'tradeRetailStorageTransport', label: 'Transporter', icon: 'Truck' },
  { id: 'distributor', label: 'Distributor', icon: 'Package' },
]

export const applicationFunnel = [
  { label: 'Started', value: 24, tone: 'blue' },
  { label: 'Docs Submitted', value: 18, tone: 'sky' },
  { label: 'Under Scrutiny', value: 14, tone: 'orange' },
  { label: 'Approved', value: 11, tone: 'green' },
  { label: 'Pending', value: 2, tone: 'red' },
]

export const approvalTimeline = [
  { month: 'Jan', days: 22 },
  { month: 'Feb', days: 20 },
  { month: 'Mar', days: 19 },
  { month: 'Apr', days: 21 },
  { month: 'May', days: 17 },
  { month: 'Jun', days: 18 },
]

export const premises = [
  {
    id: 'p1',
    name: 'Mumbai – Main Kitchen',
    address: 'Andheri (E), Mumbai, Maharashtra',
    status: 'Active',
  },
  {
    id: 'p2',
    name: 'Pune – Processing Unit',
    address: 'Chakan, Pune, Maharashtra',
    status: 'Active',
  },
]

export const recentActivity = [
  { id: 1, text: 'Documents verified for State Licence', time: '2 hours ago', tone: 'green' },
  { id: 2, text: 'Fee payment of ₹7,500 successful', time: '1 day ago', tone: 'blue' },
  { id: 3, text: 'Additional document requested', time: '2 days ago', tone: 'orange' },
  { id: 4, text: 'Application submitted successfully', time: '3 days ago', tone: 'blue' },
]

export const licences = [
  {
    id: 'lic1',
    reference: '12724012000173',
    kind: 'FSSAI Registration',
    status: STATUS.APPROVED,
    kob: ['Food Service'],
    premise: 'Mumbai – Main Kitchen',
    validity: 'Perpetual — no periodic renewal required',
    granted: true,
  },
  {
    id: 'lic2',
    reference: 'FCPL-2024-08173',
    kind: 'State Licence',
    status: STATUS.UNDER_SCRUTINY,
    kob: ['Food Service', 'Trade / Retail'],
    premise: 'Mumbai – Main Kitchen',
    validity: 'Pending grant',
    granted: false,
  },
  {
    id: 'lic3',
    reference: 'FCPL-2024-05590',
    kind: 'Central Licence',
    status: STATUS.CLARIFICATION_REQUESTED,
    kob: ['Importer'],
    premise: 'Pune – Processing Unit',
    validity: 'Pending grant',
    granted: false,
  },
  {
    id: 'lic4',
    reference: '11424018000552',
    kind: 'State Licence',
    status: STATUS.APPROVED,
    kob: ['Manufacturing'],
    premise: 'Pune – Processing Unit',
    validity: 'Perpetual — no periodic renewal required',
    granted: true,
  },
]

export const payments = [
  { id: 'pay1', ref: 'PMT-88213', desc: 'State Licence — Application Fee', amount: '₹7,500', date: '15 Mar 2024', status: 'Paid' },
  { id: 'pay2', ref: 'PMT-88044', desc: 'FSSAI Registration — Application Fee', amount: '₹100', date: '02 Feb 2024', status: 'Paid' },
  { id: 'pay3', ref: 'PMT-87990', desc: 'Central Licence — Application Fee', amount: '₹7,500', date: '20 Jan 2024', status: 'Paid' },
  { id: 'pay4', ref: 'PMT-88301', desc: 'Modification Fee — Premises Update', amount: '₹1,000', date: 'Due 30 Mar 2024', status: 'Due' },
]

export const notices = [
  {
    id: 'n1',
    title: 'Clarification requested on Central Licence application',
    body: 'Please re-upload a legible copy of your Importer Exporter Code (IEC) certificate for reference FCPL-2024-05590.',
    status: STATUS.CLARIFICATION_REQUESTED,
    date: '18 Mar 2024',
  },
  {
    id: 'n2',
    title: 'Layout plan requires resubmission',
    body: 'The uploaded premises layout plan does not match the declared floor area. Please resubmit for reference FCPL-2024-08173.',
    status: STATUS.CLARIFICATION_REQUESTED,
    date: '14 Mar 2024',
  },
  {
    id: 'n3',
    title: 'Registration approved',
    body: 'Your FSSAI Registration for Mumbai – Main Kitchen has been granted with perpetual validity.',
    status: STATUS.APPROVED,
    date: '02 Feb 2024',
  },
]

export const aiQuickChips = [
  'Check correct licence type',
  'Review KoB selection',
  'Missing mandatory document',
  'Estimate fee',
]

export const aiScriptedReplies = {
  'Check correct licence type':
    'Based on your latest application, your annual turnover (₹5–20 Cr) falls in the ₹1.5 Cr–₹50 Cr bracket, so a State Licence is correct — unless you import goods or sell via e-commerce, which would require a Central Licence instead.',
  'Review KoB selection':
    'Your current Kind of Business selections are Food Service and Trade/Retail. Remember: one premise can hold multiple KoBs under the same approval, so you don’t need separate applications for each.',
  'Missing mandatory document':
    'Your Layout Plan is marked "Action Needed" in the Document Vault. It’s required for manufacturing and food-service premises before scrutiny can complete.',
  'Estimate fee':
    'State Licence fees are typically ₹2,000–₹7,500 per year depending on your Kind of Business, capped for most single-premise applicants. Central Licence fees are a flat ₹7,500/year.',
}
