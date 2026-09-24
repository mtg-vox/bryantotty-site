#!/usr/bin/env node
// Builds SEO / AI-search artifacts from the HTML pages themselves (single source of truth):
//   sitemap.xml, llms.txt, llms-full.txt, feed.xml, and BreadcrumbList JSON-LD in each page.
// Then validates every indexable page. Exit code 1 on any validation error.
// Usage: node scripts/build-seo.mjs [--check]   (--check = validate only, write nothing)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://bryantotty.com';
const CHECK_ONLY = process.argv.includes('--check');
const CORE = ['index.html', 'about.html', 'projects.html', 'creative.html', 'speaking.html', 'blog.html', 'contact.html', 'privacy.html'];
const SECTIONS = { blog: { name: 'Blog', index: 'blog.html' }, projects: { name: 'Projects', index: 'projects.html' } };
const CORE_NAMES = { 'index.html': 'Home', 'about.html': 'About', 'projects.html': 'Projects', 'creative.html': 'Creative Studio', 'speaking.html': 'Speaking', 'blog.html': 'Blog', 'contact.html': 'Contact', 'privacy.html': 'Privacy Policy' };
const BC_START = '<!-- seo:breadcrumbs -->';
const BC_END = '<!-- /seo:breadcrumbs -->';

const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/&rarr;/g, '→').replace(/&larr;/g, '←').replace(/&rsquo;|&#39;|&#x27;/g, "'").replace(/&lsquo;/g, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/g, '"').replace(/&hellip;/g, '…').replace(/&copy;/g, '©')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, attr, key) => {
  const m = html.match(new RegExp(`<meta[^>]+${attr}="${key}"[^>]+content="([^"]*)"`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attr}="${key}"`, 'i'));
  return m ? decode(m[1]) : null;
};

function gitDate(file) {
  try {
    const d = execSync(`git log -1 --format=%cs -- "${file}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (d) return d;
  } catch { /* not committed yet */ }
  return new Date().toISOString().slice(0, 10);
}

function jsonLdBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch (e) { out.push({ __error: e.message }); }
  }
  return out;
}

// Readable text of the page's main content for llms-full.txt.
function mainText(html) {
  let body = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  body = body
    .replace(/<(script|style|svg|nav|footer|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<img[^>]*alt="([^"]+)"[^>]*>/gi, '\n[Image: $1]\n')
    .replace(/<a[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<h[1-2][^>]*>/gi, '\n\n## ').replace(/<h[3-6][^>]*>/gi, '\n\n### ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|section|figure|figcaption|h\d|li|ul|ol|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decode(body)
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, a) => l && !(l === a[i - 1]))
    .join('\n').replace(/\n(## |### )/g, '\n\n$1').trim();
}

function collectPages() {
  const files = [...CORE];
  for (const dir of Object.keys(SECTIONS)) {
    for (const f of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.html')).sort()) files.push(`${dir}/${f}`);
  }
  return files.map((file) => {
    const html = read(file);
    const section = file.includes('/') ? file.split('/')[0] : null;
    const ld = jsonLdBlocks(html);
    const posting = ld.find((b) => ['BlogPosting', 'Article'].includes(b['@type']));
    const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1].trim());
    const h1 = decode(((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || null;
    const url = file === 'index.html' ? `${SITE}/` : `${SITE}/${file}`;
    return {
      file, html, section, ld, url, canonical, title, h1,
      name: (posting && posting.headline)
        || (meta(html, 'property', 'og:title') || title).replace(/\s+[-|]\s+Bryan Totty$/, '').trim()
        || h1,
      description: meta(html, 'name', 'description'),
      ogImage: meta(html, 'property', 'og:image'),
      published: posting ? posting.datePublished : null,
      modified: gitDate(file),
      noindex: /<meta name="robots" content="[^"]*noindex/i.test(html),
    };
  });
}

function breadcrumbJson(p) {
  const items = [{ name: 'Home', item: `${SITE}/` }];
  if (p.section) items.push({ name: SECTIONS[p.section].name, item: `${SITE}/${SECTIONS[p.section].index}` });
  items.push({ name: CORE_NAMES[p.file] || p.name, item: p.url });
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.item })),
  });
}

