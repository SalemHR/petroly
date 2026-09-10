// The floating WhatsApp button sits over the page. It must never land on top of
// something a visitor needs to read — the chairman's name, a heading, body copy.
// This walks the page and reports what the button covers at each stop.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const mobile = process.argv.includes('--mobile');

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                             : { width: 1440, height: 900 });
  await p.goto('http://localhost:4791', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1000);

  const box = await p.evaluate(() => {
    const w = document.getElementById('wa'); const r = w.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), label: getComputedStyle(w.querySelector('.lbl')).display };
  });

  const ids = await p.evaluate(() => [...document.querySelectorAll('section[id]')].map(s => s.id));
  const hits = [];
  for (const id of ids) {
    await p.evaluate(i => { const el = document.getElementById(i); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - 60); }, id);
    await wait(900);
    const covered = await p.evaluate(() => {
      const w = document.getElementById('wa');
      if (!w.classList.contains('on') || w.classList.contains('away')) return [];
      const r = w.getBoundingClientRect();
      const out = new Set();
      // sample the button's own footprint; anything textual under it is a hit
      for (let x = r.left + 6; x < r.right - 6; x += 14) {
        for (let y = r.top + 6; y < r.bottom - 6; y += 14) {
          for (const el of document.elementsFromPoint(x, y)) {
            if (el.id === 'wa' || el.closest('#wa')) continue;
            const t = (el.textContent || '').trim();
            if (!t) break;
            // only leaf-ish text counts
            if (el.children.length === 0 && t.length > 1) {
              // a corner button clipping the tail of a paragraph is what every
              // chat widget does; covering a control or a heading is a defect
              const tag = el.tagName.toLowerCase();
              const grave = !!el.closest('a,button,input,select,textarea,summary,[role="button"]')
                          || /^h[1-4]$/.test(tag);
              out.add((grave ? 'BLOCKS ' : 'grazes ') + tag + ': ' + t.slice(0, 40));
            }
            break;
          }
        }
      }
      return [...out];
    });
    if (covered.length) hits.push({ section: id, covered });
  }

  const blocking = hits.filter(h => h.covered.some(c => c.startsWith('BLOCKS')));
  console.log(JSON.stringify({ viewport: mobile ? 'mobile' : 'desktop', button: box, hits }, null, 1));
  console.log(`\nFAB OVERLAP: ${blocking.length ? 'FAIL — blocks ' + blocking.map(h=>h.section).join(', ')
                                                : 'PASS (no control or heading covered)'}`);
  await b.close();
  process.exit(blocking.length ? 1 : 0);
})();
