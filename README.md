# bryantotty.com

Source for [bryantotty.com](https://bryantotty.com) — the personal website of Bryan Totty.

A portfolio and hub covering technology (cloud security engineering), markets (trading and investing), creative work (music, fashion, and brand building), and speaking engagements.

## SEO and AI search

Run `npm run seo` after adding or editing any page. It reads the HTML pages and regenerates
`sitemap.xml`, `llms.txt`, `llms-full.txt`, `feed.xml`, and breadcrumb JSON-LD, then fails if any
page is missing a title, description, canonical, Open Graph tags, valid JSON-LD, or image alt/size.
Edit the `llms.txt` bio in `seo/llms-intro.md`; do not edit generated files by hand.
