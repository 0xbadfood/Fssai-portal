// The blog (/blog and /blog/<slug>): rendered to static HTML at build time by scripts/seo/prerender.mjs (and on
// request in dev), with the app's stylesheet but no JavaScript. The articles are data in content/blog/posts.json,
// imported from the blog collection by scripts/seo/import-blogs.py.
import React from 'react'
import { ArrowRight, BookOpen, CalendarCheck, Clock, Download, ExternalLink, Menu, Sparkles, UserCheck } from 'lucide-react'
import Logo from '../../components/Logo.jsx'
import Footer from '../../components/landing/Footer.jsx'
import { LINKS } from '../../components/landing/LandingNavbar.jsx'

const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const minutes = (words) => Math.max(1, Math.ceil(words / 220))

/** The landing navbar without React state: the phone menu is a <details>, so it works without JavaScript. */
function StaticNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100/80 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={`text-sm font-semibold transition hover:text-violet-600 ${l.href === '/blog' ? 'text-violet-600' : 'text-slate-600'}`}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <a href="/login" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Sign in</a>
          <a href="/signup" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700">Start free</a>
        </div>
        <details className="group relative md:hidden">
          <summary className="list-none rounded-lg border border-slate-200 p-2 [&::-webkit-details-marker]:hidden" aria-label="Menu">
            <Menu size={18} />
          </summary>
          <div className="absolute right-0 top-12 w-64 space-y-1 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="block rounded-md px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">{l.label}</a>
            ))}
            <div className="flex gap-2 pt-2">
              <a href="/login" className="flex-1 rounded-xl border border-slate-200 py-2 text-center text-sm font-bold text-slate-700">Sign in</a>
              <a href="/signup" className="flex-1 rounded-xl bg-violet-600 py-2 text-center text-sm font-bold text-white">Start free</a>
            </div>
          </div>
        </details>
      </div>
    </header>
  )
}

function Crumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map(([label, href], i) => (
          <li key={label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {href ? <a href={href} className="font-semibold hover:text-violet-700">{label}</a> : <span className="text-slate-700">{label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-white">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <StaticNavbar />
      <main id="content">{children}</main>
      <Footer />
    </div>
  )
}

/** One article. `related` are the posts it links to under "Continue reading". */
export function BlogPostPage({ post, related }) {
  const toc = [...post.headings, { id: 'faq', text: 'Frequently asked questions' }, { id: 'sources', text: 'Official sources' }]
  return (
    <Shell>
      <article>
        <header className="relative overflow-hidden border-b border-slate-100">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-50 via-fuchsia-50/30 to-white" />
          <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
            <Crumbs items={[['Home', '/'], ['Guides', '/blog'], [post.cluster, `/blog#${post.clusterKey.toLowerCase()}`]]} />
            <p className="mt-6 text-xs font-bold uppercase tracking-wider text-violet-600">{post.cluster}</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[2.6rem] sm:leading-[1.15]" style={{ textWrap: 'balance' }}>{post.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: post.lede }} />
            <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><UserCheck size={15} /> By the MyFoodLicense team</span>
              <span className="inline-flex items-center gap-1.5"><CalendarCheck size={15} /> Sources checked <time dateTime={post.updated}>{longDate(post.updated)}</time></span>
              <span className="inline-flex items-center gap-1.5"><Clock size={15} /> {minutes(post.words)} min read</span>
            </p>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[240px,minmax(0,1fr)] lg:px-8">
          <nav aria-label="In this guide" className="hidden lg:block">
            <div className="sticky top-24 border-t-2 border-violet-500 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">In this guide</p>
              <ol className="mt-3 space-y-2.5 text-sm">
                {toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-slate-600 hover:text-violet-700">{h.text}</a></li>)}
              </ol>
            </div>
          </nav>

          <div className="min-w-0 max-w-3xl">
            <figure>
              <img src={post.image} alt={post.imageAlt} width="1200" height="630" fetchpriority="high" decoding="async" className="w-full rounded-3xl ring-1 ring-slate-100" />
              <figcaption className="mt-2 text-xs leading-relaxed text-slate-400" dangerouslySetInnerHTML={{ __html: post.caption }} />
            </figure>

            <details className="mt-8 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 lg:hidden">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">In this guide</summary>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                {toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-slate-600">{h.text}</a></li>)}
              </ol>
            </details>

            <div className="blog-prose mt-8" dangerouslySetInnerHTML={{ __html: post.body }} />

            <aside className="relative mt-12 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 p-7 text-white shadow-xl shadow-violet-200/60 sm:p-9">
              <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
              <p className="relative text-2xl font-extrabold">{post.cta.title}</p>
              <p className="relative mt-2 text-white/90" dangerouslySetInnerHTML={{ __html: post.cta.text }} />
              <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
                <a href={`/services/${post.cta.service}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-lg hover:bg-violet-50">
                  {post.cta.serviceName} <ArrowRight size={16} />
                </a>
                <a href="/#home" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/40 hover:bg-white/25">
                  <Sparkles size={16} /> Which licence do I need?
                </a>
              </div>
            </aside>

            <section aria-labelledby="faq" className="mt-12">
              <h2 id="faq" className="text-2xl font-extrabold tracking-tight text-slate-900">Frequently asked questions</h2>
              <div className="mt-5 space-y-3">
                {post.faq.map((f) => (
                  <details key={f.q} open className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <summary className="cursor-pointer list-none font-bold text-slate-800 [&::-webkit-details-marker]:hidden">{f.q}</summary>
                    <p className="mt-3 text-[15px] leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: f.a }} />
                  </details>
                ))}
              </div>
            </section>

            <section aria-labelledby="sources" className="mt-12">
              <h2 id="sources" className="text-2xl font-extrabold tracking-tight text-slate-900">Official sources and further reading</h2>
              <p className="mt-3 text-sm text-slate-500">Checked on {longDate(post.updated)}. Gazette notifications and operative directions prevail over compilations and summaries, including this guide.</p>
              <ol className="mt-4 space-y-3 text-sm">
                {post.sources.map((s) => (
                  <li key={s.url} className="flex gap-2 text-slate-600">
                    <ExternalLink size={15} className="mt-0.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 [overflow-wrap:anywhere]"><a href={s.url} rel="noopener" className="font-semibold text-violet-700 underline decoration-violet-200 underline-offset-2 hover:decoration-violet-500">{s.title}</a>: {s.use}</span>
                  </li>
                ))}
              </ol>
              {post.checklist && (
                <a href={post.checklist} download className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50">
                  <Download size={16} /> Download the preparation checklist
                </a>
              )}
            </section>

            {related.length > 0 && (
              <nav aria-labelledby="related" className="mt-12 border-t border-slate-100 pt-8">
                <h2 id="related" className="text-lg font-extrabold text-slate-900">Continue reading</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <a href={`/blog/${r.slug}`} className="flex h-full items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 hover:bg-violet-50 hover:text-violet-700">
                        <BookOpen size={17} className="mt-0.5 shrink-0 text-violet-500" /> {r.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <p className="mt-10 border-t border-slate-100 pt-6 text-xs leading-relaxed text-slate-400">
              This guide is general information, not legal advice; the right route depends on your product and business facts.
              Examples marked hypothetical are illustrations, not client cases. MyFoodLicense is an independent consultancy and is
              not affiliated with FSSAI; applications are decided by the competent authority on the official FoSCoS portal.
            </p>
          </div>
        </div>
      </article>
    </Shell>
  )
}

/** /blog: every guide, grouped by topic, pillar guide first. */
export function BlogIndexPage({ posts, updated }) {
  const groups = []
  for (const p of posts) {
    let g = groups.find((x) => x.key === p.clusterKey)
    if (!g) groups.push((g = { key: p.clusterKey, title: p.cluster, posts: [] }))
    g.posts.push(p)
  }
  return (
    <Shell>
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-50 via-fuchsia-50/40 to-white" />
        <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
          <Crumbs items={[['Home', '/'], ['Guides', null]]} />
          <p className="mt-8 text-sm font-bold uppercase tracking-wider text-violet-600">Free FSSAI guides</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl" style={{ textWrap: 'balance' }}>
            FSSAI licensing, labelling and compliance, explained
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            {posts.length} practical guides for food businesses in India: which licence you need, what goes on your label, which claims
            you can make, and what to do when the regulator writes to you. Every guide links to the official sources, checked on {longDate(updated)}.
          </p>
          <nav aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
            {groups.map((g) => (
              <a key={g.key} href={`#${g.key.toLowerCase()}`} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-violet-700 hover:ring-violet-200">
                {g.title} <span className="font-semibold text-slate-400">{g.posts.length}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6 lg:px-8">
        {groups.map((g) => {
          const pillar = g.posts.find((p) => p.pillar)
          const rest = g.posts.filter((p) => p !== pillar)
          return (
            <section key={g.key} id={g.key.toLowerCase()} aria-labelledby={`h-${g.key}`} className="scroll-mt-24">
              <h2 id={`h-${g.key}`} className="text-2xl font-extrabold tracking-tight text-slate-900">{g.title}</h2>
              {pillar && (
                <a href={`/blog/${pillar.slug}`} className="group mt-5 grid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 transition hover:shadow-xl hover:shadow-slate-200/70 md:grid-cols-[1.1fr,1fr]">
                  <img src={pillar.image} alt="" width="1200" height="630" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <div className="flex flex-col p-6 sm:p-8">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-600">Complete guide</span>
                    <span className="mt-2 text-xl font-extrabold leading-snug text-slate-900 group-hover:text-violet-700">{pillar.title}</span>
                    <span className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{pillar.description}</span>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-violet-600 group-hover:gap-2">Read the guide <ArrowRight size={15} /></span>
                  </div>
                </a>
              )}
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <li key={p.slug}>
                    <a href={`/blog/${p.slug}`} className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/70">
                      <span className="font-extrabold leading-snug text-slate-900 group-hover:text-violet-700">{p.title}</span>
                      <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{p.description}</span>
                      <span className="mt-4 text-xs font-semibold text-slate-400">{minutes(p.words)} min read</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Shell>
  )
}
