import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Keyboard, Send, Sparkles } from 'lucide-react'
import { useAuth } from '../../../lib/auth.jsx'
import { POPULAR_STATES, QUESTIONS, STATES, hintFor, isMulti, nextQuestion, optionsFor, titleFor } from '../../../lib/intakeQuestions.js'
import { docFacts } from '../../../lib/applicationPlan.js'
import { BigButton, CARD_TONES } from './ApplyPage.jsx'
import ChatControls from './ChatControls.jsx'

export default function IntakeStep({ app, flow, docs }) {
  const { session } = useAuth()
  const q = nextQuestion(app.facts)
  const facts = app.facts
  const qNumber = QUESTIONS.filter((x) => x.relevant(facts) && x.answered(facts)).length + 1
  const [picked, setPicked] = useState([])
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [allStates, setAllStates] = useState(false)
  const bottom = useRef(null)
  const fromDocs = docFacts(docs)

  useEffect(() => {
    setPicked(q?.kind === 'states' && fromDocs.state ? [fromDocs.state.value] : [])
    setTyping(false)
    setText('')
  }, [q?.id])
  // Braces matter: an effect's return value is its cleanup, and Chrome's smooth scrollIntoView returns a Promise.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [app.transcript.length, flow.busy])

  if (!q) return null

  const tapSingle = (id) => !flow.busy && flow.answer({ questionId: q.id, optionIds: [id] })
  const multi = isMulti(q, facts)
  const options = optionsFor(q, facts)
  const exclusive = (id) => options.find((o) => o.id === id)?.exclusive
  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : exclusive(id) ? [id] : [...p.filter((x) => !exclusive(x)), id]))
  const tapState = (s) => (multi ? toggle(s) : !flow.busy && flow.answer({ questionId: q.id, states: [s] }))
  const submitMulti = () => flow.answer(q.kind === 'states' ? { questionId: q.id, states: picked } : { questionId: q.id, optionIds: picked })
  const submitText = async () => {
    if (!text.trim()) return
    const res = await flow.answer({ questionId: q.id, text })
    if (res) setText('')
  }

  const firstName = session?.name?.split(' ')[0] || 'there'
  const stateList = allStates ? STATES : [...new Set([...POPULAR_STATES, ...picked])]

  return (
    <div className="space-y-5">
      <Bubble>
        {app.transcript.length === 0 ? (
          <>
            Namaste {firstName}! 👋 I'll work out exactly which FSSAI licence you need. <b>Just tap your answers</b> — it takes about a minute.
          </>
        ) : (
          <>Great, let's keep going!</>
        )}
      </Bubble>

      {app.transcript.map((t, i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-base font-medium text-white">
              {t.answer}
            </p>
          </div>
          {t.reply && <Bubble small>{t.reply}</Bubble>}
        </div>
      ))}

      <ChatControls app={app} flow={flow} />

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-bold uppercase tracking-wide text-violet-500">
          {q.id === 'check' ? 'Just checking' : `Question ${qNumber}`}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">{titleFor(q, facts)}</h2>
        {hintFor(q, facts) && <p className="mt-2 text-base text-slate-500">{hintFor(q, facts)}</p>}
        {q.kind === 'states' && fromDocs.state && picked.includes(fromDocs.state.value) && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1.5 text-sm font-semibold text-pink-700">
            📸 From {fromDocs.state.source}: {multi ? 'add any others and tap Continue' : 'tap it to confirm'}
          </p>
        )}

        {q.kind === 'states' ? (
          <div className="mt-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {stateList.map((s) => (
                <button
                  key={s}
                  disabled={flow.busy}
                  onClick={() => tapState(s)}
                  className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3.5 text-left text-base font-bold transition ${
                    picked.includes(s) ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'
                  }`}
                >
                  {s}
                  {picked.includes(s) && <Check size={18} className="shrink-0 text-violet-600" />}
                </button>
              ))}
            </div>
            {!allStates && (
              <button onClick={() => setAllStates(true)} className="mt-3 text-base font-semibold text-violet-600 hover:underline">
                Show all states & UTs
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {options.map((o, i) => {
              const on = picked.includes(o.id)
              return (
                <button
                  key={o.id}
                  disabled={flow.busy}
                  onClick={() => (multi ? toggle(o.id) : tapSingle(o.id))}
                  className={`relative flex min-h-[120px] items-start gap-4 rounded-3xl border-2 bg-gradient-to-br p-5 text-left transition active:scale-[0.98] disabled:opacity-60 ${CARD_TONES[i % CARD_TONES.length]} ${
                    on ? '!border-violet-500 ring-4 ring-violet-200' : ''
                  }`}
                >
                  <span className="text-4xl leading-none">{o.emoji}</span>
                  <span>
                    <span className="block text-xl font-extrabold text-slate-900">{o.label}</span>
                    <span className="mt-1 block text-sm leading-snug text-slate-600">{o.example}</span>
                  </span>
                  {on && (
                    <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white">
                      <Check size={16} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {multi && (
          <BigButton className="mt-5 w-full sm:w-auto" disabled={!picked.length || flow.busy} onClick={submitMulti}>
            Continue <ArrowRight size={20} />
          </BigButton>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4">
          {typing ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitText()}
                placeholder={qNumber === 1 ? 'e.g. I run a cloud kitchen in Pune, about ₹80 lakh a year' : 'Type your answer…'}
                className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={submitText}
                disabled={flow.busy || !text.trim()}
                className="flex items-center justify-center rounded-2xl bg-violet-600 px-4 text-white disabled:opacity-40"
                aria-label="Send"
              >
                <Send size={20} />
              </button>
            </div>
          ) : (
            <button onClick={() => setTyping(true)} className="flex items-center gap-2 text-base font-semibold text-slate-500 hover:text-violet-600">
              <Keyboard size={18} /> {qNumber === 1 ? 'Or describe your business in your own words' : 'None of these? Tell me in your own words'}
            </button>
          )}
        </div>
      </div>

      {flow.busy && (
        <Bubble small>
          <span className="inline-flex gap-1">
            <Dot delay="0ms" /> <Dot delay="150ms" /> <Dot delay="300ms" />
          </span>
        </Bubble>
      )}
      <div ref={bottom} />
    </div>
  )
}

function Bubble({ children, small }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow">
        <Sparkles size={18} />
      </span>
      <p className={`max-w-[85%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-slate-700 shadow-sm ${small ? 'text-base' : 'text-lg'}`}>
        {children}
      </p>
    </div>
  )
}

const Dot = ({ delay }) => <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: delay }} />
