import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronDown, Loader2, MessageSquare, Receipt, Send, Sparkles, UserCheck } from 'lucide-react'
import { Card, Loading, PageHeader } from '../../components/dashboard/ui.jsx'
import { api, rupees } from '../../lib/catalogue.js'
import { GatewayPanel, PayPanel } from './PaymentsPage.jsx'

const STATUS_TONE = {
  awaiting_payment: 'bg-amber-50 text-amber-800 ring-amber-200',
  quote_requested: 'bg-sky-50 text-sky-700 ring-sky-200',
  quoted: 'bg-amber-50 text-amber-800 ring-amber-200',
  new: 'bg-violet-50 text-violet-700 ring-violet-200',
  in_progress: 'bg-violet-50 text-violet-700 ring-violet-200',
  awaiting_customer: 'bg-orange-50 text-orange-800 ring-orange-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
}
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** /dashboard/services: the customer's expert-service orders. */
export function MyServicesPage() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const load = () => api('/api/orders').then((d) => setOrders(d.orders)).catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])
  if (!orders && !error) return <Loading />
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader emoji="🧑‍⚖️" title="My expert services" subtitle="Services you’ve bought or asked us to quote, and your messages with the expert.">
        <Link to="/services" className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700">
          <Sparkles size={18} /> Browse services
        </Link>
      </PageHeader>
      {error && <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      {orders?.length === 0 && (
        <Card className="text-center">
          <UserCheck size={32} className="mx-auto text-violet-500" />
          <p className="mt-3 text-lg font-extrabold text-slate-900">No expert services yet</p>
          <p className="mt-1 text-slate-500">Licences, labels, formulations, claims, notices and more: 127 services from a food regulatory expert.</p>
          <Link to="/services" className="mt-4 inline-flex items-center gap-1 font-bold text-violet-600">See what our expert can do <ArrowRight size={16} /></Link>
        </Card>
      )}
      {orders?.map((o) => <OrderCard key={o.id} order={o} onChange={load} />)}
    </div>
  )
}

