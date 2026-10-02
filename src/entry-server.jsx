// Build-time rendering (vite build --ssr): the public app pages and the blog, as HTML for crawlers and a fast first
// paint. Used by scripts/seo/prerender.mjs and, in dev, by server/seo.js. The browser still renders the app itself
// (main.jsx); the blog pages have no JavaScript at all.
import React from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { primeCatalogue } from './lib/catalogue.js'
import { MetaSink } from './seo/useMeta.js'
import { blogIndexMeta, blogPostMeta, renderHead } from './seo/meta.js'
import { BlogIndexPage, BlogPostPage } from './pages/blog/BlogPages.jsx'

export { renderHead }

/** An app route: { html, meta }. The catalogue makes the services pages render complete. */
export function renderRoute(url, { catalogue }) {
  primeCatalogue(catalogue)
  const sink = {}
  const html = renderToString(
    <MetaSink.Provider value={sink}>
      <StaticRouter location={url}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StaticRouter>
    </MetaSink.Provider>,
  )
  return { html, meta: sink.meta }
}

const statically = (url, page) => renderToStaticMarkup(<StaticRouter location={url}>{page}</StaticRouter>)

export function renderBlogIndex(posts, updated) {
  return { html: statically('/blog', <BlogIndexPage posts={posts} updated={updated} />), meta: blogIndexMeta(posts.length) }
}

export function renderBlogPost(post, posts) {
  const related = post.related.map((slug) => posts.find((p) => p.slug === slug)).filter(Boolean)
  return { html: statically(`/blog/${post.slug}`, <BlogPostPage post={post} related={related} />), meta: blogPostMeta(post) }
}