function injectBreadcrumbs(p) {
  if (p.file === 'index.html') return p.html;
  const block = `${BC_START}\n    <script type="application/ld+json">${breadcrumbJson(p)}</script>\n    ${BC_END}`;
  let html = p.html;
  if (html.includes(BC_START)) {
    html = html.replace(new RegExp(`${BC_START}[\\s\\S]*?${BC_END}`), block);
  } else {
    // Drop any hand-written BreadcrumbList so there is exactly one.
    html = html.replace(/\s*<script type="application\/ld\+json">\s*\{[^<]*"@type"\s*:\s*"BreadcrumbList"[\s\S]*?<\/script>/g, '');
    html = html.replace('</head>', `    ${block}\n</head>`);
  }
  return html;
}

function ensureFeedLink(html) {
  if (html.includes('type="application/rss+xml"')) return html;
  return html.replace('</head>', `    <link rel="alternate" type="application/rss+xml" title="Bryan Totty Blog" href="${SITE}/feed.xml">\n</head>`);
}

function validate(pages) {
  const errors = [];
  const titles = new Map();
  for (const p of pages) {
    if (p.noindex) continue;
    const e = (m) => errors.push(`${p.file}: ${m}`);
    if (!p.title) e('missing <title>');
    else if (p.title.length > 70) e(`title is ${p.title.length} chars (keep <= 70)`);
    if (!p.description) e('missing meta description');
    else if (p.description.length < 50 || p.description.length > 170) e(`description is ${p.description.length} chars (50-170)`);
    if (p.canonical !== p.url) e(`canonical ${p.canonical} != ${p.url}`);
    if (!p.h1) e('missing <h1>');
    if ((p.html.match(/<h1[\s>]/gi) || []).length > 1) e('more than one <h1>');
    if (!/<html lang="/.test(p.html)) e('missing <html lang>');
    for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) if (!meta(p.html, 'property', k)) e(`missing ${k}`);
    if (!meta(p.html, 'name', 'twitter:card')) e('missing twitter:card');
    if (p.ogImage && p.ogImage.startsWith(SITE)) {
      const local = p.ogImage.slice(SITE.length + 1).split('?')[0];
      if (!existsSync(join(ROOT, local))) e(`og:image file not found: ${local}`);
    }
    if (p.ld.some((b) => b.__error)) e('invalid JSON-LD');
    if (p.section === 'blog' && !p.ld.some((b) => b['@type'] === 'BlogPosting')) e('blog post missing BlogPosting JSON-LD');
    for (const m of p.html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      if (!/\balt="[^"]*"/.test(tag)) e(`<img> without alt: ${tag.slice(0, 80)}`);
      if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) e(`<img> without width/height: ${tag.slice(0, 80)}`);
      const src = (tag.match(/\bsrc="([^"]+)"/) || [])[1];
      if (src && !/^(https?:|data:)/.test(src)) {
        const local = join(ROOT, p.section && !src.startsWith('/') ? p.section : '', src.replace(/^\//, '')).split('?')[0];
        if (!existsSync(local)) e(`image not found: ${src}`);
      }
    }
    if (titles.has(p.title)) e(`duplicate title with ${titles.get(p.title)}`);
    titles.set(p.title, p.file);
  }
  return errors;
}

function buildSitemap(pages) {
  const prio = (p) => (p.file === 'index.html' ? '1.0' : !p.section ? '0.8' : '0.6');
  const urls = pages.filter((p) => !p.noindex).map((p) =>
    `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${p.modified}</lastmod>\n    <priority>${prio(p)}</priority>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const byDateDesc = (a, b) => (b.published || b.modified).localeCompare(a.published || a.modified);
const line = (p) => `- [${CORE_NAMES[p.file] || p.name}](${p.url})${p.published ? ` (${p.published})` : ''}: ${p.description}`;

function buildLlms(pages, intro) {
  const core = pages.filter((p) => !p.section && !p.noindex);
  const blog = pages.filter((p) => p.section === 'blog').sort(byDateDesc);
  const projects = pages.filter((p) => p.section === 'projects');
  const [h1, ...rest] = intro.trim().split('\n');
  return [
    h1,
    '',
    '> Personal website of Bryan Totty: Cloud Security Engineer at Microsoft (Azure), AI security automation builder, speaker, trader, and independent recording artist (RED T7GER). The full text of every page is at https://bryantotty.com/llms-full.txt',
    '',
    rest.join('\n').trim(),
    '',
    '## Key Pages',
    ...core.map(line),
    '',
    '## Blog Posts',
    ...blog.map(line),
    '',
    '## Projects',
    ...projects.map(line),
    '',
    '## Optional',
    `- [Full site text for LLMs](${SITE}/llms-full.txt): every page's content as plain text`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    `- [RSS feed](${SITE}/feed.xml)`,
    '',
  ].join('\n');
}

function buildLlmsFull(pages) {
  const order = [...pages.filter((p) => !p.section), ...pages.filter((p) => p.section === 'blog').sort(byDateDesc), ...pages.filter((p) => p.section === 'projects')]
    .filter((p) => !p.noindex && p.file !== 'privacy.html');
  const parts = order.map((p) => [
    `# ${p.name}`, '', `URL: ${p.url}`, p.published ? `Published: ${p.published}` : null, `Updated: ${p.modified}`,
    `Summary: ${p.description}`, '', mainText(p.html),
  ].filter((x) => x !== null).join('\n'));
  return `# Bryan Totty - bryantotty.com (full text)\n\n> Plain-text copy of every public page on bryantotty.com, generated from the site HTML. Author: Bryan Totty. Views are his own.\n\n---\n\n${parts.join('\n\n---\n\n')}\n`;
}

function buildFeed(pages) {
  const posts = pages.filter((p) => p.section === 'blog').sort(byDateDesc);
  const rfc = (d) => new Date(`${d}T12:00:00Z`).toUTCString();
  const items = posts.map((p) => `    <item>
      <title>${esc(p.name)}</title>
      <link>${p.url}</link>
      <guid isPermaLink="true">${p.url}</guid>
      <pubDate>${rfc(p.published || p.modified)}</pubDate>
      <description>${esc(p.description || '')}</description>
      <author>noreply@bryantotty.com (Bryan Totty)</author>
    </item>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Bryan Totty Blog</title>
    <link>${SITE}/blog.html</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Field notes on cloud security, AI, crypto, business, and gear from Bryan Totty.</description>
    <language>en-us</language>
    <lastBuildDate>${rfc(posts[0] ? (posts[0].published || posts[0].modified) : new Date().toISOString().slice(0, 10))}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;
}

// ---- run ----
let pages = collectPages();
if (!CHECK_ONLY) {
  for (const p of pages) {
    let html = injectBreadcrumbs(p);
    if (p.section === 'blog' || p.file === 'blog.html') html = ensureFeedLink(html);
    if (html !== p.html) writeFileSync(join(ROOT, p.file), html);
  }
  pages = collectPages();
}
const errors = validate(pages);
if (!CHECK_ONLY) {
  writeFileSync(join(ROOT, 'sitemap.xml'), buildSitemap(pages));
  writeFileSync(join(ROOT, 'llms.txt'), buildLlms(pages, read('seo/llms-intro.md')));
  writeFileSync(join(ROOT, 'llms-full.txt'), buildLlmsFull(pages));
  writeFileSync(join(ROOT, 'feed.xml'), buildFeed(pages));
  console.log(`Wrote sitemap.xml, llms.txt, llms-full.txt, feed.xml for ${pages.length} pages.`);
}
if (errors.length) {
  console.error(`\n${errors.length} SEO issue(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('SEO checks passed.');
