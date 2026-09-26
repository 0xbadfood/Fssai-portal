// Typed answers, in layers. Each layer only picks among the current question's options, so a result depends on
// nothing but the question, its options and the text, and can be cached and reused for anyone:
//   state / turnover: read by code (state names, "80 lakh a year")
//   1. reviewed records   exact text, or the same words in any order (config/intake/records.v<N>.jsonl)
//   2. CLM                only when it is confident (config clm.threshold)
//   3. the model          10.8.0.5 (signed-in users only; results cached in intake_answer_cache)
//   4. clarifying taps    the user picks, with the best guesses first
// Spark (the silent reviewer) classifies every interpreted answer in the background; its answer is only logged.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ensureSchema, pool, repoRoot } from '../db.js'
import { chatJson } from '../llm.js'
import { CONFIG, E, graph, isInterpreted } from './index.js'
import { NONE_KEY, clmRequest } from './clm-format.mjs'
import { normalizeText, tokenSignature } from './records-format.mjs'
import { logEvent } from './events.js'

// ---------- personal details: removed before text is logged, cached or sent to any model ----------

const PII = [/\b[6-9]\d{9}\b/g, /[\w.+-]+@[\w-]+\.[\w.]+/g, /\b\d{4}\s?\d{4}\s?\d{4}\b/g, /\b[A-Z]{5}\d{4}[A-Z]\b/gi]
export const redact = (t) => PII.reduce((s, re) => s.replace(re, '[redacted]'), String(t || '')).slice(0, 500)

// ---------- the question as a classifier sees it ----------

const ESCAPES = new Set(['unsure', 'none'])
const concepts = new Map((graph.concepts || []).map((c) => [c.id, c]))

/** The current question's options (without "not sure" / "none of these"), with the graph's descriptions. */
function viewFor(q, facts) {
  const options = E.optionsFor(q, facts).filter((o) => !ESCAPES.has(o.id)).map((o) => ({ ...o, desc: concepts.get(o.id)?.desc || null }))
  const known = E.summary(facts).map((r) => r.value).filter(Boolean)
  return { q, facts, title: E.titleFor(q, facts), multi: E.isMulti(q, facts), options, context: known.length ? `What the user already told the chat: ${known.join('; ')}.\n` : '' }
}

// ---------- 1. reviewed records ----------

const records = new Map()
for (const line of readFileSync(path.join(repoRoot, 'config/intake', CONFIG.records), 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(line)
  for (const k of [`${r.step}|t|${r.text_norm}`, `${r.step}|s|${r.token_sig}`]) if (!records.has(k)) records.set(k, r)
}

function fromRecords(q, view, text) {
  const ids = view.options.map((o) => o.id)
  const r = records.get(`${q.id}|t|${normalizeText(text)}`) || records.get(`${q.id}|s|${tokenSignature(text)}`)
  if (!r || !r.targets.every((t) => ids.includes(t))) return null
  return r.targets.length ? { choice: r.targets, detail: { record: r.id } } : { none: true, detail: { record: r.id } }
}

// ---------- 2. CLM ----------

async function clmScores(view, text) {
  const { state, questions } = clmRequest(E, view, text)
  const t0 = Date.now()
  const res = await fetch(`${CONFIG.clm.url}/v1/systemone`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state, questions, model: CONFIG.clm.model }),
    signal: AbortSignal.timeout(CONFIG.clm.timeoutMs),
  })
  if (!res.ok) throw new Error(`CLM ${res.status}`)
  const probs = (await res.json()).answers?.q?.probabilities || {}
  return { ranked: Object.entries(probs).sort((a, b) => b[1] - a[1]), ms: Date.now() - t0 }
}

// ---------- 3. the model (cached) ----------

export function classifyPrompt(view, text) {
  return `${view.context}A user of an FSSAI licensing chat was asked: "${view.title}"

Options:
${view.options.map((o) => `- ${o.id}: ${o.label} — ${o.example}${o.desc ? ` (${o.desc})` : ''}`).join('\n')}

The user answered: """${text}"""

Which option${view.multi ? '(s)' : ''} does the answer mean? Pick only options the answer clearly states or strongly implies${view.multi ? ' (more than one only if the answer describes more than one)' : ''}. If no option fits, or the answer is off-topic or unclear, return an empty list.
Reply as JSON: {"choice": ["<option id>", ...], "confidence": "high|medium|low"}`
}

