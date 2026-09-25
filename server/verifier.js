import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chatJson, providerConfig } from './llm.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (f) => JSON.parse(readFileSync(path.join(root, 'config', f), 'utf8'))

export function buildPrompt(docType, today) {
  const qs = docType.questions
    .map((q, i) => `${i + 1}. id="${q.id}": ${q.q.replaceAll('{{today}}', today)}`)
    .join('\n')
  const extract = docType.extract.map((k) => `"${k}"`).join(', ')
  const hints = Object.entries(docType.extractHints || {}).map(([k, h]) => `- "${k}": ${h}`).join('\n')
  return `You are a document-verification assistant for an Indian food-licensing (FSSAI) portal.
The applicant claims this image is: "${docType.label}" - ${docType.description}

Inspect the image carefully and answer ONLY with one JSON object, no prose, in exactly this shape:
{
  "detected_document_type": "<short description of what the image actually is>",
  "matches_expected": <true|false>,
  "answers": { "<question id>": { "answer": <true|false>, "evidence": "<max 15 words>" } },
  "quality": {
    "score": <0-100 overall legibility/usability score>,
    "flags": [<zero or more of "blurry","low_resolution","glare","dark","cropped","rotated","unreadable","screenshot_of_screen","not_a_document">]
  },
  "extracted": { ${extract}: <string or null each> }
}

Questions (answer every one, true only if clearly satisfied):
${qs}

${hints ? `Extracted field formats:\n${hints}\n\n` : ''}Rules: never invent text that is not visible; use null for fields you cannot read; a photo of another screen counts as "screenshot_of_screen".`
}

export function decide(spec, config, raw) {
  const answers = spec.questions.map((q) => {
    const a = raw?.answers?.[q.id]
    const answer = a?.answer === true
    return { id: q.id, question: q.q.replaceAll('{{today}}', ''), answer, evidence: a?.evidence ?? '', passed: answer || q.required === false, required: q.required !== false }
  })
  const score = Math.max(0, Math.min(100, Math.round(Number(raw?.quality?.score) || 0)))
  const flags = Array.isArray(raw?.quality?.flags) ? raw.quality.flags : []
  const blocking = flags.filter((f) => config.quality.blockingFlags.includes(f))
  const matches = raw?.matches_expected === true

  const issues = []
  if (!matches) issues.push(`This looks like "${raw?.detected_document_type || 'a different document'}", not ${spec.label}.`)
  if (matches) spec.questions.forEach((q, i) => { if (!answers[i].passed) issues.push(q.fail) })
  if (blocking.length) issues.push(`Image quality problem: ${blocking.join(', ').replaceAll('_', ' ')}.`)
  if (score < config.quality.minScore) issues.push(`Image quality is too low (${score}/100). Upload a clearer, well-lit photo or scan.`)

  let decision = 'accepted'
  if (!matches || answers.some((a) => !a.passed) || blocking.length) decision = 'rejected'
  else if (score < config.quality.minScore) decision = score >= config.quality.minScore - config.quality.reviewBand ? 'review' : 'rejected'
  // optional-question failures don't reject but are surfaced as review hints
  const softFails = spec.questions.filter((q, i) => q.required === false && !answers[i].answer)
  if (decision === 'accepted' && softFails.length) {
    decision = 'review'
    softFails.forEach((q) => issues.push(q.fail))
  }
  return {
    decision, qualityScore: score, matchesExpected: matches, detectedType: raw?.detected_document_type ?? '',
    answers, extracted: raw?.extracted ?? {}, flags, issues,
  }
}

const IMAGE_URL = /^data:image\/(jpeg|png|webp);base64,/
export const MAX_PAGES = 4

export async function verifyDocument({ docTypeId, pages }) {
  const provider = providerConfig()
  const config = readJson('document-types.json')
  const spec = config.types[docTypeId]
  if (!spec) throw Object.assign(new Error(`Unknown document type: ${docTypeId}`), { status: 400 })
  if (!Array.isArray(pages) || !pages.length || pages.length > MAX_PAGES || !pages.every((p) => IMAGE_URL.test(p || ''))) {
    throw Object.assign(new Error(`Send 1-${MAX_PAGES} jpeg/png/webp page images`), { status: 400 })
  }
  if (pages.some((p) => p.length > provider.maxImageBytes * 1.4)) throw Object.assign(new Error('Image too large'), { status: 413 })

  const today = new Date().toISOString().slice(0, 10)
  const multi = pages.length > 1 ? `\nThe document is given as ${pages.length} page images in order; judge the document as a whole.` : ''
  const { model, json } = await chatJson('verifyDocument', [
    { type: 'text', text: buildPrompt(spec, today) + multi },
    ...pages.map((url) => ({ type: 'image_url', image_url: { url } })),
  ])
  return { model, verifiedAt: new Date().toISOString(), ...decide(spec, config, json) }
}
