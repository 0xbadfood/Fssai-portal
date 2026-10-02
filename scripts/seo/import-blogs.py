#!/usr/bin/env python3
"""Import the blog collection (~/blogs, built by its own content/*.py) into the portal.

  python3 scripts/seo/import-blogs.py [~/blogs]

Writes
  content/blog/posts.json        every article as data (body HTML with links resolved), read by the build
  src/seo/blogLinks.json         the small part the app needs: pillar guides and guides per service
  public/blog/images/*.svg       the article illustrations
  public/blog/og/*.png           the same illustration as PNG for social previews (needs rsvg-convert and ImageMagick)
  public/blog/checklists/*.txt   the downloadable checklists

The articles are rendered into static pages by `npm run build` (scripts/seo/prerender.mjs). Re-run this after
editing the collection in ~/blogs; edit content there, not in posts.json.
"""
import html
import json
import re
import runpy
import shutil
import subprocess
import sys
from pathlib import Path

PORTAL = Path(__file__).resolve().parents[2]
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '~/blogs').expanduser().resolve()
UPDATED = '2026-10-02'  # the collection's research date ("Sources checked and last updated")


def load_posts():
    sys.path.insert(0, str(SRC / 'content'))
    posts = runpy.run_path(str(SRC / 'content/posts.py'))['POSTS']
    for path in sorted((SRC / 'content').glob('cluster_*.py')):
        posts.extend(runpy.run_path(str(path))['POSTS'])
    return sorted(posts, key=lambda p: (p['plan_id'][0], int(p['plan_id'][1:])))


def text_of(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment))


