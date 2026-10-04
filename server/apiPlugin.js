import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COOKIE, login, logout, requestPasswordReset, resetPassword, signup, userFromToken } from './authService.js'
import { listDocuments, readDocumentFile, uploadDocument } from './documentsService.js'
import { answerSession, previewSession, rateSession, restartSession, resumeSession, undoSession } from './intake/sessions.js'
import { createSupportRequest, listSupportRequests } from './supportService.js'
import { currentQuote, listPayments, payApplication } from './paymentsService.js'
import { handleWebhook, startCheckout, syncCheckout } from './checkoutService.js'
import { paymentMode } from './cashfree.js'
import { addOrderNote, cancelMyOrder, chargeOrder, createOrder, getMyOrder, getOrder, isStaff, listMyOrders, listOrders, myOrderMessages, payOrder, publicCatalogue, replyToOrder, setOrderStatus, takeOrder, transferOrder } from './servicesService.js'
import { addNote, caseDocumentFile, caseFileDownload, getCase, listCases, reviewDocument, setCaseFile, setStatus, takeCase, transferCase, updateDetail, uploadForCustomer } from './opsService.js'
import { CONTACT_VIA, SUPPORT_TOPICS } from '../src/lib/supportTopics.js'
import { answerQuestion, createApplication, currentApplication, getApplication, listApplications, markReady, rateResult, reask, restartIntake, undoLastAnswer, updateApplication } from './applicationsService.js'

const MAX_BODY = 30_000_000
// The portal's public addresses (config/site.json, also vite's allowedHosts). Emailed links use the host the
// request came in on, so a reset link from myfoodlicense.com points back to myfoodlicense.com.
const SITE = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'site.json'), 'utf8'))
const publicOrigin = (req) => {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().replace(/:\d+$/, '').toLowerCase()
  return `https://${SITE.hosts.includes(host) ? host : SITE.canonical}`
}

// Document types as the upload screens show them (labels and the checks the AI runs), without the model's prompts.
const DOC_TYPES = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'document-types.json'), 'utf8')).types
const appConfig = () => ({
  docTypes: Object.fromEntries(Object.entries(DOC_TYPES).map(([id, t]) => [id, { label: t.label, description: t.description, questions: t.questions.map((q) => ({ id: q.id, q: q.q })) }])),
  supportTopics: SUPPORT_TOPICS,
  contactVia: CONTACT_VIA,
})

