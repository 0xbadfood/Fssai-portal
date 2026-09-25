import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const providerConfig = () => JSON.parse(readFileSync(path.join(root, 'config', 'llm-provider.json'), 'utf8'))

function extractJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('Model did not return JSON')
  return JSON.parse(text.slice(start, end + 1))
}

/**
 * Single-turn request to the configured OpenAI-compatible model; content is a string or content-parts array.
 * Per-task overrides (model, maxTokens, temperature, extraBody) come from config/llm-provider.json "tasks".
 */
export async function chatJson(task, content) {
  const base = providerConfig()
  const provider = { ...base, ...(base.tasks?.[task] || {}) }
  const body = {
    model: provider.model,
    temperature: provider.temperature,
    max_tokens: provider.maxTokens,
    messages: [{ role: 'user', content }],
    ...(provider.extraBody || {}),
  }
  if (provider.jsonMode) body.response_format = { type: 'json_object' }
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(provider.timeoutMs),
  })
  if (!res.ok) throw Object.assign(new Error(`LLM provider returned ${res.status}`), { status: 502 })
  const data = await res.json()
  return { model: provider.model, json: extractJson(data.choices?.[0]?.message?.content ?? '') }
}