def main():
    posts = load_posts()
    sources = json.loads((SRC / 'research/source-register.json').read_text())['sources']
    catalogue = json.loads((PORTAL / 'config/services.json').read_text())
    services = {s['id']: s['name'] for sec in catalogue['sections'] for s in sec['services']}
    by_id = {p['plan_id']: p for p in posts}

    def is_pillar(p):
        return p['plan_id'][1:] == '0'

    out = []
    for p in posts:
        body = p['body']
        if is_pillar(p):
            children = [c for c in posts if c['plan_id'][0] == p['plan_id'][0] and c is not p]
            body += ('<h2>Explore the detailed guides</h2><p>Use these focused articles to work through the decisions '
                     'relevant to your business.</p><ul>'
                     + ''.join(f'<li>[[post:{c["plan_id"]}|{c["title"]}]]</li>' for c in children) + '</ul>')
        body = re.sub(r'\[\[source:([^|\]]+)\|([^\]]+)\]\]',
                      lambda m: f'<a class="source-link" href="{html.escape(sources[m[1]]["url"])}" rel="noopener">{html.escape(m[2])}</a>', body)
        body = re.sub(r'\[\[post:([^|\]]+)\|([^\]]+)\]\]',
                      lambda m: f'<a href="/blog/{by_id[m[1]]["slug"]}">{html.escape(m[2])}</a>', body)
        body = body.replace('href="../downloads/', 'href="/blog/checklists/')
        # "explore our <a href="/services/x">x with spaces service</a>": use the catalogue's service name.
        body = re.sub(r'<a href="/services/([a-z0-9-]+)">([^<]*)</a>',
                      lambda m: f'<a href="/services/{m[1]}">{html.escape(services[m[1]]) + " service" if m[2] == m[1].replace("-", " ") + " service" else m[2]}</a>',
                      body)
        # Drafting remarks that only made sense before publication.
        body = body.replace(' No future monthly research or publication is scheduled by this draft.', '')

        headings = []

        def anchor(m):
            title = m.group(1)
            slug = re.sub(r'[^a-z0-9]+', '-', text_of(title).lower()).strip('-')
            headings.append({'id': slug, 'text': text_of(title)})
            return f'<h2 id="{slug}">{title}</h2>'
        body = re.sub(r'<h2>(.*?)</h2>', anchor, body, flags=re.S)

        linked = list(dict.fromkeys(re.findall(r'href="/services/([a-z0-9-]+)"', body) + [p['cta_service']]))
        missing = [s for s in linked if s not in services]
        if missing:
            sys.exit(f'{p["plan_id"]} links to services not in config/services.json: {missing}')
        checklist = re.search(r'href="/blog/checklists/([^"]+)"', body)
        related = list(dict.fromkeys(([p['plan_id'][0] + '0'] if not is_pillar(p) and p['plan_id'][0] + '0' in by_id else []) + p['related']))
        words = len(re.findall(r'\b[\w₹%]+\b', text_of(p['lede'] + ' ' + body + ' ' + ' '.join(q['answer'] for q in p['faq']))))
        out.append({
            'id': p['plan_id'], 'slug': p['slug'], 'cluster': p['cluster'], 'clusterKey': p['plan_id'][0],
            'pillar': is_pillar(p), 'keyword': p['keyword'], 'title': p['title'], 'description': text_of(p['description']),
            'lede': p['lede'], 'body': body, 'headings': headings,
            'faq': [{'q': text_of(q['question']), 'a': q['answer']} for q in p['faq']],
            'sources': [{'title': sources[k]['title'], 'url': sources[k]['url'], 'use': sources[k]['use']} for k in p['sources']],
            'related': [by_id[k]['slug'] for k in related if k in by_id and k != p['plan_id']],
            'image': f'/blog/images/{p["image"]}', 'ogImage': f'/blog/og/{p["image"][:-4]}.png',
            'imageAlt': p['image_alt'], 'caption': p['caption'],
            'cta': {'title': p['cta_title'], 'text': p['cta_text'], 'service': p['cta_service'], 'serviceName': services[p['cta_service']]},
            'checklist': f'/blog/checklists/{checklist[1]}' if checklist else None,
            'services': linked, 'words': words, 'updated': UPDATED,
        })

    (PORTAL / 'content/blog').mkdir(parents=True, exist_ok=True)
    (PORTAL / 'content/blog/posts.json').write_text(json.dumps({'updated': UPDATED, 'posts': out}, ensure_ascii=False, indent=1) + '\n')

    # The app's share: pillar guides for the landing page, guides per service for the service pages.
    by_service = {}
    for p in out:
        for s in p['services']:
            by_service.setdefault(s, []).append({'slug': p['slug'], 'title': p['title']})
    links = {
        'pillars': [{'slug': p['slug'], 'title': p['title'], 'cluster': p['cluster']} for p in out if p['pillar']],
        'byService': {k: v[:4] for k, v in sorted(by_service.items())},
    }
    (PORTAL / 'src/seo').mkdir(parents=True, exist_ok=True)
    (PORTAL / 'src/seo/blogLinks.json').write_text(json.dumps(links, ensure_ascii=False, indent=1) + '\n')

    pub = PORTAL / 'public/blog'
    for d in ('images', 'og', 'checklists'):
        shutil.rmtree(pub / d, ignore_errors=True)
        (pub / d).mkdir(parents=True)
    for p in out:
        svg = SRC / 'assets' / p['image'].rsplit('/', 1)[1]
        if not (pub / 'images' / svg.name).exists():
            shutil.copy(svg, pub / 'images' / svg.name)
            png = subprocess.run(['rsvg-convert', '-w', '1200', '-h', '630', str(svg)], check=True, capture_output=True).stdout
            subprocess.run(['convert', '-', '-colors', '64', f'PNG8:{pub / "og" / (svg.stem + ".png")}'], input=png, check=True)
        if p['checklist']:
            name = p['checklist'].rsplit('/', 1)[1]
            shutil.copy(SRC / 'downloads' / name, pub / 'checklists' / name)
    print(json.dumps({'posts': len(out), 'words': sum(p['words'] for p in out), 'pillars': len(links['pillars']), 'services_linked': len(by_service)}))


if __name__ == '__main__':
    main()
