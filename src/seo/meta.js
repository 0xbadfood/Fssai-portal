// Search metadata for every page: title, description, canonical URL, robots and JSON-LD. The same objects are
// written into the prerendered HTML at build time (scripts/seo/prerender.mjs) and applied to <head> when the app
// navigates (useMeta). Canonical URLs always use the canonical host, whichever host served the page.
import { BRAND_DOMAIN, BRAND_NAME } from '../lib/brand.js'

export const SITE_URL = `https://${BRAND_DOMAIN}`
const ORG_ID = `${SITE_URL}/#organization`
const DEFAULT_IMAGE = '/og-default.png'

const abs = (path) => (/^https?:/.test(path) ? path : SITE_URL + path)
/** Cut at a word boundary to fit a search snippet (~155 characters). */
export const snippet = (text, max = 155) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/[\s,;:.–-]+\S*$/, '')}…`
}
/** "Title | MyFoodLicense", unless the title alone is already as long as a results page shows. */
const withBrand = (title) => (title.length <= 52 ? `${title} | ${BRAND_NAME}` : title)

export const organization = () => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: BRAND_NAME,
  alternateName: BRAND_DOMAIN,
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: abs('/logo-512.png'), width: 512, height: 512 },
  description: 'Independent FSSAI compliance consultancy: food business registration and licensing, label and claims review, product classification, imports and authority matters. Not affiliated with FSSAI.',
  areaServed: { '@type': 'Country', name: 'India' },
  knowsAbout: ['FSSAI registration', 'FSSAI licence', 'FoSCoS', 'Food labelling regulations', 'Nutraceutical regulations', 'Food import clearance'],
})

const breadcrumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
})

const faqPage = (path, faqs) => ({
  '@type': 'FAQPage',
  '@id': `${abs(path)}#faq`,
  mainEntity: faqs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
})

export function homeMeta(faqs) {
  return {
    title: `FSSAI Registration & Food Licence Online | ${BRAND_NAME}`,
    description: 'Get your FSSAI registration, State or Central food licence with expert help. Find the right licence in a few taps, upload two photos, and we prepare and file it with you on FoSCoS.',
    path: '/',
    jsonLd: [
      organization(),
      { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: BRAND_NAME, inLanguage: 'en-IN', publisher: { '@id': ORG_ID } },
      faqPage('/', faqs),
    ],
  }
}

export function servicesMeta() {
  return {
    title: `FSSAI Consultant Services: Licences, Labels, Claims & Imports | ${BRAND_NAME}`,
    description: 'Fixed-fee FSSAI expert services: licence filing and modification, label and artwork review, claims, nutraceutical classification, import clearance, notices and inspections.',
    path: '/services',
    jsonLd: [breadcrumbs([['Home', '/'], ['Expert services', '/services']])],
  }
}

export function serviceMeta(cat, { svc, section }) {
  const path = `/services/${svc.id}`
  const price = svc.price
  const offer = price.type === 'quote' ? null : {
    '@type': 'Offer',
    priceCurrency: 'INR',
    price: price.amount,
    url: abs(path),
    availability: 'https://schema.org/InStock',
    ...(price.type === 'fixed' ? {} : {
      priceSpecification: {
        '@type': 'UnitPriceSpecification', priceCurrency: 'INR', minPrice: price.amount,
        ...(price.max ? { maxPrice: price.max } : {}),
        ...(price.unit || price.type === 'monthly' ? { unitText: price.unit || 'month' } : {}),
        valueAddedTaxIncluded: false,
      },
    }),
  }
  return {
    title: withBrand(`${svc.name}: FSSAI Expert Service`),
    description: snippet(`${svc.summary} ${svc.scope}.`),
    path,
    jsonLd: [
      {
        '@type': 'Service',
        '@id': `${abs(path)}#service`,
        name: svc.name,
        serviceType: section.title,
        description: svc.summary,
        provider: { '@id': ORG_ID },
        areaServed: { '@type': 'Country', name: 'India' },
        url: abs(path),
        ...(offer ? { offers: offer } : {}),
      },
      organization(),
      breadcrumbs([['Home', '/'], ['Expert services', '/services'], [svc.name, path]]),
    ],
  }
}

