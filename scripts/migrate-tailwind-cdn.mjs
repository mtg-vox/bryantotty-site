#!/usr/bin/env node
// One-time migration: swap Tailwind Play CDN for static dist/tailwind.css and tighten CSP.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILES = [
    '404.html', 'about.html', 'blog.html', 'contact.html', 'creative.html',
    'index.html', 'privacy.html', 'projects.html', 'speaking.html',
    'projects/artist-growth-os.html', 'projects/ibm-pureflex.html',
    'projects/nft-solana.html', 'projects/shadowscan-ai.html', 'projects/space-chat.html',
];

const OLD_CSP = `script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline' 'unsafe-eval'`;
const NEW_CSP = `script-src 'self' 'unsafe-inline'`;

// Match the CDN <script> tag and the immediately-following inline tailwind.config block (one-line or multi-line)
const TAILWIND_BLOCK = /[ \t]*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>[\s\S]*?tailwind\.config[\s\S]*?<\/script>\s*/;

const STATIC_CSS_LINK = `    <link rel="stylesheet" href="/dist/tailwind.css">\n`;

let ok = 0, skipped = 0;
for (const rel of FILES) {
    const fp = path.join(ROOT, rel);
    let src = fs.readFileSync(fp, 'utf8');
    const before = src;
    if (src.includes(OLD_CSP)) src = src.replace(OLD_CSP, NEW_CSP);
    if (TAILWIND_BLOCK.test(src)) src = src.replace(TAILWIND_BLOCK, STATIC_CSS_LINK);
    if (src !== before) {
        fs.writeFileSync(fp, src);
        console.log(`updated  ${rel}`);
        ok++;
    } else {
        console.log(`skipped  ${rel} (no match)`);
        skipped++;
    }
}
console.log(`\n${ok} updated, ${skipped} skipped`);
