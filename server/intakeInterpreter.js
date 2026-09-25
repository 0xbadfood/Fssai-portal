// Layered interpretation of a typed intake answer:
//   1. rules  - deterministic phrase / money / state matching (src/lib/answerRules.js), instant
//   2. cache  - an earlier model interpretation of the same answer (exact text, then same words in any order)
//   3. model  - the LLM; its result is stored so the next identical answer skips it
// Every layer returns the same shape: { choice: [option ids], facts: {...raw facts}, reply, layer }.
import { createHash } from 'node:crypto'
import { ensureSchema, pool } from './db.js'
import { chatJson } from './llm.js'
import { QUESTIONS, isMulti, mergeInterpretation, nextQuestion, optionsFor, sanitizeFacts, titleFor } from '../src/lib/intakeQuestions.js'
import { normalizeText, ruleAnswer, tokenSignature } from '../src/lib/answerRules.js'

// Bump when the prompt or fact schema changes, so older interpretations are not reused.
const PROMPT_VERSION = 'v3'

// The signature carries the prompt version, so both the exact and the reworded lookups ignore older interpretations.
const optionsSig = (question, facts) =>
  `${PROMPT_VERSION}:${optionsFor(question, facts).map((o) => o.id).join(',')}${isMulti(question, facts) ? '|multi' : ''}`
const keyFor = (question, sig, norm) => createHash('sha256').update([question.id, sig, norm].join('\n')).digest('hex')

const RULE_REPLY = { activity: 'Got it!', trade: 'Noted.', place: 'Got it.', vending: 'Okay.', locations: 'Noted.', state: 'Got it.', online: 'Okay.', turnover: 'Thanks, noted.', nonfood: 'Okay.' }

/** Rules and cache only (never the model). Used by the public landing-page endpoint. */
export async function interpretCheap(facts, question, text) {
  const rule = ruleAnswer(question, facts, text)
  if (rule?.complete) return { ...rule, reply: RULE_REPLY[question.id] || 'Got it.', layer: 'rules' }
  const norm = normalizeText(text)
  if (!norm) return null
  await ensureSchema()
  const sig = optionsSig(question, facts)
  const { rows } = await pool.query(
    `UPDATE intake_answer_cache SET hits = hits + 1, last_hit_at = now()
       WHERE key = (SELECT key FROM intake_answer_cache
                     WHERE key = $1 OR (question_id = $2 AND options_sig = $3 AND token_sig = $4 AND token_sig <> '')
                     ORDER BY (key = $1) DESC, hits DESC LIMIT 1)
     RETURNING result`,
    [keyFor(question, sig, norm), question.id, sig, tokenSignature(text)],
  )
  return rows[0] ? { ...rows[0].result, layer: 'cache' } : null
}

export async function interpretAnswer(facts, question, text) {
  const cheap = await interpretCheap(facts, question, text)
  if (cheap) return cheap
  const { json, model } = await chatJson('intake', interpretPrompt(facts, question, text))
  const allowed = optionsFor(question, facts).map((o) => o.id)
  const result = {
    choice: Array.isArray(json?.choice) ? json.choice.filter((c) => allowed.includes(c)) : [],
    facts: json?.facts && typeof json.facts === 'object' ? json.facts : {},
    reply: String(json?.reply || '').slice(0, 300),
  }
  const norm = normalizeText(text)
  const sig = optionsSig(question, facts)
  await pool.query(
    `INSERT INTO intake_answer_cache (key, question_id, options_sig, text_norm, token_sig, result, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result, model = EXCLUDED.model`,
    [keyFor(question, sig, norm), question.id, sig, norm.slice(0, 1000), tokenSignature(text).slice(0, 1000), JSON.stringify(result), model],
  )
  return { ...result, layer: 'model' }
}

function interpretPrompt(facts, question, text) {
  const options = optionsFor(question, facts)
  return `You help small Indian food businesses work out their FSSAI licensing. Convert what the user wrote into facts.

Known facts so far: ${JSON.stringify(facts)}
Question the user was answering: "${titleFor(question, facts)}"
User wrote: """${text}"""

${options.length ? `Options for this question (id: label - examples):
${options.map((o) => `- ${o.id}: ${o.label} - ${o.example}`).join('\n')}
` : ''}
Reply with ONE JSON object: {"choice": [<ids of the options above that the user's answer matches${isMulti(question, facts) ? ', one or more' : ', at most one'}; [] if none clearly match>], "facts": {...}, "reply": "<one short, warm sentence acknowledging what you understood, max 25 words>"}
Put in "facts" only fields that are clearly stated or strongly implied (omit the rest; never guess turnover):
- "activities": array, any of "cook" (cooks/serves food: restaurant, cafe, tiffin, caterer, canteen, cloud kitchen, food cart), "make" (makes, processes, packs or repacks food), "sell" (sells, distributes, stores or transports food made by others), "import" (imports food into India)
- "trade": array, only when they sell/store/transport: any of "retail" (sells to consumers), "wholesale" (supplies other businesses), "storage" (warehouse / cold storage), "transport" (vehicles carrying food)
- "place": only if stated or obvious from the business (a cloud kitchen or shop is "premises"): one of "street" (cart, stall, food truck), "home" (home kitchen), "premises" (shop, restaurant, factory, warehouse, office), "hub" (inside an airport, seaport, railway station or central-government premises), "vehicles" (a transporter with no premises)
- "municipal_registered": boolean, street vendor holding a municipal / Town Vending Committee certificate
- "locations": only if they say how many places they operate from: "one", "many" (several places in one state), "multistate" (places in more than one state). Never assume "one".
- "states": array of Indian state / UT names where they operate
- "sells_online": boolean, sells through Swiggy / Zomato / Amazon / own website
- "ecommerce_platform": boolean, runs its OWN marketplace app or website where OTHER sellers list food (being a seller on Swiggy/Amazon is NOT this)
- "annual_sales_rupees": number, yearly sales as a plain number of rupees (e.g. "80 lakh a year" -> 8000000; "20k a month" -> 240000; "5,000 a day" -> 1825000; "2 crore" -> 20000000). If just starting, use expected first-year sales.
- "products": array of short food product names
- "city": string`
}

/**
 * Landing-page typed answer (no account yet): rules and cache only. The browser sends its facts so far;
 * the answer is accepted only for the question those facts are actually on.
 * Returns { hit: true, facts, reply, layer } or { hit: false }.
 */
export async function interpretPublic({ questionId, facts, text }) {
  const known = sanitizeFacts(facts)
  const question = QUESTIONS.find((q) => q.id === questionId)
  const clean = typeof text === 'string' ? text.trim().slice(0, 300) : ''
  if (!question || !clean || nextQuestion(known)?.id !== question.id) return { hit: false }
  const r = await interpretCheap(known, question, clean)
  if (!r) return { hit: false }
  const next = mergeInterpretation(known, question, r, clean)
  if (!question.answered(next) && nextQuestion(next)?.id === question.id) return { hit: false }
  return { hit: true, facts: next, reply: r.reply || 'Got it!', layer: r.layer }
}