// The cache key covers everything the prompt shows except the context line, which only helps the model and
// is left out of the key on purpose: the same text for the same options means the same thing for anyone.
const sigFor = (view) => `g${graph.version}:${view.options.map((o) => o.id).join(',')}${view.multi ? '|multi' : ''}`
const keyFor = (q, sig, norm) => createHash('sha256').update([q.id, sig, norm].join('\n')).digest('hex')

async function fromModel(q, view, text) {
  await ensureSchema()
  const norm = normalizeText(text)
  const sig = sigFor(view)
  const { rows } = await pool.query(
    `UPDATE intake_answer_cache SET hits = hits + 1, last_hit_at = now()
       WHERE key = (SELECT key FROM intake_answer_cache
                     WHERE key = $1 OR (question_id = $2 AND options_sig = $3 AND token_sig = $4 AND token_sig <> '')
                     ORDER BY (key = $1) DESC, hits DESC LIMIT 1)
     RETURNING result`,
    [keyFor(q, sig, norm), q.id, sig, tokenSignature(text)],
  )
  if (rows[0]) return { ...rows[0].result, cached: true }
  const ids = view.options.map((o) => o.id)
  const { json, model } = await chatJson('intake', classifyPrompt(view, text))
  const result = {
    choice: [...new Set((Array.isArray(json?.choice) ? json.choice : []).filter((c) => ids.includes(c)))],
    confidence: ['high', 'medium', 'low'].includes(json?.confidence) ? json.confidence : 'low',
  }
  if (norm) {
    await pool.query(
      `INSERT INTO intake_answer_cache (key, question_id, options_sig, text_norm, token_sig, result, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result, model = EXCLUDED.model`,
      [keyFor(q, sig, norm), q.id, sig, norm.slice(0, 1000), tokenSignature(text).slice(0, 1000), JSON.stringify(result), model],
    )
  }
  return result
}

// ---------- read by code: states and turnover ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const STATE_WORDS = [
  ...graph.enums.states.map((s) => [s.toLowerCase(), s]),
  ...Object.entries(graph.enums.stateAliases || {}),
].sort((a, b) => b[0].length - a[0].length)

/** Every state / UT the text names, in the graph's spelling. */
export function findStates(text) {
  let t = ` ${String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ')} `
  const out = []
  for (const [word, name] of STATE_WORDS) {
    const re = new RegExp(`\\s${escapeRe(word)}\\s`)
    if (re.test(t)) {
      out.push(name)
      t = t.replace(re, ' ')
    }
  }
  return [...new Set(out)]
}

const UNIT = { crore: 1e7, cr: 1e7, lakh: 1e5, lac: 1e5, l: 1e5, k: 1e3, thousand: 1e3, hazar: 1e3, hazaar: 1e3 }
const PERIOD = { day: 365, daily: 365, din: 365, week: 52, weekly: 52, month: 12, monthly: 12, mahina: 12, mahine: 12, year: 1, yearly: 1, annual: 1, annually: 1, annum: 1, saal: 1, sal: 1 }
const MONEY_RE = /(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|l|k|thousand|hazaa?r)?\b(?:\s*rs)?(?:\s*(?:per|a|an|every|each|\/|har|ek)?\s*(day|daily|din|week|weekly|month|monthly|mahin[ae]|year|yearly|annual(?:ly)?|annum|saal|sal)\b)?/

/** Yearly sales in crore from "80 lakh", "20k a month", "₹5,000 per day"; null if there is no amount. */
export function parseSales(text) {
  const t = normalizeText(text)
  const m = t.match(MONEY_RE)
  if (!m) return null
  const unit = m[2] ? UNIT[m[2].replace(/s$/, '')] ?? UNIT[m[2]] : 1
  let period = m[3] ? PERIOD[m[3]] : 1
  if (!m[3]) for (const [w, p] of Object.entries(PERIOD)) if (new RegExp(`\\b${w}\\b`).test(t)) { period = p; break }
  const rupees = Number(m[1]) * unit * period
  if (!Number.isFinite(rupees) || rupees < 1000) return null // a bare "80" is not a sales figure
  return rupees / 1e7
}

/** The turnover option whose band holds this amount (the graph's own band rule for this question). */
function turnoverOption(q, facts, crore) {
  const ids = E.optionsFor(q, facts).map((o) => o.id)
  const hit = (q.value?.cases || []).find((c) => !c.when || E.ev(c.when, { ...facts, turnover_crore: crore }))
  return hit && ids.includes(hit.id) ? hit.id : null
}

// ---------- the layers together ----------

