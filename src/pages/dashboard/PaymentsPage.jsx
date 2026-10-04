import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, Clock, CreditCard, FlaskConical, Loader2, Lock, Receipt, ShieldCheck, Smartphone, Wallet, XCircle } from 'lucide-react'
import { Card, Loading, PageHeader } from '../../components/dashboard/ui.jsx'
import { openCheckout } from '../../lib/cashfree.js'
import { useSelectedApplicationId } from '../../lib/selectedApplication.js'

const METHODS = [
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'netbanking', label: 'Net banking', icon: Building2 },
]
// Receipt labels for methods the gateway reports beyond the three above.
const METHOD_LABEL = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', paylater: 'Pay later', other: 'Online' }
const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank']
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function PaymentsPage() {
  const selected = useSelectedApplicationId()
  const [data, setData] = useState(null)
  // The fee shown is the selected application's; the receipts are every application's.
  const load = () =>
    fetch(selected ? `/api/payments?application=${selected}` : '/api/payments', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ payments: [], quote: null }))
  useEffect(() => {
    load()
  }, [selected])
  if (!data) return <Loading />
  const { quote, payments } = data

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* The account's payments (every business and premises): no premises in the top bar, just the account holder. */}
      <PageHeader emoji="💳" title="Payments" subtitle="Each premises has its own government fee. Pay it here and keep your receipts." />
      {quote?.payable ? (
        <Checkout quote={quote} onDone={load} />
      ) : quote && !quote.paid ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold text-slate-900">Government fee: {rupees(quote.total)}</p>
            <p className="text-slate-500">You can pay once your application is complete.</p>
          </div>
          <Link to="/dashboard/apply" className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700">
            Continue my application <ArrowRight size={18} />
          </Link>
        </Card>
      ) : null}
      <Receipts payments={payments} />
    </div>
  )
}