// Per-IP budget for the public intake chat (one request per answer): 60 requests per minute.
const interpretHits = new Map()
function allowInterpret(ip) {
  const now = Date.now()
  const recent = (interpretHits.get(ip) || []).filter((t) => now - t < 60_000)
  recent.push(now)
  interpretHits.set(ip, recent)
  if (interpretHits.size > 5000) interpretHits.clear()
  return recent.length <= 60
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

// The mobile app (mobile/) sends its session token as a bearer token instead of a cookie. Sign-in answers it with
// the token in the body only when it identifies itself; browsers keep the HttpOnly cookie. A bearer token is never
// sent by a browser on its own, so it needs no same-origin check beyond the JSON-only rule below.
const isApp = (req) => req.headers['x-mfl-client'] === 'app'
const bearer = (req) => /^Bearer ([\w-]{20,100})$/.exec(String(req.headers.authorization || ''))?.[1]

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
  const queryParam = (r, key) => new URLSearchParams((r.url || '').split('?')[1] || '').get(key)
  if (!url.startsWith('/api/')) return next()
  // API responses skip the preview server's page headers, so set the basics here. (Document files are opened
  // inline, so they get frame-ancestors only: a stricter CSP can stop the browser's PDF viewer.)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'")
  try {
    const token = bearer(req) || parseCookies(req)[COOKIE]
    const ctx = { ip: clientIp(req), userAgent: req.headers['user-agent'] }
    if (req.method !== 'GET') assertSameOrigin(req)

    if (req.method === 'POST' && (url === '/api/auth/login' || url === '/api/auth/signup')) {
      const body = JSON.parse(await readBody(req))
      const { user, session } = await (url.endsWith('login') ? login(body, ctx, { customersOnly: isApp(req) }) : signup(body, ctx))
      setSessionCookie(req, res, session.token, session.maxAge)
      return json(res, 200, isApp(req) ? { user, token: session.token } : { user })
    }
    // What the app needs to render the same screens as the web: document types, support topics.
    if (req.method === 'GET' && url === '/api/app/config') return json(res, 200, appConfig())
    const intake = url.match(/^\/api\/intake\/(preview|resume|answer|undo|restart|rate)$/)
    if (req.method === 'POST' && intake) {
      // Public landing-page chat. The conversation lives on the server; typed answers use records and CLM only,
      // never the model, so this endpoint cannot be used to run the LLM.
      if (!allowInterpret(ctx.ip)) return json(res, 429, { error: 'Too many requests. Wait a minute and try again.' })
      const body = JSON.parse((await readBody(req)) || '{}')
      const action = intake[1]
      return json(
        res,
        200,
        action === 'preview' ? previewSession()
        : action === 'resume' ? await resumeSession(body.session)
        : action === 'answer' ? await answerSession(body.session || null, body, ctx)
        : action === 'undo' ? await undoSession(body.session)
        : action === 'restart' ? await restartSession(body.session)
        : await rateSession(body.session, body),
      )
    }
    // The payment gateway's webhook: signed with our secret key (checked on the raw body), then re-checked with its API.
    if (req.method === 'POST' && url === '/api/payments/cashfree/webhook') {
      res.statusCode = await handleWebhook(await readBody(req), req.headers)
      return res.end()
    }
    // Expert-services catalogue (public: the services pages work before sign-in).
    if (req.method === 'GET' && url === '/api/services') return json(res, 200, publicCatalogue())
    if (req.method === 'POST' && url === '/api/auth/forgot') {
      // Never build the emailed link from a client-supplied host (reset-link poisoning).
      await requestPasswordReset(JSON.parse((await readBody(req)) || '{}'), { ip: ctx.ip, origin: publicOrigin(req) })
      return json(res, 200, { ok: true })
    }
    if (req.method === 'POST' && url === '/api/auth/reset') {
      const { user, session } = await resetPassword(JSON.parse((await readBody(req)) || '{}'), ctx)
      setSessionCookie(req, res, session.token, session.maxAge)
      return json(res, 200, isApp(req) && !isStaff(user) ? { user, token: session.token } : { user })
    }
    if (req.method === 'POST' && url === '/api/auth/logout') {
      await logout(token)
      setSessionCookie(req, res, '', 0)
      return json(res, 200, { ok: true })
    }

    const user = await userFromToken(token)
    // The app is for customers only: a team account's session is never accepted from it.
    if (user && isStaff(user) && (isApp(req) || bearer(req))) {
      return json(res, 403, { error: 'Team accounts sign in on the web console, not in the app.' })
    }
    if (url === '/api/auth/me') {
      if (!user) return json(res, 401, { error: 'Not signed in' })
      const { id: _internal, ...publicUser } = user
      return json(res, 200, { user: publicUser })
    }
    if (!user) return json(res, 401, { error: 'Sign in required' })

    // Operations console: team accounts only (ops, admin, expert). They use nothing else: no applications of their own.
    // Filing cases are for ops and the admin (checked in opsService); expert-service orders are worked by experts.
    if (url.startsWith('/api/ops/')) {
      if (!isStaff(user)) return json(res, 403, { error: 'Operations team only.' })
      if (req.method === 'GET' && url === '/api/ops/expert/orders') return json(res, 200, await listOrders(user))
      const eo = url.match(/^\/api\/ops\/expert\/orders\/([0-9a-f-]{36})(?:\/(take|transfer|status|note|charge))?$/)
      if (eo && req.method === 'GET' && !eo[2]) return json(res, 200, await getOrder(user, eo[1]))
      if (eo && req.method === 'POST' && eo[2]) {
        const body = JSON.parse((await readBody(req)) || '{}')
        const [, id, action] = eo
        return json(res, 200,
          action === 'take' ? await takeOrder(user, id)
          : action === 'transfer' ? await transferOrder(user, id, body)
          : action === 'status' ? await setOrderStatus(user, id, body)
          : action === 'note' ? await addOrderNote(user, id, body)
          : await chargeOrder(user, id, body))
      }
      if (req.method === 'GET' && url === '/api/ops/cases') return json(res, 200, await listCases(user))
      const one = url.match(/^\/api\/ops\/cases\/([0-9a-f-]{36})$/)
      if (req.method === 'GET' && one) return json(res, 200, await getCase(user, one[1]))
      const docFile = url.match(/^\/api\/ops\/cases\/([0-9a-f-]{36})\/documents\/([0-9a-f-]{36})\/(file|preview)$/)
      if (req.method === 'GET' && docFile) {
        const { mime, fileName, data } = await caseDocumentFile(user, docFile[1], docFile[2], { preview: docFile[3] === 'preview' })
        res.setHeader('content-type', mime)
        if (docFile[3] === 'file') res.setHeader('content-disposition', `inline; filename="${fileName.replace(/[^\w.\- ]/g, '_')}"`)
        res.setHeader('cache-control', 'private, no-store')
        return res.end(data)
      }
      const act = url.match(/^\/api\/ops\/cases\/([0-9a-f-]{36})\/(take|transfer|status|detail|note|upload)$/)
      if (req.method === 'POST' && act) {
        const [, id, action] = act
        const body = JSON.parse((await readBody(req)) || '{}')
        if (action === 'take') return json(res, 200, await takeCase(user, id))
        if (action === 'transfer') return json(res, 200, await transferCase(user, id, body))
        const out =
          action === 'status' ? await setStatus(user, id, body)
          : action === 'detail' ? await updateDetail(user, id, body)
          : action === 'note' ? await addNote(user, id, body)
          : await uploadForCustomer(user, id, body)
        return json(res, 200, out)
      }
      // The FoSCoS checklist: set a slot's file (or mark it not applicable), and download a slot's file.
      const slot = url.match(/^\/api\/ops\/cases\/([0-9a-f-]{36})\/foscos\/([a-z0-9_]{1,40})$/)
      if (req.method === 'POST' && slot) return json(res, 200, await setCaseFile(user, slot[1], slot[2], JSON.parse((await readBody(req)) || '{}')))
      const slotFile = url.match(/^\/api\/ops\/cases\/([0-9a-f-]{36})\/foscos-files\/([0-9a-f-]{36})$/)
      if (req.method === 'GET' && slotFile) {
        const { mime, fileName, data } = await caseFileDownload(user, slotFile[1], slotFile[2])
        res.setHeader('content-type', mime)
        res.setHeader('content-disposition', `${(req.url || '').includes('?download') ? 'attachment' : 'inline'}; filename="${fileName.replace(/[^\w.\- ]/g, '_')}"`)
        res.setHeader('cache-control', 'private, no-store')
        return res.end(data)
      }
      const review = url.match(/^\/api\/ops\/cases\/([0-9a-f-]{36})\/documents\/([0-9a-f-]{36})\/review$/)
      if (req.method === 'POST' && review) return json(res, 200, await reviewDocument(user, review[1], review[2], JSON.parse((await readBody(req)) || '{}')))
      return json(res, 404, { error: 'Not found' })
    }
    if (isStaff(user)) return json(res, 403, { error: 'Operations accounts use the operations console.' })

    // Expert services: the customer's orders.
    if (req.method === 'GET' && url === '/api/orders') return json(res, 200, { orders: await listMyOrders(user.id) })
    if (req.method === 'POST' && url === '/api/orders') return json(res, 200, { order: await createOrder(user.id, JSON.parse((await readBody(req)) || '{}')) })
    const myOrder = url.match(/^\/api\/orders\/([0-9a-f-]{36})(?:\/(pay|cancel|reply))?$/)
    if (myOrder && req.method === 'GET' && !myOrder[2]) {
      return json(res, 200, { order: await getMyOrder(user.id, myOrder[1]), messages: await myOrderMessages(user.id, myOrder[1]), paymentMode: paymentMode() })
    }
    if (myOrder && req.method === 'POST' && myOrder[2]) {
      const body = JSON.parse((await readBody(req)) || '{}')
      const [, id, action] = myOrder
      if (action === 'pay') return json(res, 200, await payOrder(user.id, id, body))
      if (action === 'cancel') return json(res, 200, { order: await cancelMyOrder(user.id, id) })
      return json(res, 200, { order: await replyToOrder(user.id, id, body) })
    }

    const file = url.match(/^\/api\/documents\/([^/]+)\/(file|preview)$/)
    // ?application=<id>: that application's documents (the person's own plus its premises ones); default the current one.
    if (req.method === 'GET' && url === '/api/documents') return json(res, 200, await listDocuments(user.id, queryParam(req, 'application')))
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
    if (req.method === 'GET' && url === '/api/payments') return json(res, 200, { payments: await listPayments(user.id), quote: await currentQuote(user.id, queryParam(req, 'application')) })
    // Gateway checkout (sandbox / live): start one, and confirm it on the return page.
    if (req.method === 'POST' && url === '/api/payments/checkout') return json(res, 200, await startCheckout(user.id, JSON.parse((await readBody(req)) || '{}'), publicOrigin(req)))
    if (req.method === 'POST' && url === '/api/payments/confirm') return json(res, 200, { checkout: await syncCheckout(JSON.parse((await readBody(req)) || '{}').id, user.id) })
    if (req.method === 'POST' && url === '/api/payments') return json(res, 200, await payApplication(user.id, JSON.parse((await readBody(req)) || '{}')))
    if (req.method === 'GET' && url === '/api/support') return json(res, 200, { requests: await listSupportRequests(user.id) })
    if (req.method === 'POST' && url === '/api/support') {
      return json(res, 200, { request: await createSupportRequest(user.id, JSON.parse((await readBody(req)) || '{}')) })
    }
    if (req.method === 'GET' && url === '/api/applications') return json(res, 200, { applications: await listApplications(user) })
    if (req.method === 'GET' && url === '/api/applications/current') return json(res, 200, { application: await currentApplication(user) })
    const oneApp = url.match(/^\/api\/applications\/([0-9a-f-]{36})$/)
    if (req.method === 'GET' && oneApp) return json(res, 200, { application: await getApplication(user, oneApp[1]) })
    if (req.method === 'POST' && url === '/api/applications') {
      return json(res, 200, { application: await createApplication(user, JSON.parse((await readBody(req)) || '{}')) })
    }
    const app = url.match(/^\/api\/applications\/([^/]+)\/(answer|reask|update|ready|undo|restart|rate)$/)
    if (req.method === 'POST' && app) {
      const [, id, action] = app
      const body = JSON.parse((await readBody(req)) || '{}')
      if (action === 'rate') return json(res, 200, await rateResult(user, id, body))
      const application =
        action === 'answer' ? await answerQuestion(user, id, body)
        : action === 'reask' ? await reask(user, id, body.questionId)
        : action === 'update' ? await updateApplication(user, id, body)
        : action === 'undo' ? await undoLastAnswer(user, id)
        : action === 'restart' ? await restartIntake(user, id)
        : await markReady(user, id)
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
