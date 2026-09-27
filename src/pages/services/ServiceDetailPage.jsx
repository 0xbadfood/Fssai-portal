import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ClipboardList, Clock, FileCheck2, Info, Loader2, Minus, Plus, ShieldCheck, ShoppingCart, Send } from 'lucide-react'
import LandingNavbar from '../../components/landing/LandingNavbar.jsx'
import Footer from '../../components/landing/Footer.jsx'
import { isOpsRole, useAuth } from '../../lib/auth.jsx'
import { TONES, api, findService, priceLabel, rupees, unitOf, useCatalogue } from '../../lib/catalogue.js'
import { ServiceBar } from './ServicesPage.jsx'

/** One expert service: what to expect, and Buy (or Request a quote) at the bottom. */
export default function ServiceDetailPage() {
  const { id } = useParams()
  const { cat, error } = useCatalogue()
  const found = cat && findService(cat, id)

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      {!cat && !error && <p className="flex items-center justify-center gap-2 py-32 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading…</p>}
      {error && <p className="mx-auto my-20 max-w-3xl rounded-2xl bg-red-50 p-4 text-red-700">The service could not be loaded: {error}</p>}
      {cat && !found && (
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="text-2xl font-extrabold text-slate-900">We couldn’t find that service.</p>
          <Link to="/services" className="mt-4 inline-block font-bold text-violet-600">See all expert services →</Link>
        </div>
      )}
      {found && <Detail cat={cat} {...found} />}
      <Footer />
    </div>
  )
}

function Detail({ cat, svc, section, head }) {
  const tone = TONES[head?.tone] || TONES.violet
  const related = section.services.filter((s) => s.id !== svc.id).slice(0, 4)
  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-100" style={{ backgroundImage: `linear-gradient(135deg, ${tone.soft}, #ffffff 60%)` }}>
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <Link to="/services" className="inline-flex items-center gap-1 font-semibold hover:text-slate-800"><ArrowLeft size={14} /> Expert services</Link>
            <span>/</span>
            <span>{head?.title}</span>
            <span>/</span>
            <span className="font-semibold" style={{ color: tone.ink }}>{section.title}</span>
          </nav>
          <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl" style={{ textWrap: 'balance' }}>{svc.name}</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-600">{svc.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <Chip tone={tone}><ClipboardList size={14} /> {svc.scope}</Chip>
            <Chip tone={tone}><Clock size={14} /> {svc.turnaround}</Chip>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr,380px] lg:px-8">
        <div className="space-y-6">
          <Block title="What’s included" icon={CheckCircle2} tone={tone}>
            <ul className="space-y-2.5">
              {svc.includes.map((x) => (
                <li key={x} className="flex gap-3 text-slate-700"><CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: tone.from }} /> {x}</li>
              ))}
            </ul>
          </Block>
          <div className="grid gap-6 md:grid-cols-2">
            <Block title="What you get" icon={FileCheck2} tone={tone}>
              <p className="text-slate-700">{svc.deliverable}</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Clock size={15} /> Typically {svc.turnaround.charAt(0).toLowerCase() + svc.turnaround.slice(1)}</p>
            </Block>
            <Block title="What we’ll need from you" icon={ClipboardList} tone={tone}>
              <ul className="list-disc space-y-1.5 pl-5 text-slate-700">{section.needs.map((n) => <li key={n}>{n}</li>)}</ul>
            </Block>
          </div>
          {section.note && (
            <p className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200"><Info size={18} className="shrink-0" /> {section.note}</p>
          )}
          <Block title="How it works" icon={ShieldCheck} tone={tone}>
            <ol className="grid gap-3 sm:grid-cols-2">
              {[
                svc.price.type === 'quote' ? 'Tell us what you need; the expert sends you a quote to pay online.' : 'Pay the starting fee online (+ GST).',
                'Our expert contacts you, usually within one working day, and asks for what’s needed.',
                'The expert works on it with you; you can message them from your dashboard.',
                'You receive the deliverable. Bigger scope than expected? You get a top-up quote first.',
              ].map((t, i) => (
                <li key={t} className="flex gap-3 text-sm text-slate-600">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundImage: `linear-gradient(135deg, ${tone.from}, ${tone.to})` }}>{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </Block>
          {cat.tentative && <p className="text-xs text-slate-400">This description is being finalised with our expert and may change. The exact scope is confirmed when the expert contacts you.</p>}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <BuyCard svc={svc} tone={tone} gstRate={cat.gstRate} />
        </aside>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-lg font-extrabold text-slate-800">More in {section.title}</h2>
          <div className="grid gap-3.5 lg:grid-cols-2">{related.map((r) => <ServiceBar key={r.id} svc={r} tone={tone} />)}</div>
        </section>
      )}
    </>
  )
}

