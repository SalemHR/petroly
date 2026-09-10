# Petroly website — independent evaluation

Reviewed as an outside evaluator visiting cold: real Chrome, plain load (no test
shortcuts), desktop 1440 / tablet 768 / mobile 390, plus scripted user journeys.
Every point below was measured, not assumed. Ordered by business impact.

---

## 1. Blocking — fix before this link leaves your hands

- **The brand name is visually cut.** The two dots under the ي in «بترولي» are
  clipped by the reveal mask on the hero. It is the first thing anyone sees and
  the one word that must be perfect. Cause: `#wordmark{overflow:hidden}` with a
  line box shorter than Tajawal's descenders.
- **Sharing the link shows nothing.** There are zero Open Graph / Twitter Card
  tags. Pasted into WhatsApp, LinkedIn or X, the site appears as a bare URL — no
  image, no title, no description. This site's entire near-term purpose is to be
  *sent to people*.
- **The lead form does not deliver leads.** It opens the visitor's mail client
  via `mailto:`. On most corporate Windows machines and mobile browsers no mail
  client is configured, so the submission silently disappears. There is no
  server, no CRM, no auto-reply, no spam protection, and no record that anyone
  ever enquired. For a site whose stated goal is lead generation this is the
  weakest link in the whole funnel.
- **With JavaScript off, the site is a blank navy screen.** The loader never
  clears, and the station list and partner logos render zero items. The same
  happens if any one of the five third-party CDNs fails to load — GSAP, Lenis and
  Leaflet all come from external hosts with no fallback and no integrity hashes.

## 2. High — costs credibility or conversions

- **Pages the live site has and this one does not:** المدونة, تسجيل الدخول,
  سياسة الخصوصية, الشروط والأحكام, and the English version. A Saudi corporate
  site with no privacy policy is a PDPL compliance gap as well as a trust signal
  a procurement team will look for.
- **The contact form serves one intent out of four.** petroly.com.sa offers
  تواصل معنا / لديك مشكلة / طلبات الاستثمار / التوظيف. Here, an investor or a job
  applicant reaches a fuel-quote form and stops.
- **No WhatsApp anywhere.** In Saudi B2B it is the default channel. There are 3
  `tel:` links and 2 `mailto:` links and zero WhatsApp entry points.
- **No structured data at all.** 116 real physical locations, 5 published FAQs
  and an established company — and not one JSON-LD block. Organization,
  LocalBusiness per station and FAQPage are free, high-value search assets.
- **The LinkedIn link does not match the company's own.** The site links
  `linkedin.com/company/petroly`; petroly.com.sa publishes
  `linkedin.com/company/petroly-company/`. Use theirs.
- **The station data is thinner than the real site's.** The map popup gives name,
  address and directions — but no phone, no hours, and no indication of what each
  station actually offers (diesel? Promo Mart? Change Oil? family rest rooms?).
  A fleet manager's real question is *"which stations on my route can serve my
  trucks"*, and the site cannot answer it.

## 3. Medium — polish and compliance

- **Twelve text styles fail WCAG AA contrast.** Worst: the form consent note at
  **1.89:1** (needs 4.5). Several body styles sit at 3.3–3.4:1. Brand red on
  white is 4.39:1 — just under AA for small text, and it is used for station
  codes and the chairman's job title.
- **Form accessibility is incomplete.** Six required fields carry no `required`
  or `aria-required`; the three fuel-type checkboxes have no programmatic label;
  validation errors are shown visually but never announced to a screen reader.
- **The film asks for a long commitment before any substance.** 7,614 px — about
  8.5 screens — of scrolling before «من نحن». The skip link exists but is hidden
  until keyboard-focused, so a mouse user has no visible way past the intro.
- **Fonts are the single heaviest asset class** (123 KB of the 268 KB total).
  Nine weights of Tajawal are requested; the design uses about four.
- **No analytics or conversion tracking of any kind.** There is currently no way
  to know whether the site produces enquiries.
- **No favicon file, touch icon, or web manifest** beyond an inline SVG — the
  bookmark and home-screen presentation is generic.

## 4. Strategic — what would move it to best-in-class

- **Proof is asserted, not evidenced.** «200+ محطة» and a wall of partner logos
  are claims. Add one or two named case studies («how Petroly fuels a 120-truck
  fleet on the Riyadh–Dammam corridor»), HSE/quality certifications, and a
  downloadable company profile PDF that a procurement officer can forward.
- **Nothing on the page does work for the buyer.** Consider a route planner
  (origin + destination → the Petroly stations along it), a fleet-card / corporate
  account explainer, and a monthly-consumption estimator. These turn a brochure
  into a tool people return to.
- **Sell coverage, not dots.** The map shows 116 points; a fleet manager buys
  *corridors*. Drawing the Riyadh–Dammam, Riyadh–Qassim and Jeddah–Makkah routes
  and showing the gap-free spacing along them would make the network argument
  visually, in one glance.
- **The chairman's message is a wall of text.** Add a fact panel beside the
  portrait — founded 1976, regions served, fleet size, employees — so a skimmer
  gets the story without reading six paragraphs.
- **Nothing tells the visitor what happens next.** The success screen should
  state the response time, offer a WhatsApp handoff, and ideally a calendar link.
