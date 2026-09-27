import React, { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CalendarClock, CheckCircle2, CreditCard, FlaskConical, Loader2, MessagesSquare, Search, Ship, ShieldCheck, Tags, UserCheck } from 'lucide-react'
import LandingNavbar from '../../components/landing/LandingNavbar.jsx'
import Footer from '../../components/landing/Footer.jsx'
import { TONES, priceLabel, useCatalogue } from '../../lib/catalogue.js'

const HEAD_ICON = { 'licensing-approvals': BadgeCheck, product: FlaskConical, 'labels-claims': Tags, 'specialty-imports': Ship, compliance: ShieldCheck, advisory: MessagesSquare }

/** Expert services: the whole catalogue, grouped under headings, each service a 3D bar. */
export default function ServicesPage() {
  const { cat, error } = useCatalogue()
  const [q, setQ] = useState('')
  const [params] = useSearchParams()
  const [head, setHead] = useState(params.get('head') || 'all')

  const heads = useMemo(() => {
    if (!cat) return []
    const needle = q.trim().toLowerCase()
    return cat.heads
      .filter((h) => head === 'all' || h.id === head)
      .map((h) => ({
        ...h,
        sections: h.sections.map((sid) => cat.sections.find((s) => s.id === sid)).map((s) => ({
          ...s,
          services: s.services.filter((x) => !needle || `${x.name} ${x.scope} ${x.summary} ${s.title}`.toLowerCase().includes(needle)),
        })).filter((s) => s.services.length),
      }))
      .filter((h) => h.sections.length)
  }, [cat, q, head])
  const shown = heads.reduce((n, h) => n + h.sections.reduce((m, s) => m + s.services.length, 0), 0)

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      <Hero cat={cat} />
      <Steps />
      <section id="catalogue" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6 lg:px-8">
        <div className="sticky top-[61px] z-30 -mx-4 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              <HeadPill active={head === 'all'} onClick={() => setHead('all')}>All services</HeadPill>
              {cat?.heads.map((h) => (
                <HeadPill key={h.id} active={head === h.id} tone={TONES[h.tone]} onClick={() => setHead(h.id)}>{h.title}</HeadPill>
              ))}
            </div>
            <label className="relative lg:ml-auto lg:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: label review, nutraceutical, renewal…" aria-label="Search services"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" />
            </label>
          </div>
        </div>

        {error && <p className="mt-10 rounded-2xl bg-red-50 p-4 text-red-700">The services could not be loaded: {error}</p>}
        {!cat && !error && <p className="mt-16 flex items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading services…</p>}
        {cat && !shown && <p className="mt-16 text-center text-slate-500">No service matches “{q}”. Try another word, or <Link className="font-bold text-violet-600" to="/services/specific-regulatory-query">ask a specific question</Link>.</p>}

        <div className="mt-10 space-y-20">
          {heads.map((h) => <HeadBlock key={h.id} head={h} />)}
        </div>
        {cat?.tentative && (
          <p className="mt-16 text-center text-xs text-slate-400">Service descriptions are being finalised with our expert and may change. Fees are indicative and exclude GST; the final fee is confirmed after a scope check.</p>
        )}
      </section>
      <Terms cat={cat} />
      <Footer />
    </div>
  )
}

