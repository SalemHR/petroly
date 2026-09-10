// Expert audit pass: gathers the hard numbers an evaluator would want —
// weight and timing, discoverability metadata, contrast, focus order,
// conversion paths, and the content inventory.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const width = +(process.argv[2] || 1440);

const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width, height: 900 });

  const net = [];
  p.on('response', async r => {
    try {
      const h = r.headers();
      net.push({ url: r.url(), type: r.request().resourceType(),
                 status: r.status(), size: +(h['content-length'] || 0) });
    } catch {}
  });

  const t0 = Date.now();
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  const readyMs = Date.now() - t0;

  // walk the page so lazy assets load, then measure total weight
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 40));
    }
    scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 3000));

  const out = await p.evaluate(() => {
    const meta = n => (document.querySelector(`meta[name="${n}"]`) || {}).content || null;
    const og = n => (document.querySelector(`meta[property="${n}"]`) || {}).content || null;
    const txt = document.body.innerText;
    return {
      seo: {
        title: document.title, titleLen: document.title.length,
        description: meta('description'), descLen: (meta('description') || '').length,
        canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
        ogTitle: og('og:title'), ogImage: og('og:image'), ogDescription: og('og:description'),
        ogType: og('og:type'), ogUrl: og('og:url'), ogLocale: og('og:locale'),
        twitterCard: meta('twitter:card'),
        structuredData: document.querySelectorAll('script[type="application/ld+json"]').length,
        h1Count: document.querySelectorAll('h1').length,
        hreflang: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
        robots: meta('robots'),
      },
      conversion: {
        telLinks: document.querySelectorAll('a[href^="tel:"]').length,
        mailLinks: document.querySelectorAll('a[href^="mailto:"]').length,
        whatsapp: document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp"]').length,
        quoteCtas: [...document.querySelectorAll('a[href="#quote"]')].length,
        formFields: document.querySelectorAll('#qform input,#qform select,#qform textarea').length,
        requiredFields: document.querySelectorAll('#qform .f label span').length,
        formAction: (document.getElementById('qform') || {}).getAttribute
          ? document.getElementById('qform').getAttribute('action') : null,
        submitsVia: 'mailto (client-side)',
      },
      content: {
        words: txt.split(/\s+/).filter(Boolean).length,
        sections: [...document.querySelectorAll('section[id],footer[id]')].map(s => s.id),
        stations: (window.PETROLY_STATIONS || []).length,
        partners: document.querySelectorAll('.pRail:first-child .pCell').length * 2,
        faqs: document.querySelectorAll('.fq').length,
        services: document.querySelectorAll('#services .card').length,
        galleryShots: document.querySelectorAll('#gallery .gShot').length,
        hasBlog: !!document.querySelector('a[href*="blog"]'),
        hasEnglish: !!document.querySelector('a[href*="/en"],a[hreflang="en"]'),
        hasLogin: !!document.querySelector('a[href*="login"]'),
        hasPrivacy: !!document.querySelector('a[href*="privacy"],a[href*="خصوصية"]'),
        hasTerms: !!document.querySelector('a[href*="terms"],a[href*="شروط"]'),
        hasCareers: !!document.querySelector('a[href*="career"],a[href*="توظيف"]'),
      },
      a11y: {
        focusables: document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length,
        positiveTabindex: document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length,
        imagesNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
        landmarks: {
          header: document.querySelectorAll('header').length,
          nav: document.querySelectorAll('nav').length,
          main: document.querySelectorAll('main').length,
          footer: document.querySelectorAll('footer').length,
        },
        ariaLive: document.querySelectorAll('[aria-live]').length,
        formLabels: [...document.querySelectorAll('#qform input,#qform select,#qform textarea')]
          .filter(e => !document.querySelector(`label[for="${e.id}"]`) && !e.getAttribute('aria-label')).length,
      },
      // colour pairs worth checking for contrast
      samples: (() => {
        const pick = (sel, label) => { const e = document.querySelector(sel); if (!e) return null;
          const c = getComputedStyle(e);
          return { label, color: c.color, bg: (function up(el){
            while (el) { const b = getComputedStyle(el).backgroundColor;
              if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b; el = el.parentElement; }
            return 'rgb(255,255,255)'; })(e) };
        };
        return [
          pick('.lede', 'body lede'), pick('.eyebrow', 'eyebrow'),
          pick('#netCount', 'network count'), pick('.st .a', 'station address'),
          pick('.card p', 'service card body'), pick('.fc a', 'footer link'),
          pick('.fBot', 'footer legal'), pick('.wC p', 'why card body'),
          pick('.gShot figcaption', 'gallery caption'), pick('.fnote', 'form note'),
        ].filter(Boolean);
      })(),
    };
  });

  // contrast maths outside the page
  const parse = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  out.contrast = out.samples.map(s => ({
    label: s.label, color: s.color, bg: s.bg,
    ratio: +ratio(parse(s.color), parse(s.bg)).toFixed(2),
  })).sort((a, b) => a.ratio - b.ratio);
  delete out.samples;

  const byType = {};
  let total = 0;
  for (const r of net) {
    if (r.status >= 400) continue;
    byType[r.type] = (byType[r.type] || 0) + r.size;
    total += r.size;
  }
  out.performance = {
    readyMs,
    totalKB: Math.round(total / 1024),
    byTypeKB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)])),
    requests: net.length,
    thirdParty: [...new Set(net.filter(r => !r.url.includes('localhost')).map(r => new URL(r.url).host))],
    heaviest: net.filter(r => r.size > 90000).sort((a, b) => b.size - a.size)
      .slice(0, 8).map(r => `${Math.round(r.size / 1024)}KB ${r.url.split('/').pop().slice(0, 44)}`),
  };

  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
