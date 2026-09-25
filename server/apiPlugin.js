import { COOKIE, login, logout, requestPasswordReset, resetPassword, signup, userFromToken } from './authService.js'
import { listDocuments, readDocumentFile, uploadDocument } from './documentsService.js'
import { interpretPublic } from './intakeInterpreter.js'
import { createSupportRequest, listSupportRequests } from './supportService.js'
import { currentQuote, listPayments, payApplication } from './paymentsService.js'
import { answerQuestion, createApplication, currentApplication, markReady, reask, restartIntake, undoLastAnswer, updateApplication } from './applicationsService.js'

const MAX_BODY = 30_000_000
// The portal's public address (matches preview.allowedHosts in vite.config.js); used in emailed links.
const PUBLIC_ORIGIN = 'https://fssai.photovault.live'

// Per-IP budget for the public interpret endpoint: 30 requests per minute.
const interpretHits = new Map()
function allowInterpret(ip) {
  const now = Date.now()
  const recent = (interpretHits.get(ip) || []).filter((t) => now - t < 60_000)
  recent.push(now)
  interpretHits.set(ip, recent)
  if (interpretHits.size > 5000) interpretHits.clear()
  return recent.length <= 30
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const parseCookies = (req) =>
  Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter(([k]) => k))

// Caddy terminates TLS and forwards X-Forwarded-Proto; the app is only reachable via the VPN interface.
const isHttps = (req) => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()

function setSessionCookie(req, res, token, maxAge) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`]
  if (isHttps(req)) parts.push('Secure')
  res.setHeader('set-cookie', parts.join('; '))
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

// State-changing requests must be JSON and same-origin (blocks cross-site form posts / fetches).
function assertSameOrigin(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('Unsupported content type'), { status: 415 })
  const origin = req.headers.origin
  if (origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host
    if (new URL(origin).host !== host) throw Object.assign(new Error('Cross-origin request blocked'), { status: 403 })
  }
}

async function handler(req, res, next) {
  const url = (req.url || '').split('?')[0]
  if (!url.startsWith('/api/')) return next()
  // API responses skip the preview server's page headers, so set the basics here. (Document files are opened
  // inline, so they get frame-ancestors only: a stricter CSP can stop the browser's PDF viewer.)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'")
  try {
    const token = parseCookies(req)[COOKIE]
    const ctx = { ip: clientIp(req), userAgent: req.headers['user-agent'] }
    if (req.method !== 'GET') assertSameOrigin(req)

    if (req.method === 'POST' && (url === '/api/auth/login' || url === '/api/auth/signup')) {
      const body = JSON.parse(await readBody(req))
      const { user, session } = await (url.endsWith('login') ? login(body, ctx) : signup(body, ctx))
      setSessionCookie(req, res, session.token, session.maxAge)
      return json(res, 200, { user })
    }
    if (req.method === 'POST' && url === '/api/intake/interpret') {
      // Public (landing-page chat): rules + cache only, never the model, so it is cheap and cannot be used to run the LLM.
      if (!allowInterpret(ctx.ip)) return json(res, 429, { error: 'Too many requests' })
      return json(res, 200, await interpretPublic(JSON.parse((await readBody(req)) || '{}')))
    }
    if (req.method === 'POST' && url === '/api/auth/forgot') {
      // Never build the emailed link from a client-supplied host (reset-link poisoning).
      await requestPasswordReset(JSON.parse((await readBody(req)) || '{}'), { ip: ctx.ip, origin: PUBLIC_ORIGIN })
      return json(res, 200, { ok: true })
    }
    if (req.method === 'POST' && url === '/api/auth/reset') {
      const { user, session } = await resetPassword(JSON.parse((await readBody(req)) || '{}'), ctx)
      setSessionCookie(req, res, session.token, session.maxAge)
      return json(res, 200, { user })
    }
    if (req.method === 'POST' && url === '/api/auth/logout') {
      await logout(token)
      setSessionCookie(req, res, '', 0)
      return json(res, 200, { ok: true })
    }

    const user = await userFromToken(token)
    if (url === '/api/auth/me') {
      if (!user) return json(res, 401, { error: 'Not signed in' })
      const { id: _internal, ...publicUser } = user
      return json(res, 200, { user: publicUser })
    }
    if (!user) return json(res, 401, { error: 'Sign in required' })

    const file = url.match(/^\/api\/documents\/([^/]+)\/(file|preview)$/)
    if (req.method === 'GET' && url === '/api/documents') return json(res, 200, await listDocuments(user.id))
    if (req.method === 'GET' && file) {
      const { mime, fileName, data } = await readDocumentFile(user.id, file[1], { preview: file[2] === 'preview' })
      res.setHeader('content-type', mime)
      if (file[2] === 'file') res.setHeader('content-disposition', `inline; filename="${fileName.replace(/[^\w.\- ]/g, '_')}"`)
      res.setHeader('cache-control', 'private, max-age=3600')
      res.setHeader('x-content-type-options', 'nosniff')
      return res.end(data)
    }
    if (req.method === 'POST' && url === '/api/documents/verify') {
      return json(res, 200, await uploadDocument(user.id, JSON.parse(await readBody(req))))
    }
    if (req.method === 'GET' && url === '/api/payments') return json(res, 200, { payments: await listPayments(user.id), quote: await currentQuote(user.id) })
    if (req.method === 'POST' && url === '/api/payments') return json(res, 200, await payApplication(user.id, JSON.parse((await readBody(req)) || '{}')))
    if (req.method === 'GET' && url === '/api/support') return json(res, 200, { requests: await listSupportRequests(user.id) })
    if (req.method === 'POST' && url === '/api/support') {
      return json(res, 200, { request: await createSupportRequest(user.id, JSON.parse((await readBody(req)) || '{}')) })
    }
    if (req.method === 'GET' && url === '/api/applications/current') return json(res, 200, { application: await currentApplication(user.id) })
    if (req.method === 'POST' && url === '/api/applications') {
      return json(res, 200, { application: await createApplication(user.id, JSON.parse((await readBody(req)) || '{}')) })
    }
    const app = url.match(/^\/api\/applications\/([^/]+)\/(answer|reask|update|ready|undo|restart)$/)
    if (req.method === 'POST' && app) {
      const [, id, action] = app
      const body = JSON.parse((await readBody(req)) || '{}')
      const application =
        action === 'answer' ? await answerQuestion(user.id, id, body)
        : action === 'reask' ? await reask(user.id, id, body.questionId)
        : action === 'update' ? await updateApplication(user.id, id, body)
        : action === 'undo' ? await undoLastAnswer(user.id, id)
        : action === 'restart' ? await restartIntake(user.id, id)
        : await markReady(user.id, id)
      return json(res, 200, { application })
    }
    json(res, 404, { error: 'Not found' })
  } catch (e) {
    const status = e.status || (e.name === 'TimeoutError' ? 504 : e instanceof SyntaxError ? 400 : 500)
    json(res, status, { error: e.status || status === 400 ? e.message : e.name === 'TimeoutError' ? 'The verification model timed out' : 'Server error' })
    if (status === 500) console.error('[api]', e)
  }
}

export default function documentsPlugin() {
  return {
    name: 'portal-api',
    configureServer(s) {
      s.middlewares.use(handler)
    },
    configurePreviewServer(s) {
      s.middlewares.use(handler)
    },
  }
}