function HeadPill({ active, tone, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${active ? 'text-white shadow-md' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
      style={active ? { backgroundImage: `linear-gradient(135deg, ${(tone || TONES.violet).from}, ${(tone || TONES.violet).to})` } : undefined}>
      {children}
    </button>
  )
}

function Hero({ cat }) {
  const x = cat?.expert
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(60rem 30rem at 10% -10%, rgba(139,92,246,.45), transparent 60%), radial-gradient(50rem 30rem at 100% 120%, rgba(16,185,129,.30), transparent 60%)' }} />
      <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr,1fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-200 ring-1 ring-white/15">
            <UserCheck size={14} /> Expert services
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl" style={{ textWrap: 'balance' }}>
            Food regulatory expertise, from licence to launch
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            Licensing, product classification, formulation, labels, claims, imports and the authority’s notices, handled by an expert who has done it for two decades.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#catalogue" className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-slate-900 shadow-lg hover:bg-violet-50">
              Browse {cat ? cat.sections.reduce((n, s) => n + s.services.length, 0) : ''} services <ArrowRight size={18} />
            </a>
            <Link to="/services/30-minute-consultation" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3.5 font-bold text-white ring-1 ring-white/25 hover:bg-white/15">
              <CalendarClock size={18} /> Book a 30-minute consultation
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 rounded-[36px] bg-gradient-to-br from-violet-500/30 to-emerald-400/20 blur-2xl" />
          <div className="relative rounded-[32px] bg-white/[.06] p-7 ring-1 ring-white/15 backdrop-blur-xl sm:p-8">
            <div className="flex items-end gap-4">
              <span className="bg-gradient-to-br from-white to-violet-200 bg-clip-text text-7xl font-black leading-none text-transparent">20+</span>
              <span className="pb-1 text-lg font-bold leading-tight text-slate-200">years in the<br />food industry</span>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-300">{x?.summary || 'Our regulatory lead has spent over two decades inside the food industry.'}</p>
            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-slate-400">Has worked with</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {(x?.companies || ['Unilever', 'Reliance', 'MTR Foods']).map((c) => (
                <span key={c} className="rounded-xl bg-white/10 px-4 py-2 text-base font-extrabold tracking-tight text-white ring-1 ring-white/15">{c}</span>
              ))}
            </div>
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
              {(x?.highlights || []).map((h) => (
                <div key={h.label}>
                  <p className="text-2xl font-black text-white">{h.value}</p>
                  <p className="text-xs leading-snug text-slate-400">{h.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Steps() {
  const steps = [
    { icon: Search, title: 'Choose a service', text: 'Pick what you need. Each service page says what’s included and what we’ll need from you.' },
    { icon: CreditCard, title: 'Pay the starting fee', text: 'Pay online (+ GST). Custom-quote services start with a quick request instead.' },
    { icon: UserCheck, title: 'Our expert takes it up', text: 'The expert contacts you, usually within one working day, and works with you on it.' },
    { icon: CheckCircle2, title: 'Delivered', text: 'You get the deliverable. If the scope turns out bigger, you get a top-up quote first, never a surprise.' },
  ]
  return (
    <section className="border-b border-slate-100 bg-slate-50/60">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {steps.map((s, i) => (
          <div key={s.title} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200"><s.icon size={20} /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-500">Step {i + 1}</p>
              <p className="font-extrabold text-slate-900">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function HeadBlock({ head }) {
  const tone = TONES[head.tone] || TONES.violet
  const Icon = HEAD_ICON[head.id] || BadgeCheck
  return (
    <div id={head.id} className="scroll-mt-40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundImage: `linear-gradient(135deg, ${tone.from}, ${tone.to})`, boxShadow: `0 10px 24px -10px ${tone.to}` }}>
            <Icon size={26} />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{head.title}</h2>
            <p className="text-slate-500">{head.blurb}</p>
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-10">
        {head.sections.map((s) => (
          <div key={s.id}>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
              <h3 className="text-lg font-extrabold text-slate-800">{s.title}</h3>
              <p className="text-sm text-slate-500">{s.intro}</p>
            </div>
            <div className="grid gap-3.5 lg:grid-cols-2">
              {s.services.map((svc) => <ServiceBar key={svc.id} svc={svc} tone={tone} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** One service as a 3D horizontal bar: a coloured end cap, an extruded edge, and it lifts on hover. */
export function ServiceBar({ svc, tone }) {
  const quote = svc.price.type === 'quote'
  return (
    <Link to={`/services/${svc.id}`} className="bar3d-wrap group block rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
      <div
        className="bar3d relative flex min-h-[84px] items-stretch overflow-hidden rounded-2xl bg-white ring-1"
        style={{
          '--tw-ring-color': tone.ring,
          boxShadow: `0 1px 0 ${tone.ring}, 0 2px 0 ${tone.ring}, 0 3px 0 ${tone.from}55, 0 5px 0 ${tone.to}33, 0 14px 24px -14px ${tone.to}aa`,
          backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #f8fafc 100%)',
        }}
      >
        <span className="relative w-3 shrink-0 sm:w-4" style={{ backgroundImage: `linear-gradient(180deg, ${tone.from}, ${tone.to})` }}>
          <span className="absolute inset-x-0 top-0 h-1/2 bg-white/25" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3 sm:px-5">
          <span className="font-extrabold leading-snug text-slate-900 group-hover:text-slate-950">{svc.name}</span>
          <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-slate-500">{svc.scope}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end justify-center gap-1.5 py-3 pr-4 sm:pr-5">
          <span className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-extrabold" style={{ backgroundColor: tone.soft, color: tone.ink }}>
            {priceLabel(svc.price, { short: true })}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:gap-1.5" style={{ color: tone.ink }}>
            {quote ? 'Request a quote' : 'View & buy'} <ArrowRight size={13} />
          </span>
        </span>
      </div>
    </Link>
  )
}

function Terms({ cat }) {
  if (!cat) return null
  return (
    <section className="border-t border-slate-100 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr,2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-violet-500">Good to know</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">How our fees work</h2>
            <p className="mt-3 text-slate-600">Fees are professional fees and exclude GST (18%, added at checkout). Government, laboratory and third-party costs are separate.</p>
            <div className="mt-6 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-200">
              <p className="text-lg font-extrabold">Not sure where to start?</p>
              <p className="mt-1 text-sm text-white/85">Book a short call with the expert, or ask one specific question.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/services/30-minute-consultation" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50">30-minute call · ₹1,500</Link>
                <Link to="/services/specific-regulatory-query" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/30 hover:bg-white/20">One question · from ₹2,500</Link>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {cat.terms.map((t) => (
              <div key={t.title} className="rounded-2xl bg-white p-5 ring-1 ring-slate-100">
                <p className="font-extrabold text-slate-900">{t.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
