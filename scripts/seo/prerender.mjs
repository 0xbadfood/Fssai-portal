// After `vite build` (the app) and `vite build --ssr` (src/entry-server.jsx → .ssr/), write the public pages as
// complete HTML so search engines and link previews see real content, titles and structured data:
//
//   dist/index.html                landing page          dist/blog.html         all guides
//   dist/services.html             expert services       dist/blog/<slug>.html  one guide each
//   dist/services/<id>.html        one per service       dist/sitemap.xml
//   dist/app.html                  empty shell for sign-in, the dashboard and ops (noindex)
//   dist/404.html                  not-found page (served with status 404 by server/seo.js)
//
// Run by `npm run build`; server/seo.js serves these files at clean URLs.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { blogDocument, loadPosts, sitemapXml } from '../../server/seo.js'
import { publicCatalogue } from '../../server/servicesService.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const dist = path.join(root, 'dist')
const ssr = await import(pathToFileURL(path.join(root, '.ssr', 'entry-server.js')).href)

const template = readFileSync(path.join(dist, 'index.html'), 'utf8')
if (!template.includes('<!--seo-->') || !template.includes('<!--app-->')) throw new Error('dist/index.html is missing the <!--seo--> / <!--app--> markers')
const css = [...template.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1])
const font = readdirSync(path.join(dist, 'assets')).find((f) => /^inter-latin-wght-normal-.*\.woff2$/.test(f))
const fontPreload = font && `/assets/${font}`
const preloadTag = fontPreload ? `<link rel="preload" href="${fontPreload}" as="font" type="font/woff2" crossorigin />\n    ` : ''

const catalogue = publicCatalogue()
const catalogueJson = `<script type="application/json" id="catalogue-data">${JSON.stringify(catalogue).replace(/</g, '\\u003c')}</script>`

function write(file, html) {
  const out = path.join(dist, file)
  mkdirSync(path.dirname(out), { recursive: true })
  writeFileSync(out, html)
}

/** The built index.html with this page's head and rendered app markup. */
function appPage({ html = '', meta }, { embedCatalogue = false } = {}) {
  return template
    .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, preloadTag + ssr.renderHead(meta))
    .replace('<!--app-->', html)
    .replace('</body>', embedCatalogue ? `  ${catalogueJson}\n  </body>` : '</body>')
}

function route(url) {
  const page = ssr.renderRoute(url, { catalogue })
  if (!page.meta) throw new Error(`${url}: the page did not call useMeta`)
  return page
}

const counts = { app: 0, services: 0, blog: 0 }

write('index.html', appPage(route('/')))
write('services.html', appPage(route('/services'), { embedCatalogue: true }))
for (const section of catalogue.sections) {
  for (const svc of section.services) {
    write(`services/${svc.id}.html`, appPage(route(`/services/${svc.id}`), { embedCatalogue: true }))
    counts.services++
  }
}
write('404.html', appPage(route('/404-not-found')))
// The app shell for routes rendered only in the browser: no content, not indexed.
write('app.html', appPage({ meta: { title: 'MyFoodLicense', description: '', path: null, robots: 'noindex, nofollow' } }))
counts.app = 4

const blog = loadPosts()
const index = ssr.renderBlogIndex(blog.posts, blog.updated)
write('blog.html', blogDocument({ head: ssr.renderHead(index.meta), html: index.html, css, fontPreload }))
for (const post of blog.posts) {
  const page = ssr.renderBlogPost(post, blog.posts)
  write(`blog/${post.slug}.html`, blogDocument({ head: ssr.renderHead(page.meta), html: page.html, css, fontPreload }))
  counts.blog++
}

const sitemap = sitemapXml(blog, catalogue)
write('sitemap.xml', sitemap)
console.log(`prerendered ${counts.app} app pages, ${counts.services} service pages, ${counts.blog + 1} blog pages; sitemap.xml has ${(sitemap.match(/<url>/g) || []).length} URLs`)
// The pg pool imported with the catalogue never connects; don't wait for it.
process.exit(0)
