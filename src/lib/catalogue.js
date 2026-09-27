// Expert-services catalogue on the client: loaded once from /api/services (the server owns the prices),
// plus the label helpers the services pages and checkout share.
import { useEffect, useState } from 'react'

export async function api(path, body) {
  const res = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status })
  return data
}

let pending = null
export function useCatalogue() {
  const [cat, setCat] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    pending ??= api('/api/services')
    pending.then(setCat).catch((e) => {
      pending = null
      setError(e.message)
    })
  }, [])
  return { cat, error }
}

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** The service + its section and heading, by id. */
export function findService(cat, id) {
  for (const section of cat?.sections || []) {
    const svc = section.services.find((s) => s.id === id)
    if (svc) return { svc, section, head: cat.heads.find((h) => h.sections.includes(section.id)) }
  }
  return null
}

export const unitOf = (price) => price.unit || (price.type === 'monthly' ? 'month' : null)

/** "₹5,000 onwards", "₹5,000–7,500 per SKU", "₹15,000 a month", "Custom quote". */
export function priceLabel(price, { short = false } = {}) {
  const unit = unitOf(price)
  const per = unit && price.type !== 'monthly' ? ` per ${unit}` : ''
  if (price.type === 'quote') return 'Custom quote'
  if (price.type === 'monthly') return `${rupees(price.amount)} a month`
  if (price.type === 'range') return short ? `from ${rupees(price.amount)}${per}` : `${rupees(price.amount)}–${Number(price.max).toLocaleString('en-IN')}${per}`
  if (price.type === 'from') return `${rupees(price.amount)} onwards${per}`
  return `${rupees(price.amount)}${per}`
}

/** What "Buy" charges now: the starting figure (a top-up later if the work turns out larger). */
export const startingFee = (price) => (price.type === 'quote' ? null : price.amount)

// Colour of each heading (config/services.json `tone`), used for the 3D bars.
export const TONES = {
  emerald: { from: '#10b981', to: '#0f766e', soft: '#ecfdf5', ink: '#047857', ring: '#a7f3d0' },
  violet: { from: '#8b5cf6', to: '#6d28d9', soft: '#f5f3ff', ink: '#6d28d9', ring: '#ddd6fe' },
  orange: { from: '#fb923c', to: '#db2777', soft: '#fff7ed', ink: '#c2410c', ring: '#fed7aa' },
  sky: { from: '#38bdf8', to: '#4f46e5', soft: '#f0f9ff', ink: '#0369a1', ring: '#bae6fd' },
  rose: { from: '#fb7185', to: '#be123c', soft: '#fff1f2', ink: '#be123c', ring: '#fecdd3' },
  amber: { from: '#fbbf24', to: '#d97706', soft: '#fffbeb', ink: '#b45309', ring: '#fde68a' },
}
