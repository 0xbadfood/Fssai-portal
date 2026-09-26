import React, { useEffect, useState } from 'react'
import { ArrowRight, Check, Plus } from 'lucide-react'
import { BigButton } from './ApplyPage.jsx'

const filled = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v != null)

// Fields and pre-filled values come from the server (r.fields, r.prefill: documents, account, answers).
export default function DetailsStep({ flow, r }) {
  const [info, setInfo] = useState(() => r.prefill.info)
  // A later refresh (e.g. a document read) can fill remaining gaps; what the user typed stays.
  useEffect(() => {
    setInfo((cur) => ({ ...r.prefill.info, ...Object.fromEntries(Object.entries(cur).filter(([, v]) => filled(v))) }))
  }, [r.prefill])
  const sourceOf = (id) => (info[id] !== undefined && JSON.stringify(info[id]) === JSON.stringify(r.prefill.info[id]) ? r.prefill.sources[id] : null)
  const fields = r.fields
  const missing = fields.filter((f) => !filled(info[f.id]))
  const set = (id, v) => {
    const next = { ...info, [id]: v }
    setInfo(next)
    flow.saveDraft(next)
  }
  const sections = [...new Set(fields.map((f) => f.section))]

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-orange-50 p-5 text-lg text-orange-900">
        📝 A few details for your <b>{r.kind === 'A' ? 'Form A' : 'Form B'}</b>. We've filled in what we already know — just check and tap.
      </div>

      {sections.map((sec) => (
        <div key={sec} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="text-xl font-extrabold text-slate-900">{sec}</h3>
          <div className="mt-4 space-y-6">
            {fields
              .filter((f) => f.section === sec)
              .map((f) => (
                <Field key={f.id} field={f} value={info[f.id]} source={sourceOf(f.id)} onChange={(v) => set(f.id, v)} />
              ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <BigButton disabled={flow.busy || missing.length > 0} onClick={() => flow.update({ info, step: 'documents' })}>
          Continue to documents <ArrowRight size={20} />
        </BigButton>
        <span className="text-sm font-medium text-slate-400">
          {flow.draftState === 'saved' ? '✓ Changes saved' : 'Saving…'}
        </span>
        {missing.length > 0 && <p className="text-base text-slate-500">Still needed: {missing.map((m) => m.label).join(', ')}</p>}
      </div>
    </div>
  )
}

function Field({ field, value, source, onChange }) {
  const options = field.options || []
  if (field.type === 'choice' && field.hideIfSingle && options.length === 1) return null
  return (
    <div>
      <p className="mb-2.5 flex flex-wrap items-center gap-2 text-lg font-bold text-slate-800">
        {field.label}
        {source && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${source.startsWith('your ID') || source.includes('proof') ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>
            {source.startsWith('your ID') || source.includes('proof') ? '📸 ' : ''}from {source}
          </span>
        )}
      </p>
      {field.type === 'text' && (
        <input
          value={value || ''}
          inputMode={field.inputMode}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.example ? `e.g. ${field.example}` : ''}
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-lg focus:border-violet-500 focus:outline-none"
        />
      )}
      {field.type === 'choice' && (
        <div className="flex flex-wrap gap-2.5">
          {options.map((o) => (
            <Pill key={o} on={value === o} onClick={() => onChange(o)}>
              {o}
            </Pill>
          ))}
        </div>
      )}
      {field.type === 'multichoice' && <MultiChoice field={field} value={value || []} onChange={onChange} />}
    </div>
  )
}

function MultiChoice({ field, value, onChange }) {
  const [adding, setAdding] = useState('')
  const options = [...new Set([...(field.suggestions || []), ...value])]
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  const add = () => {
    const v = adding.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setAdding('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) => (
          <Pill key={o} on={value.includes(o)} onClick={() => toggle(o)}>
            {o}
          </Pill>
        ))}
      </div>
      <div className="mt-3 flex max-w-md gap-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Something else? e.g. Mango pickle"
          className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-base focus:border-violet-500 focus:outline-none"
        />
        <button onClick={add} className="flex items-center rounded-2xl border-2 border-slate-200 px-3 text-slate-600 hover:border-violet-400" aria-label="Add">
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}

function Pill({ on, children, ...rest }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-2xl border-2 px-4 py-3 text-base font-bold transition active:scale-95 ${
        on ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'
      }`}
    >
      {on && <Check size={16} />}
      {children}
    </button>
  )
}
