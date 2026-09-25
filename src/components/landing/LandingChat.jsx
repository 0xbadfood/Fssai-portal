import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, RotateCcw, Send, Sparkles } from 'lucide-react'
import { POPULAR_STATES, QUESTIONS, STATES, applyTap, hintFor, isMulti, nextQuestion, optionsFor, titleFor } from '../../lib/intakeQuestions.js'
import { GOVT_FEE_PER_YEAR, eligibilityFromFacts, formKind } from '../../lib/applicationPlan.js'
import { saveLandingAnswers } from '../../lib/landingHandoff.js'

const GREETING = "Namaste! 👋 I'm your FSSAI assistant. Tap a few answers and I'll tell you exactly which licence your food business needs."
const THINK_MS = 650

/**
 * Tap-first licence check on the landing page. Uses the same question tree and licence rules as the
 * signed-in intake; answers are saved locally and replayed into the user's first application after sign-up.
 * Typed answers go to the public interpreter (rules + cache, no model); anything it doesn't know yet is handed
 * over to the signed-in flow, where the model reads it and caches the result for everyone after.
 */
export default function LandingChat() {
  const [answers, setAnswers] = useState([])
  const [facts, setFacts] = useState({})
  const [log, setLog] = useState([]) // { from: 'user' | 'bot', text }
  const [thinking, setThinking] = useState(false)
  const [picked, setPicked] = useState([])
  const [allStates, setAllStates] = useState(false)
  const [text, setText] = useState('')
  const [handedOver, setHandedOver] = useState(false)
  const scroller = useRef(null)

  const q = handedOver ? null : nextQuestion(facts)
  const done = !q && !handedOver && answers.length > 0

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [log.length, thinking, q?.id, done])

  useEffect(() => {
    if (answers.length) saveLandingAnswers(answers)
  }, [answers])

  function respond(answer, label, nextFacts, reply) {
    if (!nextFacts) return
    setPicked([])
    setAllStates(false)
    setAnswers((a) => [...a, answer])
    setLog((l) => [...l, { from: 'user', text: label }])
    setThinking(true)
    setTimeout(() => {
      setThinking(false)
      setFacts(nextFacts)
      if (reply) setLog((l) => [...l, { from: 'bot', text: reply }])
    }, THINK_MS)
  }

  function tap(ids) {
    const r = tryTap({ optionIds: ids })
    respond({ questionId: q.id, optionIds: ids }, r?.answer, r?.facts, ackFor(q.id))
  }

  function pickStates(states) {
    const r = tryTap({ states })
    respond({ questionId: q.id, states }, r?.answer, r?.facts, null)
  }

  const tryTap = (answer) => {
    try {
      return applyTap(facts, q, answer)
    } catch {
      return null
    }
  }

  async function sendText() {
    const clean = text.trim()
    if (!clean || !q) return
    setText('')
    setAnswers((a) => [...a, { questionId: q.id, text: clean.slice(0, 1000) }])
    setLog((l) => [...l, { from: 'user', text: clean }])
    setThinking(true)
    const started = Date.now()
    let r = { hit: false }
    try {
      const res = await fetch('/api/intake/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, facts, text: clean }),
      })
      if (res.ok) r = await res.json()
    } catch {}
    setTimeout(() => {
      setThinking(false)
      if (r.hit) {
        setFacts(r.facts)
        setLog((l) => [...l, { from: 'bot', text: r.reply }])
      } else setHandedOver(true)
    }, Math.max(0, THINK_MS - (Date.now() - started)))
  }

  function restart() {
    setAnswers([])
    setFacts({})
    setLog([])
    setPicked([])
    setHandedOver(false)
    saveLandingAnswers([])
  }

  const multi = q ? isMulti(q, facts) : false
  const options = q ? optionsFor(q, facts) : []
  const exclusive = (id) => options.find((o) => o.id === id)?.exclusive
  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : exclusive(id) ? [id] : [...p.filter((x) => !exclusive(x)), id]))
  const stateList = allStates ? STATES : [...new Set([...POPULAR_STATES.slice(0, 8), ...picked])]
  const step = QUESTIONS.filter((x) => x.relevant(facts) && x.answered(facts)).length + 1

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
        {answers.length > 0 && (
          <button onClick={restart} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
            <RotateCcw size={12} /> Start over
          </button>
        )}
      </div>

      <div ref={scroller} className="h-[430px] space-y-3 overflow-y-auto bg-gradient-to-b from-violet-50/60 to-white px-4 py-5 sm:px-5">
        <Bot>{GREETING}</Bot>
        {log.map((m, i) => (m.from === 'bot' ? <Bot key={i}>{m.text}</Bot> : <User key={i}>{m.text}</User>))}

        {thinking ? (
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
              <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-violet-500">{q.id === 'check' ? 'Just checking' : `Question ${step}`}</span>
              <span className="font-semibold text-slate-900">{titleFor(q, facts)}</span>
              {hintFor(q, facts) && <span className="mt-0.5 block text-xs text-slate-500">{hintFor(q, facts)}</span>}
            </Bot>
            <div className="flex flex-wrap gap-2 pl-10">
              {q.kind === 'states'
                ? stateList.map((s) => <Chip key={s} on={picked.includes(s)} onClick={() => (multi ? toggle(s) : pickStates([s]))} label={s} />)
                : options.map((o) => (
                    <Chip
                      key={o.id}
                      on={picked.includes(o.id)}
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
        ) : handedOver ? (
          <Bot>
            Thanks — that's plenty to go on! 🙌 I'll read it properly and pick up exactly where we left off once you create your
            free account.
            <SignupCta className="mt-3" />
          </Bot>
        ) : done ? (
          <Result facts={facts} />
        ) : null}
      </div>

      <div className="border-t border-slate-100 bg-white p-3">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-violet-400">
          <input
            value={text}
            disabled={!q || thinking}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
            placeholder={q ? 'Or just tell me, e.g. "I run a cloud kitchen in Pune"' : 'Tap Start over to try again'}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={sendText}
            disabled={!q || thinking || !text.trim()}
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

const ACKS = {
  activity: 'Got it 👍',
  place: 'Nice, noted.',
  vending: 'Okay, thanks.',
  trade: 'Got it.',
  locations: 'Noted.',
  turnover: 'Perfect, thanks.',
  online: 'Great.',
}
const ackFor = (id) => ACKS[id] || null

function Result({ facts }) {
  const e = eligibilityFromFacts(facts)
  const form = formKind(e)
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
  return (
    <div className="space-y-2.5">
      <Bot>Here's what your business needs:</Bot>
      <div className="ml-10 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-100">
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-500 px-4 py-3 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">You need</p>
          <p className="text-xl font-extrabold">{e.licence}</p>
        </div>
        <div className="space-y-2 px-4 py-3 text-sm text-slate-600">
          {e.reasons
            .filter((r) => !r.startsWith('This overrides'))
            .map((r) => (
              <p key={r}>{r}</p>
            ))}
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Form {form}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Govt fee from ₹{GOVT_FEE_PER_YEAR[e.licence].toLocaleString('en-IN')}/year</span>
          </div>
          <SignupCta className="pt-1" />
          <p className="text-[11px] text-slate-400">Your answers are saved — you won't be asked again.</p>
        </div>
      </div>
    </div>
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

function Chip({ on, emoji, label, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
        on ? 'border-violet-500 bg-violet-600 text-white' : 'border-violet-100 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50'
      }`}
    >
      {emoji && <span className="text-base leading-none">{emoji}</span>}
      {label}
      {on && <Check size={14} />}
    </button>
  )
}