function BuyCard({ svc, tone, gstRate }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const unit = unitOf(svc.price)
  const quote = svc.price.type === 'quote'
  const [qty, setQty] = useState(1)
  const [brief, setBrief] = useState('')
  const [state, setState] = useState({ busy: false, error: '', sent: null })
  const fee = quote ? 0 : svc.price.amount * qty
  const gst = Math.round(fee * gstRate)
  const staff = session && isOpsRole(session.role)

  async function go() {
    if (!session) return navigate('/signup', { state: { from: `/services/${svc.id}` } })
    setState({ busy: true, error: '', sent: null })
    try {
      const { order } = await api('/api/orders', { serviceId: svc.id, quantity: qty, brief })
      if (quote) setState({ busy: false, error: '', sent: order })
      else navigate(`/dashboard/services/${order.id}/pay`)
    } catch (e) {
      setState({ busy: false, error: e.message, sent: null })
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-100" style={{ boxShadow: `0 24px 48px -24px ${tone.to}66` }}>
      <div className="p-6 text-white" style={{ backgroundImage: `linear-gradient(135deg, ${tone.from}, ${tone.to})` }}>
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">Professional fee</p>
        <p className="mt-1 text-3xl font-black">{priceLabel(svc.price)}</p>
        {!quote && <p className="text-sm text-white/85">+ GST {Math.round(gstRate * 100)}%{svc.price.type === 'from' || svc.price.type === 'range' ? ' · starting fee' : ''}</p>}
      </div>
      <div className="space-y-4 p-6">
        {state.sent ? (
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
            <p className="font-extrabold">Quote requested ✓</p>
            <p className="mt-1 text-sm">Reference <b className="font-mono">{state.sent.ref}</b>. Our expert will send you a quote; you’ll see it under <Link className="font-bold underline" to="/dashboard/services">My expert services</Link>.</p>
          </div>
        ) : (
          <>
            {unit && !quote && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">{unit === 'month' ? 'Months' : `Number of ${unit === 'SKU' ? 'SKUs' : `${unit}s`}`}</span>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"><Minus size={16} /></button>
                  <span className="w-8 text-center text-lg font-extrabold tabular-nums">{qty}</span>
                  <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(50, q + 1))} className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"><Plus size={16} /></button>
                </div>
              </div>
            )}
            {!quote && (
              <dl className="space-y-1.5 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between text-slate-600"><dt>Fee{unit && qty > 1 ? ` (${qty} × ${rupees(svc.price.amount)})` : ''}</dt><dd className="font-semibold tabular-nums">{rupees(fee)}</dd></div>
                <div className="flex justify-between text-slate-600"><dt>GST {Math.round(gstRate * 100)}%</dt><dd className="font-semibold tabular-nums">{rupees(gst)}</dd></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold text-slate-900"><dt>You pay now</dt><dd className="tabular-nums">{rupees(fee + gst)}</dd></div>
              </dl>
            )}
            <label className="block">
              <span className="text-sm font-semibold text-slate-600">{quote ? 'What do you need? (required for a quote)' : 'Anything the expert should know? (optional)'}</span>
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} maxLength={2000}
                placeholder={quote ? 'e.g. 12 outlets in 3 states; we want to plan the licences before opening.' : 'e.g. product name, number of SKUs, deadline.'}
                className="mt-1.5 w-full rounded-2xl border-2 border-slate-100 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none" />
            </label>
            {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.error}</p>}
            {staff ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Team accounts can’t buy services. Sign in with a customer account to try the checkout.</p>
            ) : (
              <button type="button" onClick={go} disabled={state.busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
                style={{ backgroundImage: `linear-gradient(135deg, ${tone.from}, ${tone.to})` }}>
                {state.busy ? <Loader2 size={20} className="animate-spin" /> : quote ? <Send size={20} /> : <ShoppingCart size={20} />}
                {quote ? 'Request a quote' : 'Buy this service'}
              </button>
            )}
            {!session && <p className="text-center text-xs text-slate-400">You’ll create a free account (or sign in) first.</p>}
            {!quote && svc.price.type !== 'fixed' && svc.price.type !== 'monthly' && (
              <p className="text-xs leading-relaxed text-slate-400">You pay the starting fee now. If the expert finds the work is larger, they send a top-up quote before doing it.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Block({ title, icon: Icon, tone, children }) {
  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-100">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-slate-900">
        <Icon size={20} style={{ color: tone.from }} /> {title}
      </h2>
      {children}
    </div>
  )
}

function Chip({ tone, children }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 ring-1" style={{ '--tw-ring-color': tone.ring }}>{children}</span>
}
