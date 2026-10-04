import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileText, PhoneCall } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'
import { groupByBusiness, useApplications } from '../../lib/applications.js'
import { selectApplication } from '../../lib/selectedApplication.js'
import { SERVICES } from '../../lib/services.js'
import { Card, Loading } from '../../components/dashboard/ui.jsx'

// After our team has the application; later stages are updated by the operations team as the filing moves.
const JOURNEY = [
  { title: 'Submitted & paid', text: 'Application complete and government fee paid.' },
  { title: 'Filing call', text: 'Our team calls you for the FoSCoS OTP.' },
  { title: 'Filed on FoSCoS', text: 'You get the 17-digit FSSAI application number.' },
  { title: 'FSSAI review', text: 'Scrutiny, and an inspection where applicable.' },
  { title: 'Licence granted', text: 'Valid permanently under the 2026 rules; no renewals.' },
]

// Case stages (set by the operations team) -> how far along JOURNEY an application is (index of the current stage).
const JOURNEY_AT = { new: 1, in_review: 1, needs_customer: 1, ready_to_file: 1, session_scheduled: 1, filed: 3, with_fssai: 3, granted: 5, rejected: 3 }
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** The whole account: every business, premises, fee and expert service (one application is just one row). */
export default function DashboardHome() {
  const { session } = useAuth()
  const { list } = useApplications()
  const orders = useOrders()
  const firstName = session?.name?.split(' ')[0] || 'there'
  if (list === undefined) return <Loading />

  const submitted = list.filter((a) => a.status === 'ready')
  const open = list.filter((a) => a.status !== 'ready')
  // The one to carry on with: the latest opened draft, else a pending one.
  const next = [...open].sort((a, b) => (a.status === 'pending') - (b.status === 'pending') || new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  const businesses = groupByBusiness(list)
  const paid = list.filter((a) => a.payment)
  const paidTotal = paid.reduce((n, a) => n + a.payment.amount, 0)
  const paidOrders = (orders || []).filter((o) => o.paidAt)
  const openOrders = (orders || []).filter((o) => ['quote_requested', 'new', 'in_progress', 'awaiting_customer'].includes(o.status))
  const continueTo = (a) => () => selectApplication(a.id)
  const name = (a) => [a.business || 'New business', a.premises.address || a.premises.city].filter(Boolean).join(' · ')

  // Everything our team has in hand: submitted applications until granted, open expert orders, documents to collect.
  const withTeam = [
    ...submitted
      .filter((a) => a.case?.status !== 'granted')
      .map((a) => ({
        key: `app:${a.id}`,
        kind: 'Licence application',
        title: name(a),
        detail: [a.licence, a.payment && `paid ${rupees(a.payment.amount)}`, a.case?.arn && `ARN ${a.case.arn}`].filter(Boolean).join(' · '),
        status: a.case?.label || 'Received',
        tone: a.case?.status === 'needs_customer' || a.case?.status === 'rejected' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700',
        at: JOURNEY_AT[a.case?.status] ?? 1,
        to: '/dashboard/apply',
        onClick: continueTo(a),
      })),
    ...openOrders.map((o) => ({
      key: `order:${o.id}`,
      kind: 'Expert service',
      title: o.serviceName,
      detail: [o.ref, o.paidAt && `paid ${new Date(o.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`].filter(Boolean).join(' · '),
      status: o.statusLabel,
      tone: o.status === 'awaiting_customer' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-700',
      to: '/dashboard/services',
    })),
    ...list
      .filter((a) => a.toCollect > 0)
      .map((a) => ({
        key: `docs:${a.id}`,
        kind: 'Documents to collect',
        title: name(a),
        detail: `You'll hand ${a.toCollect === 1 ? 'one document' : `${a.toCollect} documents`} to our team; we'll collect ${a.toCollect === 1 ? 'it' : 'them'} before filing.`,
        status: 'We collect',
        tone: 'bg-sky-50 text-sky-700',
        to: '/dashboard/documents',
        onClick: continueTo(a),
      })),
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 p-6 text-white shadow-xl shadow-violet-200 sm:p-9">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10" />
        <p className="relative text-lg font-semibold text-white/90">Namaste {firstName} 👋</p>
        <h1 className="relative mt-1 text-3xl font-extrabold sm:text-4xl">
          {submitted.length > 1
            ? `${submitted.length} applications are with our team 🎉`
            : submitted.length === 1
              ? 'Your application is with our team 🎉'
              : list.length
                ? "Let's finish your licence application"
                : "Let's find the licence you need"}
        </h1>
        <p className="relative mt-2 max-w-2xl text-lg text-white/90">
          {submitted.length > 0 && <>We'll call you on <b>{session?.phone}</b> to file {submitted.length > 1 ? 'each one' : 'it'} on FoSCoS. </>}
          {open.length > 0 && `${open.length} ${open.length === 1 ? 'application is' : 'applications are'} still in progress.`}
        </p>
        <div className="relative mt-5 flex flex-wrap gap-3">
          {next ? (
            <Link to="/dashboard/apply" onClick={continueTo(next)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-violet-700 shadow hover:bg-violet-50">
              {next.status === 'pending' ? 'Start' : 'Continue'}: {name(next)} <ArrowRight size={18} />
            </Link>
          ) : !list.length ? (
            <Link to="/dashboard/apply" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-violet-700 shadow hover:bg-violet-50">
              Start now <ArrowRight size={18} />
            </Link>
          ) : null}
          {list.length > 0 && (
            <Link to="/dashboard/applications" className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-3 font-bold text-white ring-1 ring-white/40 hover:bg-white/25">
              <FileText size={18} /> My applications
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          to="/dashboard/applications"
          emoji="🏛️"
          label="Applications"
          value={list.length ? `${list.length} ${list.length === 1 ? 'application' : 'applications'}` : 'None yet'}
          note={list.length ? [submitted.length && `${submitted.length} submitted`, open.length && `${open.length} in progress`].filter(Boolean).join(' · ') : 'A few taps to find your licence'}
        />
        <Tile
          to="/dashboard/premises"
          emoji="📍"
          label="Premises"
          value={list.length ? `${list.length} ${list.length === 1 ? 'place' : 'places'}` : 'Not added yet'}
          note={businesses.length ? `${businesses.length} ${businesses.length === 1 ? 'business' : 'businesses'}` : 'Added during your application'}
        />
        <Tile
          to="/dashboard/payments"
          emoji="💳"
          label="Government fees paid"
          value={paid.length ? rupees(paidTotal) : '₹0'}
          note={paid.length ? `${paid.length} ${paid.length === 1 ? 'premises' : 'premises'} paid` : 'Paid per premises, after the forms'}
        />
        <Tile
          to="/dashboard/services"
          emoji="🧑‍⚖️"
          label="Expert services"
          value={orders === undefined ? '…' : paidOrders.length ? `${paidOrders.length} paid` : 'None yet'}
          note={orders === undefined ? '' : openOrders.length ? `${openOrders.length} open` : orders.length ? 'Nothing open' : 'Labels, claims, notices and more'}
        />
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
          <PhoneCall size={20} className="text-violet-500" /> With our team
        </h2>
        {withTeam.length === 0 ? (
          <Card className="mt-4">
            <p className="text-slate-600">Nothing with our team yet. Once you submit an application or book an expert, it shows here until it's done.</p>
            <Journey at={0} />
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {withTeam.map((c) => (
              <Link
                key={c.key}
                to={c.to}
                onClick={c.onClick}
                className="group flex flex-col rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{c.kind}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.tone}`}>{c.status}</span>
                </div>
                <p className="mt-2 font-extrabold capitalize text-slate-900">{c.title}</p>
                {c.detail && <p className="text-sm text-slate-500">{c.detail}</p>}
                {c.at != null && (
                  <div className="mt-4">
                    <div className="flex gap-1">
                      {JOURNEY.map((j, i) => (
                        <span key={j.title} className={`h-1.5 flex-1 rounded-full ${i < c.at ? 'bg-emerald-500' : i === c.at ? 'bg-violet-500' : 'bg-slate-100'}`} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {c.at >= JOURNEY.length ? 'Done' : `Now: ${JOURNEY[c.at].title}. ${JOURNEY[c.at].text}`}
                    </p>
                  </div>
                )}
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-bold text-violet-600 group-hover:gap-2">
                  Open <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Our experts can also help with</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.slice(1).map((s) => (
            <Link
              key={s.title}
              to={`/services?head=${s.head}`}
              className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <s.icon size={20} />
              </span>
              <p className="mt-3 font-extrabold text-slate-900">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.points.join(' · ')}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-violet-600 group-hover:gap-2">
                Ask an expert <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The five stages; `at` is the current one (everything before it is done; 5 = all done). */
function Journey({ at }) {
  return (
    <ol className="mt-4 grid gap-4 sm:grid-cols-5">
      {JOURNEY.map((s, i) => {
        const done = i < at
        const current = i === at
        return (
          <li key={s.title} className="relative">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${
                done ? 'bg-emerald-500 text-white' : current ? 'bg-violet-600 text-white ring-4 ring-violet-100' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? <CheckCircle2 size={18} /> : i + 1}
            </span>
            <p className={`mt-2 text-sm font-extrabold ${done || current ? 'text-slate-900' : 'text-slate-400'}`}>{s.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.text}</p>
          </li>
        )
      })}
    </ol>
  )
}

/** Expert-service orders (undefined while loading). */
function useOrders() {
  const [orders, setOrders] = useState(undefined)
  useEffect(() => {
    fetch('/api/orders', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
  }, [])
  return orders
}

function Tile({ to, emoji, label, value, note }) {
  return (
    <Link to={to} className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-3xl">{emoji}</span>
        <ArrowRight size={16} className="text-slate-300 transition group-hover:text-violet-500" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-0.5 truncate text-sm text-slate-500">{note}</p>
    </Link>
  )
}