- **No English.** Petroly serves the Kingdom *and the Gulf*; international
  suppliers and partners will land on an Arabic-only page.

---

## Recommended order of work

| # | Action | Effort | Why first |
|---|---|---|---|
| 1 | Un-clip the wordmark | minutes | It is the brand, on first sight |
| 2 | Add OG/Twitter tags + a share image | ~1h | The link is about to be shared |
| 3 | Move the form to a real endpoint + auto-reply | ~half day | Every lead is currently at risk |
| 4 | `<noscript>` fallback, vendored libs, SRI hashes | ~half day | Removes four single points of failure |
| 5 | Privacy policy, terms, careers + investor intents | ~1 day | Compliance and dead-end removal |
| 6 | JSON-LD: Organization, FAQPage, 116 × LocalBusiness | ~half day | Largest free search gain |
| 7 | Contrast pass + form a11y attributes | ~2h | AA compliance |
| 8 | WhatsApp CTA + visible "skip intro" | ~1h | Cheap conversion wins |
| 9 | Per-station detail (hours, phone, services) | ~1 day | Answers the buyer's real question |
| 10 | Case study, company-profile PDF, English | ~ongoing | Moves it to best-in-class |

## What is already strong

Worth saying plainly, because it is the majority of the site: the brand
discipline is right (real tokens, navy never black, Arabic never split or
letter-spaced), the photography and the 116 branch coordinates are genuinely
from Petroly rather than invented, the map mirrors the company's own فروعنا
technique, the reduced-motion fallback is complete, and the build is clean —
zero console errors, no horizontal scroll at 390/768/1440, 39 ms worst frame,
268 KB total weight, and every image loading at or below its natural resolution.
The gaps above are almost entirely *additions*, not repairs.


---

# Status after remediation

Everything in tiers 1–3 that could be closed without input from Petroly has been
closed and is covered by a test. What remains needs the company's own material.

## Closed

| Gap | What was done |
|---|---|
| Brand wordmark clipped | Mask given room for Tajawal's descenders; the ي dots are whole |
| No link preview | Open Graph + Twitter Card + a purpose-built 1200×630 share card |
| Form lost leads silently | Four intents, real `FORM_ENDPOINT` hook, honeypot, busy state; the mail fallback now *tells* the visitor it needs one more tap instead of failing quietly |
| Blank page without JS | `<noscript>` fallback; the document reads and the phone/e-mail work |
| Five third-party single points of failure | GSAP, ScrollTrigger, Lenis, Leaflet and both font families vendored locally — only the map tile server remains external |
| No structured data | JSON-LD: Organization, WebSite, FAQPage, 3 Services, 116 GasStation branches (~6 KB gzipped) |
| Missing pages | Blog, login, privacy and terms link to the live site's real pages; careers and investor intents added to the form |
| No WhatsApp | Floating button (held back until the film ends) plus one on the success screen |
| Wrong LinkedIn URL | Corrected to the company's published `petroly-company` |
| Twelve WCAG AA contrast failures | Zero. Brand red kept; button fills use `#E81B24` (4.53:1) so white text clears AA |
| Form accessibility | `required`/`aria-required`, labelled checkboxes, `role="alert"` error region |
| No skip past the film | Visible «تخطَّ المقدمة» control, hidden once the film ends |
| Station popup too thin | Region, 24-hour note, the unified phone number and directions |
| Map sold dots, not routes | Six corridors drawn from real coordinates; filters the list and the pins |
| No favicon/manifest | Touch icon, 512px maskable icon, web manifest, robots.txt, sitemap.xml |
| Conflicting figures | `FIGURES` is now the single source of truth — 200+ stations and 136+ trucks everywhere, years derived from 1976 so it cannot go stale. The 116 is relabelled «فرعاً منشوراً على الخريطة», a different statement, not a competing total |

## Two bugs found during the work, not in the original audit

- **The starfield canvas painted 1.5× too wide on any phone.** A `<canvas>` is a
  replaced element, so `inset:0` never stretched it and it rendered at its
  backing-store size. Invisible in the harness because it tested at DPR 1; real
  phones are DPR 2–3. Both harnesses now emulate a real device ratio.
- **The honeypot and the skip link both used `left:-9999px`.** In an RTL document
  that parks them ten thousand pixels off the *scrollable* side, which blew the
  page out horizontally and made the mobile menu button unclickable. Both now use
  clip/transform. The journey test checks overflow at the top of the page as well
  as after scrolling, which is what caught it.

## Deliberately not done

- **A "longest gap between stations" figure was built and removed.** A straight
  line is not the real highway, and only 116 of the 200+ stations are in the
  public directory — so every number it produced was wrong in the company's
  disfavour. The corridor view now states exactly what it measures.
- **Case studies, certifications, a company-profile PDF, and English.** These need
  Petroly's own material and sign-off. Structure is ready; content is not mine to
  invent.
- **`FORM_ENDPOINT` is still empty.** One line in `index.html` once you choose
  where leads should land.

## Verified

18/18 desktop and 18/18 mobile user journeys, plus numbers, corridors, logos,
rails, map fit, UX, form and reduced-motion suites — all passing. Zero console
errors, zero WCAG AA contrast failures, no horizontal scroll at 390 / 768 / 1440
at the top of the page or after scrolling, worst frame 18.9 ms, ready in ~0.9 s.