export function blogIndexMeta(count) {
  return {
    title: `FSSAI Guides: Licences, Labelling, Claims & Imports | ${BRAND_NAME}`,
    description: `${count} practical guides to FSSAI registration and licensing, food labels, claims, nutraceuticals, imports and inspections in India, checked against the 2026 rules.`,
    path: '/blog',
    jsonLd: [
      { '@type': 'Blog', '@id': `${SITE_URL}/blog#blog`, name: `${BRAND_NAME} FSSAI guides`, url: abs('/blog'), inLanguage: 'en-IN', publisher: { '@id': ORG_ID } },
      organization(),
      breadcrumbs([['Home', '/'], ['Guides', '/blog']]),
    ],
  }
}

export function blogPostMeta(post) {
  const path = `/blog/${post.slug}`
  return {
    title: withBrand(post.title),
    description: snippet(post.description),
    path,
    type: 'article',
    image: post.ogImage,
    modified: post.updated,
    section: post.cluster,
    jsonLd: [
      {
        '@type': 'BlogPosting',
        '@id': `${abs(path)}#article`,
        headline: post.title.length > 110 ? snippet(post.title, 110) : post.title,
        description: post.description,
        mainEntityOfPage: abs(path),
        datePublished: post.updated,
        dateModified: post.updated,
        inLanguage: 'en-IN',
        wordCount: post.words,
        articleSection: post.cluster,
        keywords: post.keyword,
        image: [abs(post.ogImage), abs(post.image)],
        author: { '@id': ORG_ID },
        publisher: { '@id': ORG_ID },
        isPartOf: { '@id': `${SITE_URL}/blog#blog` },
        citation: post.sources.map((s) => s.url),
      },
      organization(),
      faqPage(path, post.faq.map(({ q, a }) => ({ q, a: a.replace(/<[^>]+>/g, '') }))),
      breadcrumbs([['Home', '/'], ['Guides', '/blog'], [post.title, path]]),
    ],
  }
}

/** Sign-in, sign-up, the dashboard and the ops console: never indexed. */
export const privateMeta = (title, path) => ({ title: `${title} | ${BRAND_NAME}`, description: '', path, robots: 'noindex, nofollow' })

export const notFoundMeta = () => ({ title: `Page not found | ${BRAND_NAME}`, description: '', path: null, robots: 'noindex' })

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The <head> tags for a page, each marked data-seo so the app can swap them on navigation. */
export function renderHead(meta) {
  const url = meta.path ? abs(meta.path) : null
  const image = abs(meta.image || DEFAULT_IMAGE)
  const tags = [
    `<title data-seo>${esc(meta.title)}</title>`,
    meta.description && `<meta data-seo name="description" content="${esc(meta.description)}">`,
    `<meta data-seo name="robots" content="${meta.robots || 'index, follow, max-image-preview:large, max-snippet:-1'}">`,
    url && `<link data-seo rel="canonical" href="${esc(url)}">`,
    `<meta data-seo property="og:site_name" content="${BRAND_NAME}">`,
    `<meta data-seo property="og:locale" content="en_IN">`,
    `<meta data-seo property="og:type" content="${meta.type || 'website'}">`,
    `<meta data-seo property="og:title" content="${esc(meta.title)}">`,
    meta.description && `<meta data-seo property="og:description" content="${esc(meta.description)}">`,
    url && `<meta data-seo property="og:url" content="${esc(url)}">`,
    `<meta data-seo property="og:image" content="${esc(image)}">`,
    `<meta data-seo property="og:image:width" content="1200">`,
    `<meta data-seo property="og:image:height" content="630">`,
    meta.modified && `<meta data-seo property="article:modified_time" content="${meta.modified}">`,
    meta.section && `<meta data-seo property="article:section" content="${esc(meta.section)}">`,
    `<meta data-seo name="twitter:card" content="summary_large_image">`,
    meta.jsonLd?.length && `<script data-seo type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': meta.jsonLd }).replace(/</g, '\\u003c')}</script>`,
  ]
  return tags.filter(Boolean).join('\n    ')
}
