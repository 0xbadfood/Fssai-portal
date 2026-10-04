import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRightLeft, IndianRupee, Loader2, Lock, MessageSquare, RefreshCw, Search, StickyNote, UserPlus } from 'lucide-react'
import { api, rupees } from '../../lib/catalogue.js'

const FLAGS = {
  quote_requested: { label: 'Quote requested', tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
  customer_replied: { label: '💬 Customer replied', tone: 'bg-orange-50 text-orange-800 ring-orange-100' },
  test_payment: { label: 'Test payment', tone: 'bg-slate-50 text-slate-500 ring-slate-200' },
}
const TABS = [
  { id: 'open', label: 'Open', match: (o) => !['completed', 'cancelled'].includes(o.status) },
  { id: 'quote_requested', label: 'Quote requests', match: (o) => o.status === 'quote_requested' },
  { id: 'new', label: 'New (paid)', match: (o) => o.status === 'new' },
  { id: 'in_progress', label: 'In progress', match: (o) => o.status === 'in_progress' },
  { id: 'awaiting', label: 'Waiting on customer', match: (o) => ['awaiting_customer', 'quoted'].includes(o.status) || !!o.due },
  { id: 'completed', label: 'Completed', match: (o) => o.status === 'completed' },
  { id: 'all', label: 'All', match: () => true },
]
const ago = (t) => {
  const s = (Date.now() - new Date(t).getTime()) / 1000
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`
}
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** /ops/expert: expert-service orders. Everyone on the team sees them; only experts take them. */
export function ExpertQueue() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('open')
  const [who, setWho] = useState('everyone')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)
  const navigate = useNavigate()
  const load = () => api('/api/ops/expert/orders').then(setData).catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    const t = TABS.find((x) => x.id === tab)
    const needle = q.trim().toLowerCase()
    return data.orders
      .filter(t.match)
      .filter((o) => who === 'everyone' || (who === 'mine' ? o.assignee?.id === data.me.id : !o.assignee))
      .filter((o) => !needle || `${o.ref} ${o.serviceName} ${o.customer.name} ${o.customer.business} ${o.customer.email} ${o.customer.phone}`.toLowerCase().includes(needle))
  }, [data, tab, who, q])

  async function take(o) {
    setBusy(o.id)
    try {
      await api(`/api/ops/expert/orders/${o.id}/take`, {})
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (!data && !error) return <p className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={16} /> Loading…</p>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Expert services</h1>
          <p className="text-sm text-slate-500">
            Paid orders and quote requests. {data?.canWork ? 'Take an order to work on it.' : 'Only experts can take these; you can see them and follow progress.'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const n = data ? data.orders.filter(t.match).length : 0
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {t.label} <span className="opacity-60">{n}</span>
            </button>
          )
        })}
        <select value={who} onChange={(e) => setWho(e.target.value)} className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" aria-label="Assigned to">
          <option value="everyone">Everyone</option>
          <option value="mine">Mine</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <label className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref, service, customer…" className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm" aria-label="Search orders" />
        </label>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['Ref', 'Service', 'Customer', 'Status', 'Paid', 'Flags', 'Updated', 'Expert', ''].map((h) => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((o) => (
              <tr key={o.id} onClick={() => navigate(`/ops/orders/${o.id}`)} className="cursor-pointer hover:bg-violet-50/40">
                <td className="px-3 py-3 font-mono text-xs font-bold text-slate-700">{o.ref}</td>
                <td className="px-3 py-3"><p className="font-bold text-slate-900">{o.serviceName}</p>{o.quantity > 1 && <p className="text-xs text-slate-500">{o.quantity} {o.unit === 'SKU' ? 'SKUs' : `${o.unit}s`}</p>}</td>
                <td className="px-3 py-3"><p className="font-semibold text-slate-800">{o.customer.business || o.customer.name}</p><p className="text-xs text-slate-500">{o.customer.name} · {o.customer.phone}</p></td>
                <td className="px-3 py-3 text-slate-700">{o.statusLabel}{o.due && <p className="text-xs font-semibold text-amber-700">Due {rupees(o.due.total)}</p>}</td>
                <td className="px-3 py-3 tabular-nums text-slate-700">{o.paid ? rupees(o.paid) : '—'}</td>
                <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{o.flags.map((f) => <span key={f} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${FLAGS[f]?.tone}`}>{FLAGS[f]?.label || f}</span>)}</div></td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{ago(o.updatedAt)}</td>
                <td className="px-3 py-3 text-slate-700">{o.assignee?.name || <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  {data.canWork && o.assignee?.id !== data.me.id && !['completed', 'cancelled'].includes(o.status) ? (
                    <button disabled={busy === o.id} onClick={() => take(o)} className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                      {busy === o.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Take it
                    </button>
                  ) : !data.canWork && !o.assignee ? <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock size={12} /> Expert only</span> : null}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400">No orders here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const EVENT_TEXT = {
  created: () => 'Order created',
  quote_requested: () => 'Customer asked for a quote',
  payment_mismatch: (d) => `Payment of ${rupees(d.amount)} received (${d.reference}) but ${d.due ? `${rupees(d.due)} was due` : 'nothing was due'}: check with the customer, refund if needed`,
  paid: (d) => `Customer paid ${rupees(d.amount)} (${d.kind === 'topup' ? 'top-up' : d.kind === 'quote' ? 'quote' : 'purchase'}, ${d.reference})`,
  taken: () => 'Taken',
  transferred: (d) => `Transferred${d.note ? `: ${d.note}` : ''}`,
  status: (d) => `Status: ${d.from} → ${d.to}${d.note ? ` (${d.note})` : ''}`,
  note: (d) => d.text,
  expert_message: (d) => `To customer: ${d.text}`,
  customer_message: (d) => `Customer: ${d.text}`,
  charge: (d) => `${d.kind === 'quote' ? 'Quote' : 'Top-up'} sent: ${rupees(d.fee)} + GST = ${rupees(d.total)}${d.note ? `. ${d.note}` : ''}`,
  cancelled_by_customer: () => 'Customer cancelled',
}

/** /ops/orders/:id: one expert-service order. */
export function ExpertOrderPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const load = () => api(`/api/ops/expert/orders/${id}`).then(setData).catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [id])

  async function act(action, body) {
    setBusy(action)
    setError('')
    try {
      setData(await api(`/api/ops/expert/orders/${id}/${action}`, body || {}))
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy('')
    }
  }

  if (!data && !error) return <p className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={16} /> Loading…</p>
  if (!data) return <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</p>
  const { order: o, service, customer, payments, events, experts, me } = data
  const mine = o.assignee?.id === me.id
  const canAssign = me.role === 'admin' || (me.role === 'expert')
  return (
    <div className="space-y-5">
      <Link to="/ops/expert" className="text-sm font-semibold text-violet-600 hover:underline">← Back to expert services</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold text-slate-500">{o.ref}</p>
          <h1 className="text-2xl font-extrabold text-slate-900">{o.serviceName}</h1>
          <p className="text-sm text-slate-500">{service?.section}{o.quantity > 1 ? ` · ${o.quantity} ${o.unit === 'SKU' ? 'SKUs' : `${o.unit}s`}` : ''} · {o.statusLabel}</p>
        </div>
        {!mine && data.canWork && !['completed', 'cancelled'].includes(o.status) && (
          <button disabled={!!busy} onClick={() => act('take')} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 font-bold text-white hover:bg-violet-700"><UserPlus size={16} /> Take it</button>
        )}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr,360px]">
        <div className="space-y-5">
          <Panel title="What the customer asked for">
            <p className="whitespace-pre-wrap text-slate-700">{o.brief || <span className="text-slate-400">No note from the customer.</span>}</p>
          </Panel>
          {service && (
            <Panel title="Service as sold">
              <p className="text-sm text-slate-600">{service.summary}</p>
              <p className="mt-3 text-xs font-bold uppercase text-slate-400">Included</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{service.includes.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="mt-3 text-xs font-bold uppercase text-slate-400">Ask the customer for</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{service.needs.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="mt-3 text-sm text-slate-500">Deliverable: {service.deliverable} · Turnaround: {service.turnaround}</p>
            </Panel>
          )}
          {mine && <WorkPanel o={o} busy={busy} act={act} />}
          <Panel title="Timeline">
            <ol className="space-y-2">
              {events.slice().reverse().map((e, i) => (
                <li key={i} className={`rounded-xl px-3 py-2 text-sm ${e.kind === 'note' ? 'bg-amber-50' : e.kind === 'customer_message' ? 'bg-orange-50' : e.kind === 'expert_message' ? 'bg-violet-50' : 'bg-slate-50'}`}>
                  <p className="text-slate-800">{(EVENT_TEXT[e.kind] || (() => e.kind))(e.detail || {})}</p>
                  <p className="text-[11px] text-slate-400">{e.who || (['customer_message', 'paid', 'payment_mismatch', 'quote_requested', 'created', 'cancelled_by_customer'].includes(e.kind) ? 'Customer' : 'System')} · {when(e.at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Customer">
            <p className="font-bold text-slate-900">{customer.business || customer.name}</p>
            {customer.business && <p className="text-sm text-slate-700">{customer.name}</p>}
            <p className="text-sm text-slate-700">{customer.phone} · {customer.email}</p>
          </Panel>
          <Panel title="Expert">
            <p className="text-slate-800">{o.assignee?.name || 'Not taken yet'}</p>
            {canAssign && <Transfer experts={experts} me={me} current={o.assignee?.id} busy={busy} onTransfer={(to, note) => act('transfer', { to, note })} />}
            {!experts.length && <p className="mt-2 text-xs text-slate-500">No expert accounts yet. Add one on the server: <code>node scripts/ops.mjs add --role expert …</code></p>}
          </Panel>
          <Panel title="Payments">
            {payments.filter((p) => p.status === 'paid').map((p, i) => (
              <p key={i} className="flex justify-between text-sm text-slate-700"><span>{p.purpose === 'service_topup' ? 'Top-up' : 'Payment'} · {when(p.at)}{p.mode !== 'live' ? ` · ${p.mode}` : ''}</span><span className="font-semibold tabular-nums">{rupees(p.amount)}</span></p>
            ))}
            {!payments.some((p) => p.status === 'paid') && <p className="text-sm text-slate-400">Nothing paid yet.</p>}
            {o.due && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Waiting for the customer to pay {rupees(o.due.total)} ({o.due.kind === 'topup' ? 'top-up' : o.due.kind}).</p>}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function WorkPanel({ o, busy, act }) {
  const [msg, setMsg] = useState('')
  const [toCustomer, setToCustomer] = useState(true)
  const [status, setStatus] = useState(o.status)
  const [amount, setAmount] = useState('')
  const [chargeNote, setChargeNote] = useState('')
  const closed = ['completed', 'cancelled'].includes(o.status)
  return (
    <Panel title="Work on this order">
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-700"><MessageSquare size={15} /> Message or note</p>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={toCustomer ? 'The customer sees this on their dashboard.' : 'Internal note: the customer does not see it.'} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="radio" checked={toCustomer} onChange={() => setToCustomer(true)} /> To the customer</label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="radio" checked={!toCustomer} onChange={() => setToCustomer(false)} /> <StickyNote size={13} /> Internal note</label>
            <button disabled={!msg.trim() || !!busy} onClick={async () => (await act('note', { text: msg, toCustomer })) && setMsg('')} className="ml-auto rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Send</button>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-1.5 text-sm font-bold text-slate-700">Status</p>
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" aria-label="Status">
              {[['in_progress', 'In progress'], ['awaiting_customer', 'Waiting on the customer'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button disabled={status === o.status || !!busy} onClick={() => act('status', { status })} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Update</button>
          </div>
        </div>
        {!closed && !o.due && (
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-700"><IndianRupee size={15} /> {o.status === 'quote_requested' ? 'Send a quote' : 'Request a top-up'}</p>
            <p className="mb-2 text-xs text-slate-500">{o.status === 'quote_requested' ? 'Your fee for this request. GST is added.' : 'When the work is larger than the starting fee covered. GST is added.'}</p>
            <div className="flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Fee in ₹" className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" aria-label="Fee in rupees" />
              <input value={chargeNote} onChange={(e) => setChargeNote(e.target.value)} placeholder="What it covers (the customer sees this)" className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" aria-label="What it covers" />
              <button disabled={!amount || !!busy} onClick={async () => (await act('charge', { amount: Number(amount), note: chargeNote })) && (setAmount(''), setChargeNote(''))} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Send</button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

function Transfer({ experts, me, current, busy, onTransfer }) {
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const options = experts.filter((x) => x.id !== current)
  if (!options.length) return null
  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400"><ArrowRightLeft size={12} /> {me.role === 'admin' ? 'Assign to' : 'Transfer to'}</p>
      <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" aria-label="Expert">
        <option value="">Choose an expert…</option>
        {options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" aria-label="Transfer note" />
      <button disabled={!to || !!busy} onClick={() => onTransfer(to, note).then((ok) => ok && (setTo(''), setNote('')))} className="w-full rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">{me.role === 'admin' ? 'Assign' : 'Transfer'}</button>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  )
}