function OrderCard({ order: o, onChange }) {
  const [open, setOpen] = useState(o.status === 'awaiting_customer')
  const [thread, setThread] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const loadThread = () => api(`/api/orders/${o.id}`).then((d) => setThread(d.messages)).catch((e) => setError(e.message))
  useEffect(() => {
    if (open && !thread) loadThread()
  }, [open])

  async function act(path, body) {
    setBusy(true)
    setError('')
    try {
      await api(`/api/orders/${o.id}/${path}`, body || {})
      setText('')
      await loadThread()
      onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const unpaidStart = o.status === 'awaiting_payment'
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{o.ref} · {when(o.createdAt)}</p>
          <Link to={`/services/${o.serviceId}`} className="text-lg font-extrabold text-slate-900 hover:text-violet-700">{o.serviceName}</Link>
          {o.unit && o.quantity > 1 && <p className="text-sm text-slate-500">{o.quantity} {o.unit === 'SKU' ? 'SKUs' : `${o.unit}s`}</p>}
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ring-1 ${STATUS_TONE[o.status]}`}>{o.statusLabel}</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          {o.due && (
            <Link to={`/dashboard/services/${o.id}/pay`} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700">
              Pay {rupees(o.due.total)} <ArrowRight size={16} />
            </Link>
          )}
          {o.due?.kind === 'quote' && <p className="text-xs text-slate-500">Quote from the expert</p>}
          {o.due?.kind === 'topup' && <p className="text-xs text-slate-500">Top-up for additional work</p>}
          {['awaiting_payment', 'quote_requested', 'quoted'].includes(o.status) && (
            <button type="button" disabled={busy} onClick={() => act('cancel')} className="text-xs font-semibold text-slate-400 hover:text-red-600">Cancel</button>
          )}
        </div>
      </div>
      {o.due?.note && <p className="mx-5 mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><b>From the expert:</b> {o.due.note}</p>}
      {!unpaidStart && (
        <button type="button" onClick={() => setOpen((x) => !x)} className="flex w-full items-center gap-2 border-t border-slate-100 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
          <MessageSquare size={16} /> Messages with the expert <ChevronDown size={16} className={`ml-auto transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && !unpaidStart && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-5">
          {!thread && <p className="text-sm text-slate-400">Loading…</p>}
          {thread?.length === 0 && <p className="text-sm text-slate-500">No messages yet. The expert will write here, and you can reply.</p>}
          {thread?.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === 'you' ? 'ml-auto bg-violet-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-100'}`}>
              {m.charge ? <p><b>{m.charge.kind === 'quote' ? 'Quote' : 'Top-up'}:</b> {rupees(m.charge.total)} incl. GST{m.charge.note ? `. ${m.charge.note}` : ''}</p> : <p className="whitespace-pre-wrap">{m.text}</p>}
              <p className={`mt-1 text-[11px] ${m.from === 'you' ? 'text-white/70' : 'text-slate-400'}`}>{m.from === 'you' ? 'You' : m.name || 'Expert'} · {when(m.at)}</p>
            </div>
          ))}
          {!['cancelled', 'completed'].includes(o.status) && (
            <div className="flex gap-2 pt-1">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Write to the expert…" aria-label="Message to the expert"
                className="flex-1 rounded-2xl border-2 border-slate-100 bg-white px-4 py-2.5 text-sm focus:border-violet-400 focus:outline-none" />
              <button type="button" disabled={busy || !text.trim()} onClick={() => act('reply', { text })} aria-label="Send"
                className="self-end rounded-2xl bg-violet-600 p-3 text-white hover:bg-violet-700 disabled:opacity-50">{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
            </div>
          )}
        </div>
      )}
      {error && <p className="mx-5 mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Card>
  )
}

/** /dashboard/services/:id/pay: pay what's due on an order (the purchase, a quote or a top-up). */
export function ServiceCheckoutPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [paid, setPaid] = useState(null)
  useEffect(() => {
    api(`/api/orders/${id}`).then(setData).catch((e) => setError(e.message))
  }, [id])
  if (error) return <p className="mx-auto max-w-3xl rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>
  if (!data) return <Loading />
  const o = data.order

  if (paid) {
    return (
      <div className="mx-auto max-w-3xl rounded-[32px] bg-gradient-to-br from-emerald-500 to-teal-500 p-7 text-white shadow-xl shadow-emerald-100 sm:p-9">
        <CheckCircle2 size={48} />
        <h2 className="mt-3 text-3xl font-extrabold">Payment successful 🎉</h2>
        <p className="mt-2 text-lg text-white/90">Reference <b className="font-mono">{paid.reference}</b> · Order {o.ref}</p>
        <p className="mt-1 text-white/85">Our expert has your request and will contact you, usually within one working day. You can message them from My expert services.</p>
        <Link to="/dashboard/services" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-emerald-700 shadow hover:bg-emerald-50">
          Go to My expert services <ArrowRight size={18} />
        </Link>
      </div>
    )
  }
  if (!o.due) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <p className="text-lg font-extrabold text-slate-900">Nothing to pay on {o.ref}</p>
          <Link to="/dashboard/services" className="mt-3 inline-flex items-center gap-1 font-bold text-violet-600">My expert services <ArrowRight size={16} /></Link>
        </Card>
      </div>
    )
  }

  async function pay(method, outcome) {
    try {
      const r = await api(`/api/orders/${o.id}/pay`, { method, outcome })
      if (r.payment.status === 'paid') setPaid(r.payment)
      return { result: r.payment }
    } catch (e) {
      return { error: e.message }
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader emoji="🧾" title="Checkout" subtitle={o.due.kind === 'quote' ? 'Pay the expert’s quote to start the work.' : o.due.kind === 'topup' ? 'Pay the top-up for the additional work.' : 'Pay for your expert service.'} />
      <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-violet-500">Order summary</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{o.serviceName}</p>
          <p className="text-sm text-slate-500">Order {o.ref}</p>
          <ul className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            {o.due.items.map((i) => (
              <li key={i.label} className="flex justify-between gap-4 text-slate-700"><span>{i.label}</span><span className="font-semibold tabular-nums">{rupees(i.amount)}</span></li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-lg font-extrabold text-slate-900"><span>Total</span><span className="tabular-nums">{rupees(o.due.total)}</span></div>
          {o.due.note && <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><b>From the expert:</b> {o.due.note}</p>}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400"><Receipt size={12} /> A professional fee to MyFoodLicense. Government fees, if any, are paid separately.</p>
        </Card>
        {data.paymentMode === 'test' ? (
          <PayPanel test label={`Pay ${rupees(o.due.total)}`} onPay={pay} />
        ) : (
          <GatewayPanel mode={data.paymentMode} label={`Pay ${rupees(o.due.total)}`} start={{ orderId: o.id }} />
        )}
      </div>
    </div>
  )
}
