// Search-engine plumbing for the portal: one canonical host, robots.txt per host, sitemap.xml, and serving the
// prerendered pages (scripts/seo/prerender.mjs) at clean URLs with real 404s.
//
// - www.myfoodlicense.com redirects (301) to myfoodlicense.com.
// - Any other host (the test names in config/site.json, a VPN address) is never indexed: every response carries
//   X-Robots-Tag: noindex and robots.txt disallows everything. Only the canonical host serves public/robots.txt.
// - Preview (production): /services → dist/services.html, /blog/<slug> → dist/blog/<slug>.html, sign-in and the
//   dashboard → the empty app shell (dist/app.html), anything else → dist/404.html with status 404.
// - Dev: the blog and sitemap.xml are rendered on request, so they can be checked without a build.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './db.js'
import { publicCatalogue } from './servicesService.js'

const SITE = JSON.parse(readFileSync(path.join(repoRoot, 'config', 'site.json'), 'utf8'))
export const CANONICAL_HOST = SITE.canonical
export const SITE_URL = `https://${CANONICAL_HOST}`

/** Routes the app renders in the browser only; never indexed (see public/robots.txt). */
const PRIVATE = /^\/(login|signup|forgot-password|reset-password|dashboard|ops)(\/|$)/

export function loadPosts() {
  return JSON.parse(readFileSync(path.join(repoRoot, 'content', 'blog', 'posts.json'), 'utf8'))
}

/** The day config/services.json last changed (git), for the services' <lastmod>. */
function servicesLastmod() {
  const file = path.join(repoRoot, 'config', 'services.json')
  try {
    const day = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'config/services.json'], { cwd: repoRoot, encoding: 'utf8' }).trim()
    if (day) return day
  } catch {
    // not a git checkout: fall back to the file's date
  }
  return statSync(file).mtime.toISOString().slice(0, 10)
}

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function sitemapXml({ posts, updated }, catalogue = publicCatalogue()) {
  const services = servicesLastmod()
  const url = (loc, lastmod, image) =>
    `  <url>\n    <loc>${xmlEsc(SITE_URL + loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}${
      image ? `\n    <image:image><image:loc>${xmlEsc(SITE_URL + image)}</image:loc></image:image>` : ''}\n  </url>`
  const entries = [
    url('/', null, '/og-default.png'),
    url('/about', services),
    url('/services', services),
    ...catalogue.sections.flatMap((s) => s.services.map((svc) => url(`/services/${svc.id}`, services))),
    url('/blog', updated),
    ...posts.map((p) => url(`/blog/${p.slug}`, p.updated, p.ogImage)),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`
}

/** A blog page: the rendered body with the app's stylesheet, and no script. */
export function blogDocument({ head, html, css, fontPreload }) {
  return `<!doctype html>
<html lang="en-IN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#7c3aed" />
    ${fontPreload ? `<link rel="preload" href="${fontPreload}" as="font" type="font/woff2" crossorigin />\n    ` : ''}${css.map((href) => `<link rel="stylesheet" href="${href}" />`).join('\n    ')}
    ${head}
  </head>
  <body>
    ${html}
  </body>
</html>
`
}

const hostOf = (req) => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')

/** www → canonical; non-canonical hosts → noindex. Returns true when the response has been sent. */
function hostRules(req, res) {
  const host = hostOf(req)
  if (host === `www.${CANONICAL_HOST}`) {
    res.statusCode = 301
    res.setHeader('location', SITE_URL + (req.url || '/'))
    res.end()
    return true
  }
  const canonical = host === CANONICAL_HOST
  if (!canonical) res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  if ((req.url || '').split('?')[0] === '/robots.txt' && !canonical) {
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(`# ${host || 'this host'} is not the public site; see ${SITE_URL}\nUser-agent: *\nDisallow: /\n`)
    return true
  }
  return false
}

const isPageRequest = (req) => (req.method === 'GET' || req.method === 'HEAD') && !(req.url || '').startsWith('/api/')

function send(res, status, type, body, headers = {}) {
  res.statusCode = status
  res.setHeader('content-type', type)
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(body)
}

/** Production: route clean URLs to the prerendered files in dist/. */
function previewMiddleware(distDir, pageHeaders) {
  const notFound = () => readFileSync(path.join(distDir, '404.html'))
  return (req, res, next) => {
    if (hostRules(req, res)) return
    if (!isPageRequest(req)) return next()
    const [pathname, query] = (req.url || '/').split(/\?(.*)/s)
    const search = query ? `?${query}` : ''

    if (pathname.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // content-hashed file names
      return next()
    }
    if (pathname.startsWith('/blog/images/') || pathname.startsWith('/blog/og/') || pathname.startsWith('/blog/checklists/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return next()
    }
    // One URL per page: no .html, no trailing slash.
    const html = pathname.match(/^(.*?)(\/index)?\.html$/)
    if (html) {
      if (/^\/(app|404)$/.test(html[1])) return send(res, 404, 'text/html; charset=utf-8', notFound(), pageHeaders)
      res.statusCode = 301
      res.setHeader('location', (html[1] || '/') + search)
      return res.end()
    }
    if (pathname.length > 1 && pathname.endsWith('/')) {
      res.statusCode = 301
      res.setHeader('location', pathname.replace(/\/+$/, '') + search)
      return res.end()
    }
    if (path.extname(pathname)) return next() // a file: robots.txt, sitemap.xml, images…

    let file = null
    if (pathname === '/') file = '/index.html'
    else if (PRIVATE.test(pathname)) file = '/app.html'
    else if (/^[a-z0-9/-]+$/.test(pathname) && existsSync(path.join(distDir, `${pathname}.html`))) file = `${pathname}.html`
    if (!file) return send(res, 404, 'text/html; charset=utf-8', notFound(), pageHeaders)
    res.setHeader('Cache-Control', 'no-cache')
    req.url = file + search
    next()
  }
}

/** Dev: the blog and sitemap.xml rendered on request through Vite's SSR loader. */
function devMiddleware(server) {
  return async (req, res, next) => {
    if (hostRules(req, res)) return
    if (!isPageRequest(req)) return next()
    const pathname = (req.url || '/').split('?')[0]
    try {
      if (pathname === '/sitemap.xml') return send(res, 200, 'application/xml; charset=utf-8', sitemapXml(loadPosts()))
      const blog = pathname.match(/^\/blog(?:\/([a-z0-9-]+))?\/?$/)
      if (!blog) return next()
      const ssr = await server.ssrLoadModule('/src/entry-server.jsx')
      const { posts, updated } = loadPosts()
      const post = blog[1] && posts.find((p) => p.slug === blog[1])
      if (blog[1] && !post) return next()
      const page = post ? ssr.renderBlogPost(post, posts) : ssr.renderBlogIndex(posts, updated)
      send(res, 200, 'text/html; charset=utf-8', blogDocument({ head: ssr.renderHead(page.meta), html: page.html, css: ['/src/index.css'] }))
    } catch (e) {
      server.ssrFixStacktrace(e)
      next(e)
    }
  }
}

export default function seoPlugin() {
  return {
    name: 'portal-seo',
    configureServer(server) {
      server.middlewares.use(devMiddleware(server))
    },
    configurePreviewServer(server) {
      const distDir = path.resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use(previewMiddleware(distDir, server.config.preview.headers || {}))
    },
  }
}
