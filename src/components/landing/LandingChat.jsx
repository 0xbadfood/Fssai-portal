import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, RotateCcw, Send, Sparkles } from 'lucide-react'
import { landingSession, saveLandingSession } from '../../lib/landingHandoff.js'

const GREETING = "Namaste! 👋 I'm your FSSAI assistant. Tap a few answers and I'll tell you exactly which licence your food business needs."
const THINK_MS = 650

async function api(action, body = {}) {
  const res = await fetch(`/api/intake/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status })
  return data
}

/**
 * Tap-first licence check on the landing page. The conversation runs on the server (the same graph and rules
 * as the signed-in intake); this component shows the question it sends and posts back taps or typed text.
 * The session id is kept in the browser and handed to the first application after sign-up.
 */
export default function LandingChat() {
  const [view, setView] = useState(null) // { session, question, summary, result, transcript, clarify }
  const [thinking, setThinking] = useState(false)
  const [pending, setPending] = useState(null) // what the user just sent, shown while the server answers
  const [error, setError] = useState('')
  const [picked, setPicked] = useState([])
  const [allStates, setAllStates] = useState(false)
  const [text, setText] = useState('')
  const scroller = useRef(null)

  useEffect(() => {
    const id = landingSession()
    ;(id ? api('resume', { session: id }).catch(() => (saveLandingSession(null), api('preview'))) : api('preview'))
      .then(setView)
      .catch((e) => setError(e.message))
  }, [])

  const q = view?.question || null
  const result = view?.result || null
  const log = view?.transcript || []

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [log.length, thinking, q?.id, !!result])

  useEffect(() => {
    setPicked(q?.kind === 'states' && q.states?.suggested ? [q.states.suggested] : [])
    setAllStates(false)
  }, [q?.id, q?.title])

  async function send(action, body, shown) {
    setThinking(true)
    setPending(shown || null)
    setError('')
    const started = Date.now()
    try {
      const next = await api(action, { session: view?.session, ...body })
      await new Promise((r) => setTimeout(r, Math.max(0, THINK_MS - (Date.now() - started))))
      if (next.session) saveLandingSession(next.session)
      setView(next)
    } catch (e) {
      if (e.status === 404) {
        saveLandingSession(null)
        setView(await api('preview').catch(() => view))
        setError('That chat had expired, so we started again.')
      } else setError(e.message)
    } finally {
      setThinking(false)
      setPending(null)
    }
  }

  const tap = (ids) => send('answer', { questionId: q.id, optionIds: ids }, q.options.filter((o) => ids.includes(o.id)).map((o) => o.label).join(', '))
  const pickStates = (states) => send('answer', { questionId: q.id, states }, states.join(', '))
  function sendText() {
    const clean = text.trim()
    if (!clean || !q) return
    setText('')
    send('answer', { questionId: q.id, text: clean.slice(0, 1000) }, clean)
  }
  const restart = () => send('restart', {})

  const multi = !!q?.multi
  const guesses = q && view.clarify?.questionId === q.id ? view.clarify.guesses : []
  const options = q ? [...guesses.map((id) => q.options.find((o) => o.id === id)).filter(Boolean), ...q.options.filter((o) => !guesses.includes(o.id))] : []
  const exclusive = (id) => options.find((o) => o.id === id)?.exclusive
  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : exclusive(id) ? [id] : [...p.filter((x) => !exclusive(x)), id]))
  const stateList = q?.states ? (allStates ? q.states.all : [...new Set([...q.states.popular.slice(0, 8), ...picked])]) : []

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl shadow-violet-300/40 ring-1 ring-violet-100">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
            <Sparkles size={18} />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-fuchsia-500" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold">FSSAI Assistant</p>
            <p className="text-xs text-white/80">AI-powered · replies instantly</p>
          </div>
        </div>
        {log.length > 0 && (
          <button onClick={restart} disabled={thinking} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
            <RotateCcw size={12} /> Start over
          </button>
        )}
      </div>

      <div ref={scroller} className="h-[430px] space-y-3 overflow-y-auto bg-gradient-to-b from-violet-50/60 to-white px-4 py-5 sm:px-5">
        <Bot>{GREETING}</Bot>
        {log.map((m, i) => (
          <React.Fragment key={i}>
            <User>{m.answer}</User>
            {m.reply && <Bot>{m.reply}</Bot>}
          </React.Fragment>
        ))}
        {pending && <User>{pending}</User>}
        {error && <Bot>{error}</Bot>}

        {thinking || !view ? (
          <Bot>
            <span className="inline-flex gap-1 py-1">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          </Bot>
        ) : q ? (
          <div className="space-y-2.5">
            <Bot>
              <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-violet-500">{q.check ? 'Just checking' : `Question ${q.number}`}</span>
              <span className="font-semibold text-slate-900">{q.title}</span>
              {q.hint && <span className="mt-0.5 block text-xs text-slate-500">{q.hint}</span>}
            </Bot>
            <div className="flex flex-wrap gap-2 pl-10">
              {q.kind === 'states'
                ? stateList.map((s) => <Chip key={s} on={picked.includes(s)} onClick={() => (multi ? toggle(s) : pickStates([s]))} label={s} />)
                : options.map((o) => (
                    <Chip
                      key={o.id}
                      on={picked.includes(o.id)}
                      guess={guesses.includes(o.id)}
                      emoji={o.emoji}
                      label={o.label}
                      title={o.example}
                      onClick={() => (multi ? toggle(o.id) : tap([o.id]))}
                    />
                  ))}
              {q.kind === 'states' && !allStates && (
                <button onClick={() => setAllStates(true)} className="px-2 text-xs font-semibold text-violet-600 hover:underline">
                  More states…
                </button>
              )}
            </div>
            {multi && (
              <div className="pl-10">
                <button
                  disabled={!picked.length}
                  onClick={() => (q.kind === 'states' ? pickStates(picked) : tap(picked))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-40 disabled:shadow-none"
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        ) : result ? (
          <Result result={result} session={view.session} />
        ) : null}
      </div>

      <div className="border-t border-slate-100 bg-white p-3">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-violet-400">
          <input
            value={text}
            disabled={!q?.typing || thinking}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
            placeholder={!q ? 'Tap Start over to try again' : q.typing ? (q.number === 1 ? 'Or just tell me, e.g. "I run a cloud kitchen"' : 'Or type your answer') : 'Tap one of the options above'}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={sendText}
            disabled={!q?.typing || thinking || !text.trim()}
            aria-label="Send"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 disabled:opacity-30"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

function Result({ result: e, session }) {
  if (e.outcome === 'notfood') {
    return (
      <Bot>
        <span className="block font-extrabold text-sky-700">You don't need FSSAI approval 👍</span>
        <span className="mt-1 block">{e.guidance}</span>
      </Bot>
    )
  }
  if (e.outcome === 'deemed') {
    return (
      <Bot>
        <span className="block font-extrabold text-emerald-700">Good news — you're already covered ✅</span>
        <span className="mt-1 block">{e.reasons[0]} Many vendors still register to display the FSSAI logo — we can do that for you too.</span>
        <SignupCta className="mt-3" label="Register anyway" />
      </Bot>
    )
  }
  if (!e.licence) {
    return (
      <Bot>
        <span className="block font-extrabold text-violet-700">Our FSSAI expert will place your business 🧑‍⚖️</span>
        <span className="mt-1 block">Your answers don't fit a standard category exactly. {e.handover[0]}</span>
        <SignupCta className="mt-3" label="Talk to an expert" />
      </Bot>
    )
  }
  return (
    <div className="space-y-2.5">
      <Bot>Here's what your business needs:</Bot>
      <div className="ml-10 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-100">
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-500 px-4 py-3 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">You need</p>
          <p className="text-xl font-extrabold">{e.licence}</p>
        </div>
        <div className="space-y-2 px-4 py-3 text-sm text-slate-600">
          {e.reasons.map((r) => (
            <p key={r}>{r}</p>
          ))}
          {e.tasks.map((t) => (
            <p key={t.id} className="font-semibold text-slate-700">
              + {t.label}
              {t.licence ? ` (${t.licence})` : ''}: {t.text}
            </p>
          ))}
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Form {e.form}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{e.fee ? `Govt fee ${rupees(e.fee)}/year` : 'No government fee'}</span>
          </div>
          <SignupCta className="pt-1" />
          <Rate session={session} />
          <p className="text-[11px] text-slate-400">Your answers are saved — you won't be asked again.</p>
        </div>
      </div>
    </div>
  )
}

/** "Is this right?", logged for the expert's review. */
function Rate({ session }) {
  const [sent, setSent] = useState(false)
  if (!session) return null
  if (sent) return <p className="text-xs font-semibold text-slate-500">Thanks for letting us know!</p>
  const rate = (rating) => {
    setSent(true)
    api('rate', { session, rating }).catch(() => {})
  }
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      Is this right?
      {[['right', '👍'], ['wrong', '👎'], ['unsure', '🤔']].map(([id, label]) => (
        <button key={id} onClick={() => rate(id)} className="rounded-full border border-slate-200 px-2 py-0.5 hover:border-violet-300" aria-label={id}>
          {label}
        </button>
      ))}
    </p>
  )
}

function SignupCta({ className = '', label = 'Continue my application' }) {
  return (
    <Link
      to="/signup"
      className={`inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700 ${className}`}
    >
      {label} <ArrowRight size={15} />
    </Link>
  )
}

function Bot({ children }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow">
        <Sparkles size={13} />
      </span>
      <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-100">
        {children}
      </div>
    </div>
  )
}

function User({ children }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] rounded-2xl rounded-br-md bg-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">{children}</p>
    </div>
  )
}

function Chip({ on, guess, emoji, label, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
        on ? 'border-violet-500 bg-violet-600 text-white' : guess ? 'border-violet-300 bg-violet-50 text-slate-700' : 'border-violet-100 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50'
      }`}
    >
      {emoji && <span className="text-base leading-none">{emoji}</span>}
      {label}
      {on && <Check size={14} />}
    </button>
  )
}