/**
 * Interpret typed text for question q. Returns one of:
 *   { choice: [optionIds], layer, detail }   apply like a tap
 *   { states: [names], layer }               apply like a tap on the state question
 *   { clarify: { guesses }, layer, detail }  not sure: ask the user to tap, best guesses first
 * allowModel: false on the public landing chat (records and CLM only, so it cannot be used to run the model).
 */
export async function interpret(q, facts, rawText, { allowModel = true, ref = {} } = {}) {
  const text = redact(rawText)
  if (q.kind === 'states') {
    const states = findStates(text)
    const multi = E.isMulti(q, facts)
    if (states.length && (multi ? states.length >= 2 : states.length === 1)) return { states, layer: 'rules' }
    return { clarify: { guesses: [] }, layer: 'clarify', detail: { found: states } }
  }
  if (q.id === 'turnover') {
    const crore = parseSales(text)
    const id = crore != null && turnoverOption(q, facts, crore)
    return id ? { choice: [id], layer: 'rules', detail: { crore } } : { clarify: { guesses: [] }, layer: 'clarify' }
  }
  if (!isInterpreted(q)) return { clarify: { guesses: [] }, layer: 'clarify' }

  const view = viewFor(q, facts)
  const escape = E.optionsFor(q, facts).find((o) => o.exclusive)?.id || null
  silentReview(q, view, text, ref)

  const rec = fromRecords(q, view, text)
  if (rec?.choice) return { choice: rec.choice, layer: 'records', detail: rec.detail }
  if (rec?.none && escape) return { choice: [escape], layer: 'records', detail: rec.detail }

  let clm = null
  try {
    clm = await clmScores(view, text)
  } catch (e) {
    logEvent({ ...ref, kind: 'error', step: q.id, detail: { where: 'clm', message: e.message } })
  }
  if (clm?.ranked.length) {
    const [top, p] = clm.ranked[0]
    const detail = { p: +p.toFixed(3), ms: clm.ms, ranked: clm.ranked.slice(0, 4).map(([id, x]) => [id, +x.toFixed(3)]) }
    if (p >= CONFIG.clm.threshold && top !== NONE_KEY) return { choice: [top], layer: 'clm', detail }
    if (p >= CONFIG.clm.threshold && top === NONE_KEY && escape) return { choice: [escape], layer: 'clm', detail: { ...detail, none: true } }
  }
  const ids = view.options.map((o) => o.id)
  const clmGuesses = clm ? clm.ranked.map(([id]) => id).filter((id) => ids.includes(id)).slice(0, 3) : []

  if (allowModel) {
    try {
      const m = await fromModel(q, view, text)
      if (m.choice.length && m.confidence !== 'low' && (view.multi || m.choice.length === 1)) {
        return { choice: m.choice, layer: 'model', detail: { confidence: m.confidence, cached: !!m.cached } }
      }
      if (m.choice.length) return { clarify: { guesses: [...new Set([...m.choice, ...clmGuesses])].slice(0, 3) }, layer: 'clarify', detail: { model: m } }
    } catch (e) {
      logEvent({ ...ref, kind: 'error', step: q.id, detail: { where: 'model', message: e.message } })
    }
  }
  return { clarify: { guesses: clmGuesses }, layer: 'clarify', detail: clm ? { ranked: clm.ranked.slice(0, 4) } : { clm: 'unavailable' } }
}

// ---------- silent reviewer ----------

// Spark serves one request at a time; answers that arrive while it is busy are not reviewed.
let reviewing = false
function silentReview(q, view, text, ref) {
  const R = CONFIG.silentReviewer
  if (!R?.url || reviewing) return
  reviewing = true
  const t0 = Date.now()
  const ids = view.options.map((o) => o.id)
  fetch(`${R.url}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: R.model, temperature: 0, max_tokens: 200,
      messages: [{ role: 'user', content: classifyPrompt(view, text) }],
      response_format: { type: 'json_schema', json_schema: { name: 'reply', schema: { type: 'object', properties: { choice: { type: 'array', items: { type: 'string', enum: ids } }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['choice', 'confidence'] } } },
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(R.timeoutMs),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d) => {
      const c = JSON.parse(d.choices?.[0]?.message?.content || '{}')
      logEvent({ ...ref, kind: 'silent-review', step: q.id, text, detail: { model: R.model, choice: (c.choice || []).filter((x) => ids.includes(x)), confidence: c.confidence ?? null, ms: Date.now() - t0 } })
    })
    .catch((e) => logEvent({ ...ref, kind: 'error', step: q.id, detail: { where: 'silent-review', message: e.message } }))
    .finally(() => { reviewing = false })
}
