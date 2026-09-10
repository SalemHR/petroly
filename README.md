# Petroly — scroll-film website

Single-page Arabic (RTL) scroll-film site for شركة بترولي للخدمات البترولية والنقليات.
Everything on it — copy, photography, logos, the 116 branch coordinates — comes from
petroly.com.sa. Nothing is invented.

## Run locally

```
node server.js
```

Then open http://localhost:4791

Keep `assets/` next to `index.html`.

## Files

| Path | Purpose |
|---|---|
| `index.html` | The whole site — HTML, CSS, JS in one file |
| `assets/` | Real Petroly photography, partner logos, branch data |
| `assets/stations.js` | 116 branches: code, name, address, lat, lng, region |
| `assets/src/` | Untouched originals pulled from petroly.com.sa (not shipped) |
| `server.js` | Local static file server (port 4791) |
| `.claude/launch.json` | Dev-server config for the Claude Code browser pane |

## Test harness (needs `npm i puppeteer-core` + Chrome)

| Command | Checks |
|---|---|
| `node journey.js` | Full user journey, desktop — 17 assertions end to end |
| `node journey.js --mobile` | Same journey at 390×844 |
| `node verify.js shots` | Screenshots every film beat + content section |
| `node verify.js shots --mobile` | Same at 390×844 |
| `node verify.js jank` | Per-frame rAF deltas while scrolling the film (target max < 50ms) |
| `node uxtest.js` | FAQ, station search, region filter, map focus, anchor nav, mobile menu |
| `node railtest.js` | Partner rails: seamless loop, no blank frames, no duplicate on screen |
| `node logocheck.js` | Every partner logo fits its card uncropped |
| `node mapfit.js [--mobile]` | Every branch pin sits inside the default map view |
| `node formtest.js` | Quote-form validation (empty / bad input / valid submit) |
| `node rmtest.js` | `prefers-reduced-motion` fallback |
| `node numberstest.js` | No figure is quoted as two different numbers anywhere |
| `node corridortest.js [--mobile]` | Corridor filter drives the list, pins and map line together |
| `node audit.js` / `node audit2.js` | SEO, weight, conversion paths, WCAG AA contrast, form a11y |
| `node coldload.js [w] [h]` | A plain first visit — no `?jump`, no forced refresh |
| `node probe.js "<selector>" [width]` | Ad-hoc geometry + computed-style dump for one element |
| `node shotpartners.js [width]` | Freezes the rails and photographs them across the loop |
| `node ogcard.js` | Re-renders the social share card |

Current state: journey 18/18 desktop and mobile, every suite PASS, jank max
18.9 ms, zero console errors, zero WCAG AA contrast failures, no horizontal
scroll at 390 / 768 / 1440 — checked at the top of the page as well as after
scrolling. See `EVALUATION.md` for the full audit and what remains open.

The mobile harnesses emulate `deviceScaleFactor: 3`. Testing at 1 hid a canvas
that painted 1.5x too wide on every real phone — do not lower it.

## Going live

1. Set `FORM_ENDPOINT` in `index.html` to your form or CRM endpoint. Until it is
   set the form falls back to the visitor's mail client and says so; it never
   pretends a lead was sent.
2. Point the absolute URLs in the `og:`/`canonical`/JSON-LD tags at the real
   domain if it differs from `petroly.com.sa`.
3. `robots.txt` and `sitemap.xml` ship at the root; update the sitemap when more
   pages exist.

## Brand

Colours taken from petroly.com.sa: red `#ED1B24`, blue `#3662AD`, on white.
Dark surfaces are navy (`#0E2244`), derived from the brand blue — never black.
Type: Tajawal for Arabic, Space Grotesk for Latin and all figures.

Arabic is a joining script: never split it per character and never apply negative
letter-spacing. Latin figures inside RTL copy carry `unicode-bidi:isolate` — and
**not** `display:inline-block`, which cannot break across lines and throws numbers
onto lines of their own in narrow columns.

## The station network

`#network` mirrors فروعنا on the live site: a real slippy map with a red pin per
branch, a region filter and a searchable list, each driving the other. Tiles come
from Esri's light-grey canvas with an automatic fall back to OpenStreetMap — no API
key, nothing to configure. Coordinates were read off the live site's own map markers.

## The chairman portrait

`assets/chairman.png` (+ `.webp`) is the supplied photo of سالم بن يسلم بالعبيد with
the event background removed, so the figure is shown whole — head to feet, nothing
cropped — against the site's own blue-to-white ground. The event signage behind the
subject was painted out before the cut-out. Originals are in `assets/src/`.

## Deploy

No build step. Upload `index.html` + `assets/` (you can leave out `assets/src/`) to
any static host. For Vercel: `npm i -g vercel` then `vercel deploy --prod` from this
folder. New Vercel projects sit behind Deployment Protection (a login wall) — make it
public under Project → Settings → Deployment Protection.
