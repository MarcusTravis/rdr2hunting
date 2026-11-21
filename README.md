# RDR2 Hunting Prices

A free, ad-free reference for Red Dead Redemption 2 **story mode** butcher and trapper prices. Unofficial fan site.

## How it works

Plain static files. No framework and no build step. `index.html` loads `app.js`, which fetches `data.json` and draws the cards.

- **Cloudflare Pages:** output directory is the repo root. Leave the build command empty.
- **Local preview:** run `python3 -m http.server` in this folder and open http://localhost:8000. Opening `index.html` straight from disk will not work because the browser blocks `fetch` on `file://`.

## Updating prices

Edit `data.json`. Use `null` for any value that is unknown. Only add a value once it is cross-checked in two sources. The source list is kept in local notes (`notes/SOURCES.md`, git-ignored so it is not published with the site). Update `meta.lastChecked` when you re-check.

## Icons

`python3 tools/make_icons.py` rebuilds `favicon.ico`, `apple-touch-icon.png` and `og-image.png` (needs Pillow). `favicon.svg` is hand-written.

## Before you deploy

- **Analytics token.** `index.html` and `404.html` contain the Cloudflare Web Analytics snippet with `CF_BEACON_TOKEN_PLACEHOLDER`. Replace it with this site's own token.
- **Canonical URL.** The base URL `https://rdr2hunting.pages.dev` is a placeholder project name. If you pick a different name, change it in `index.html`, `404.html`, `sitemap.xml`, `robots.txt` and `_headers`.