function Checkout({ quote, onDone }) {
  const [paid, setPaid] = useState(null)

  async function pay(method, outcome) {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ applicationId: quote.applicationId, method, outcome }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body.error || 'Payment could not be started.' }
    if (body.payment?.status === 'paid') setPaid(body.payment)
    return { result: body.payment }
  }

  if (paid) {
    return (
      <div className="rounded-[32px] bg-gradient-to-br from-emerald-500 to-teal-500 p-7 text-white shadow-xl shadow-emerald-100 sm:p-9">
        <CheckCircle2 size={48} />
        <h2 className="mt-3 text-3xl font-extrabold">Payment successful 🎉</h2>
        <p className="mt-2 text-lg text-white/90">
          {rupees(paid.amount)} paid · Reference <b className="font-mono">{paid.reference}</b>
        </p>
        <p className="mt-1 text-white/85">Your application is submitted. Our team will call you for the OTP to file it on FoSCoS.</p>
        <Link to="/dashboard/overview" onClick={onDone} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-emerald-700 shadow hover:bg-emerald-50">
          Go to my dashboard <ArrowRight size={18} />
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
      <Card>
        <p className="text-sm font-bold uppercase tracking-wide text-violet-500">Order summary</p>
        <p className="mt-1 text-xl font-extrabold text-slate-900">{quote.licence}</p>
        <p className="text-sm text-slate-500">
          {[quote.business, quote.premises].filter(Boolean).join(' · ') || `Application ${quote.applicationId.slice(0, 8).toUpperCase()}`} · Form {quote.form}
        </p>
        <ul className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          {quote.items.map((i) => (
            <li key={i.label} className="flex justify-between gap-4 text-slate-700">
              <span>{i.label}</span>
              <span className="font-semibold">{rupees(i.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-lg font-extrabold text-slate-900">
          <span>Total</span>
          <span>{rupees(quote.total)}</span>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
          <Lock size={12} /> Paid to the government through FoSCoS when we file your application.
        </p>
      </Card>
      {quote.mode === 'test' ? (
        <PayPanel test label={`Pay ${rupees(quote.total)} and submit`} onPay={pay} />
      ) : (
        <GatewayPanel mode={quote.mode} label={`Pay ${rupees(quote.total)} and submit`} start={{ applicationId: quote.applicationId }} />
      )}
    </div>
  )
}

/**
 * The "Pay with" card: method, details, the test-mode simulator and the pay button. `onPay(method, outcome)`
 * does the payment and returns { result } or { error }; used for the government fee and for expert services.
 */
export function PayPanel({ test, label, onPay }) {
  const [method, setMethod] = useState('upi')
  const [upi, setUpi] = useState('')
  const [bank, setBank] = useState(BANKS[0])
  const [outcome, setOutcome] = useState('success')
  const [state, setState] = useState({ busy: false, result: null, error: '' })

  async function pay() {
    setState({ busy: true, result: null, error: '' })
    const started = Date.now()
    let out
    try {
      out = await onPay(method, outcome)
    } catch {
      out = { error: 'Network problem. Nothing was charged; try again.' }
    }
    // Keep the "processing" state visible briefly, like a real gateway.
    await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (Date.now() - started))))
    setState({ busy: false, result: out.result || null, error: out.error || '' })
  }

  return (
      <Card className="relative">
        {test && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <FlaskConical size={16} className="mt-0.5 shrink-0" />
            <span>
              <b>Test mode.</b> This is a practice checkout: no money moves and no real details are needed.
            </span>
          </div>
        )}
        <p className="text-base font-extrabold text-slate-900">Pay with</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 text-sm font-bold transition ${
                method === m.id ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-100 text-slate-600 hover:border-violet-200'
              }`}
            >
              <m.icon size={20} /> {m.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {method === 'upi' && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-600">UPI ID</span>
              <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@upi" className="mt-1.5 w-full rounded-2xl border-2 border-slate-100 px-4 py-3 focus:border-violet-400 focus:outline-none" />
            </label>
          )}
          {method === 'card' && (
            <div className="grid grid-cols-2 gap-3">
              <input defaultValue="4111 1111 1111 1111" aria-label="Card number" className="col-span-2 rounded-2xl border-2 border-slate-100 px-4 py-3 font-mono focus:border-violet-400 focus:outline-none" />
              <input defaultValue="12/30" aria-label="Expiry" className="rounded-2xl border-2 border-slate-100 px-4 py-3 font-mono focus:border-violet-400 focus:outline-none" />
              <input defaultValue="123" aria-label="CVV" className="rounded-2xl border-2 border-slate-100 px-4 py-3 font-mono focus:border-violet-400 focus:outline-none" />
            </div>
          )}
          {method === 'netbanking' && (
            <select value={bank} onChange={(e) => setBank(e.target.value)} aria-label="Bank" className="w-full rounded-2xl border-2 border-slate-100 bg-white px-4 py-3 focus:border-violet-400 focus:outline-none">
              {BANKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          )}
        </div>

        {test && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-500">Simulate:</span>
            {[['success', 'Payment succeeds'], ['fail', 'Payment fails']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOutcome(id)}
                className={`rounded-full px-3 py-1.5 font-bold ${outcome === id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {state.result?.status === 'failed' && (
          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <XCircle size={16} /> The payment was declined. Nothing was charged; try again or use another method.
          </p>
        )}
        {state.error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</p>}

        <button
          onClick={pay}
          disabled={state.busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-60"
        >
          {state.busy ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Processing…
            </>
          ) : (
            <>{label}</>
          )}
        </button>
      </Card>
  )
}

/**
 * Pay through the gateway (Cashfree): the server creates the payment for `start` ({ applicationId } or
 * { orderId }) and we open the gateway's page; the customer returns to /dashboard/payment/return.
 */
export function GatewayPanel({ mode, label, start }) {
  const [state, setState] = useState({ busy: false, error: '' })

  async function pay() {
    setState({ busy: true, error: '' })
    try {
      const res = await fetch('/api/payments/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(start) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Payment could not be started.')
      await openCheckout(body.sessionId, body.mode)
      // The page is now leaving for the gateway; keep the button busy.
    } catch (e) {
      setState({ busy: false, error: e.message || 'Payment could not be started.' })
    }
  }

  return (
    <Card className="relative">
      {mode === 'sandbox' && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <FlaskConical size={16} className="mt-0.5 shrink-0" />
          <span>
            <b>Sandbox.</b> Cashfree's test gateway: use its test cards or UPI IDs. No money moves.
          </span>
        </div>
      )}
      <p className="text-base font-extrabold text-slate-900">Pay securely with Cashfree</p>
      <p className="mt-1 text-slate-500">You'll go to Cashfree's payment page, then come straight back here.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[[Smartphone, 'UPI'], [CreditCard, 'Cards'], [Building2, 'Net banking'], [Wallet, 'Wallets']].map(([Icon, text]) => (
          <div key={text} className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-slate-100 px-3 py-3 text-sm font-bold text-slate-600">
            <Icon size={20} /> {text}
          </div>
        ))}
      </div>
      {state.error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</p>}
      <button
        onClick={pay}
        disabled={state.busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-lg font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-60"
      >
        {state.busy ? (
          <>
            <Loader2 size={20} className="animate-spin" /> Opening the payment page…
          </>
        ) : (
          <>{label}</>
        )}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck size={12} /> Your card and bank details go to Cashfree only; we never see them.
      </p>
    </Card>
  )
}

/**
 * /dashboard/payment/return?order=MFL-...: where the gateway sends the customer back. The server asks the gateway
 * how it went (the webhook may already have recorded it); while the bank is still deciding we check a few times.
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams()
  const id = params.get('order')
  const [state, setState] = useState({ checkout: null, error: '', waiting: true })

  useEffect(() => {
    let stop = false
    async function check(tries) {
      try {
        const res = await fetch('/api/payments/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'We could not check this payment.')
        const c = body.checkout
        const settled = c.status !== 'created' || c.attempt === 'failed' || c.attempt === 'dropped'
        if (stop) return
        setState({ checkout: c, error: '', waiting: !settled && tries > 0 })
        if (!settled && tries > 0) setTimeout(() => check(tries - 1), 2500)
      } catch (e) {
        if (!stop) setState({ checkout: null, error: e.message, waiting: false })
      }
    }
    check(6)
    return () => {
      stop = true
    }
  }, [id])

  const c = state.checkout
  const service = c?.for.kind === 'service'
  const retry = service ? `/dashboard/services/${c.for.id}/pay` : '/dashboard/payments'
  if (state.error) return <p className="mx-auto max-w-3xl rounded-2xl bg-red-50 p-4 text-red-700">{state.error}</p>
  if (!c) return <Loading />

  if (c.status === 'paid') {
    return (
      <div className="mx-auto max-w-3xl rounded-[32px] bg-gradient-to-br from-emerald-500 to-teal-500 p-7 text-white shadow-xl shadow-emerald-100 sm:p-9">
        <CheckCircle2 size={48} />
        <h2 className="mt-3 text-3xl font-extrabold">Payment successful 🎉</h2>
        <p className="mt-2 text-lg text-white/90">
          {rupees(c.amount)} paid{c.reference && <> · Reference <b className="font-mono">{c.reference}</b></>}
        </p>
        <p className="mt-1 text-white/85">
          {service
            ? 'Our expert has your request and will contact you, usually within one working day. You can message them from My expert services.'
            : 'Your application is submitted. Our team will call you for the OTP to file it on FoSCoS.'}
        </p>
        <Link to={service ? '/dashboard/services' : '/dashboard/overview'} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-emerald-700 shadow hover:bg-emerald-50">
          {service ? 'Go to My expert services' : 'Go to my dashboard'} <ArrowRight size={18} />
        </Link>
      </div>
    )
  }

  const pending = c.status === 'created' && !c.attempt?.match(/failed|dropped/)
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        {pending ? (
          <>
            <Clock size={36} className="text-amber-500" />
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{state.waiting ? 'Checking your payment…' : 'Waiting for your bank'}</p>
            <p className="mt-1 text-slate-600">
              {state.waiting
                ? 'This takes a few seconds.'
                : 'We haven’t heard back from your bank yet. If money left your account, it will show here as paid within a few minutes, so don’t pay again. If you left the payment page without paying, you can try again: you won’t be charged twice.'}
            </p>
            {!state.waiting && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white hover:bg-violet-700">
                  Check again
                </button>
                <Link to={retry} className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 font-bold text-slate-700 hover:bg-slate-200">
                  Try again
                </Link>
              </div>
            )}
          </>
        ) : (
          <>
            <XCircle size={36} className="text-red-500" />
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {c.status === 'expired' ? 'This payment timed out' : c.attempt === 'dropped' ? 'Payment not completed' : 'The payment didn’t go through'}
            </p>
            <p className="mt-1 text-slate-600">
              Nothing was charged{c.message ? ` (${c.message})` : ''}. You can try again, with the same or another method.
            </p>
            <Link to={retry} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white hover:bg-violet-700">
              Try again <ArrowRight size={18} />
            </Link>
          </>
        )}
      </Card>
    </div>
  )
}

function Receipts({ payments }) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
        <Receipt size={20} className="text-violet-500" /> Receipts
      </h2>
      {payments.length ? (
        <ul className="mt-4 divide-y divide-slate-100">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div>
                <p className="font-bold text-slate-800">{p.items[0]?.label}</p>
                {p.application?.business && (
                  <p className="text-sm font-semibold text-slate-600">
                    {p.application.business}
                    {p.application.city ? ` · ${p.application.city}` : ''}
                  </p>
                )}
                <p className="text-sm text-slate-500">
                  {when(p.createdAt)} · {METHOD_LABEL[p.method] || 'Online'} · <span className="font-mono">{p.reference}</span>
                  {p.mode !== 'live' && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-700">{p.mode === 'sandbox' ? 'SANDBOX' : 'TEST'}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-extrabold text-slate-900">{rupees(p.amount)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {p.status === 'paid' ? 'Paid' : 'Failed'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-slate-500">No payments yet.</p>
      )}
    </Card>
  )
}
