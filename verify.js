// Verification harness — real Chrome, no preview-pane throttling.
//   node verify.js shots            screenshot every beat + junction
//   node verify.js jank             per-frame rAF deltas while scrolling the film
//   node verify.js shots --mobile   same beats at 390x844
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4791';
const OUT = path.join(__dirname, 'shots');

const mode = process.argv[2] || 'shots';
const mobile = process.argv.includes('--mobile');
// real phones are DPR 2-3; testing at 1 hid a canvas that painted 1.5x too wide
const VP = mobile ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                  : { width: 1440, height: 900, deviceScaleFactor: 1 };

// film scroll range = 820vh - 100vh = 7.2 * viewport height
const filmRange = () => 7.2 * VP.height;
const at = p => Math.round(p * filmRange());

const BEATS = [
  ['01-hero',        at(0.00)],
  ['02-road',        at(0.11)],
  ['03-dawn',        at(0.22)],
  ['04-junction-23', at(0.31)],
  ['05-stats',       at(0.40)],
  ['06-junction-34', at(0.49)],
  ['07-map',         at(0.58)],
  ['08-network-run', at(0.67)],
  ['09-station',     at(0.79)],
  ['10-resolve',     at(0.93)],
  ['11-seam',        at(1.00)],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1',
           '--hide-scrollbars', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport(VP);

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => {
    const t = ((r.failure() || {}).errorText) || '';
    // aborted map tiles are the harness navigating away mid-fetch, not a fault
    if (t.includes('ERR_ABORTED')) return;
    errors.push('reqfail: ' + r.url() + ' ' + t);
  });

  const ready = async url => {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForFunction('window.__ready === true', { timeout: 25000 });
    await new Promise(r => setTimeout(r, 700));   // let scrub settle
  };

  if (mode === 'jank') {
    await ready(`${BASE}/`);
    const samples = await page.evaluate(async () => {
      const d = [];
      let last = performance.now();
      const total = 6000, step = 26;
      const tick = () => {
        const n = performance.now();
        d.push([n - last, window.scrollY]);
        last = n;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const end = document.getElementById('film').offsetHeight - innerHeight;
      const t0 = performance.now();
      while (performance.now() - t0 < total) {
        const p = (performance.now() - t0) / total;
        scrollTo(0, p * end);
        await new Promise(r => setTimeout(r, step));
      }
      return { d, end };
    });
    const { d, end } = samples;
    const deltas = d.map(x => x[0]).slice().sort((a, b) => a - b);
    const q = f => deltas[Math.floor(deltas.length * f)];
    const worst = d.slice().sort((a, b) => b[0] - a[0]).slice(0, 6)
      .map(([ms, y]) => `${ms.toFixed(0)}ms @ y=${y} (film p=${(y / end).toFixed(2)})`);
    console.log(JSON.stringify({
      frames: deltas.length,
      p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1),
      p99: +q(0.99).toFixed(1), max: +deltas[deltas.length - 1].toFixed(1),
      verdict: deltas[deltas.length - 1] < 50 ? 'PASS (max < 50ms)' : 'FAIL (max >= 50ms)',
      worstFrames: worst,
    }, null, 2));
  } else {
    const tag = mobile ? '-m' : '';
    for (const [name, y] of BEATS) {
      await ready(`${BASE}/?jump=${y}`);
      const real = await page.evaluate(() => window.scrollY);
      await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`) });
      console.log(`${name}${tag}  asked=${y} got=${real}${real !== y ? '  <-- MISMATCH' : ''}`);
    }
    // content sections
    await ready(`${BASE}/`);
    const marks = await page.evaluate(() => {
      const o = {};
      for (const id of ['about', 'values', 'services', 'chairman', 'vision', 'why', 'band', 'network', 'gallery', 'partners', 'faq', 'quote', 'contact']) {
        const el = document.getElementById(id);
        if (el) o[id] = Math.round(el.getBoundingClientRect().top + window.scrollY);
      }
      return o;
    });
    for (const [id, y] of Object.entries(marks)) {
      await ready(`${BASE}/?jump=${y}`);
      await page.screenshot({ path: path.join(OUT, `20-${id}${tag}.png`) });
      console.log(`20-${id}${tag}  y=${y}`);
    }
  }

  // horizontal-overflow guard: body must never scroll sideways, nothing may
  // stick past the viewport. Catches grid blowouts from min-width:auto.
  await ready(`${BASE}/`);
  const ov = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth, bad = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (getComputedStyle(el).position === 'fixed') return;
      if (r.right > vw + 1.5 || r.left < -1.5) {
        const cls = (typeof el.className === 'string' && el.className.trim())
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} L${Math.round(r.left)} R${Math.round(r.right)}`);
      }
    });
    return { vw, sw: document.documentElement.scrollWidth, bad: [...new Set(bad)].slice(0, 10) };
  });
  console.log(`\noverflow @${VP.width}: scrollWidth=${ov.sw} clientWidth=${ov.vw}` +
    (ov.bad.length ? `\n  OFFENDERS:\n   ${ov.bad.join('\n   ')}` : '  OK'));

  console.log(errors.length ? '\nERRORS:\n' + [...new Set(errors)].join('\n') : '\nno page errors');
  await browser.close();
})();
