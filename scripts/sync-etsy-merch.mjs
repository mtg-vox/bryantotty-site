#!/usr/bin/env node
/**
 * Etsy shop merch sync for the Creative > Shop section of bryantotty.com.
 *
 * Strategy:
 *   - Fetch the public RSS feed from https://www.etsy.com/shop/<SHOP>/rss
 *   - Parse title, price, image, and listing URL for each item
 *   - Download cover images into images/merch/etsy-<id>.jpg
 *   - Write merch.generated.json for the site to read at runtime
 *
 * Why RSS:
 *   - Etsy Mini widgets were discontinued in 2017
 *   - Open API v3 requires app approval
 *   - Headless scraping of the shop page is blocked
 *   - The RSS endpoint is public, stable, and updates automatically
 *
 * Notes:
 *   - This is a build-time / scheduled refresh script, NOT a runtime fetch.
 *     Site CSP does not allow third-party img-src or script-src additions.
 *   - Run: `npm run merch:sync` whenever you add/remove Etsy listings.
 *
 * Adapted from the redt7ger-site sync script.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHOP = 'RedTigerUnlimited';
const RSS_URL = `https://www.etsy.com/shop/${SHOP}/rss`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MERCH_DIR = path.join(ROOT, 'images', 'merch');
const OUT_JSON = path.join(ROOT, 'merch.generated.json');

function decodeHtml(s) {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function tag(s, name) {
    const m = s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return m ? m[1].trim() : '';
}

function cdata(s) {
    return s.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim();
}

function parseRss(xml) {
    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml))) {
        const block = m[1];
        const title = decodeHtml(cdata(tag(block, 'title')))
            .replace(/\s+by\s+RedTigerUnlimited\s*$/i, '')
            .trim();
        const link = decodeHtml(cdata(tag(block, 'link')));
        const desc = decodeHtml(cdata(tag(block, 'description')));
        const idMatch = link.match(/\/listing\/(\d+)/);
        if (!idMatch) continue;
        const id = idMatch[1];
        const imgMatch = desc.match(/<img\s+src="([^"]+)"/i);
        const priceMatch = desc.match(/class="price">([^<]+)</);
        let image = imgMatch ? imgMatch[1] : '';
        if (image) image = image.replace('_570xN', '_1080xN');
        items.push({
            id,
            title,
            href: link.split('?')[0],
            image,
            price: priceMatch ? priceMatch[1].trim() : null,
        });
    }
    return items;
}

async function main() {
    await mkdir(MERCH_DIR, { recursive: true });

    console.log(`[merch:sync] Fetching ${RSS_URL}`);
    const res = await fetch(RSS_URL, {
        headers: { 'User-Agent': 'BryanTottySiteBuild/1.0' },
    });
    if (!res.ok) {
        throw new Error(`RSS fetch failed: ${res.status}`);
    }
    const xml = await res.text();
    const items = parseRss(xml);
    console.log(`[merch:sync] Parsed ${items.length} listings`);

    for (const item of items) {
        if (!item.image) continue;
        const local = `etsy-${item.id}.jpg`;
        const dest = path.join(MERCH_DIR, local);
        try {
            const r = await fetch(item.image);
            if (!r.ok) {
                console.warn(`[merch:sync]   skip ${item.id}: img ${r.status}`);
                continue;
            }
            await pipeline(r.body, createWriteStream(dest));
            item.localImage = `images/merch/${local}`;
            console.log(
                `[merch:sync]   ✓ ${item.id} ${item.price ?? ''}  ${item.title.slice(0, 60)}`,
            );
        } catch (err) {
            console.warn(`[merch:sync]   skip ${item.id}: ${err.message}`);
        }
    }

    const out = {
        shop: SHOP,
        shopUrl: `https://www.etsy.com/shop/${SHOP}`,
        syncedAt: new Date().toISOString(),
        items: items.filter((i) => i.localImage),
    };
    await writeFile(OUT_JSON, JSON.stringify(out, null, 2));
    console.log(`[merch:sync] Wrote ${out.items.length} items → ${OUT_JSON}`);
}

main().catch((err) => {
    console.error('[merch:sync] FAILED', err);
    process.exit(1);
});
