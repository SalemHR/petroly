// The floating button moved to the line-end side; make sure it did not land on
// Leaflet's own furniture (attribution, zoom) at the network section.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let bad = 0;
  for (const m of [false, true]) {
    const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
    const p = await b.newPage();
    await p.setViewport(m ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                          : { width: 1440, height: 900 });
    await p.goto('http://localhost:4791', { waitUntil: 'networkidle2' });
    await p.waitForFunction('window.__ready===true', { timeout: 25000 });
    await p.evaluate(() => { const e = document.getElementById('network'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 40); });
    await wait(2200);
    const r = await p.evaluate(() => {
      const box = e => { if (!e) return null; const b = e.getBoundingClientRect();
        return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
      // Boxes include padding, so a hairline intersection hides nothing — the
      // credit line was still fully legible with 2px of nominal overlap. Only
      // count an intersection deep enough to eat a glyph.
      const BITE = 6;
      const hit = (x, y) => !!x && !!y
        && Math.min(x.r, y.r) - Math.max(x.l, y.l) >= BITE
        && Math.min(x.b, y.b) - Math.max(x.t, y.t) >= BITE;
      const wa = document.getElementById('wa');
      const W = box(wa);
      const attr = box(document.querySelector('.leaflet-control-attribution'));
      const zoom = box(document.querySelector('.leaflet-control-zoom'));
      const shown = wa.classList.contains('on') && !wa.classList.contains('away');
      return { shown, wa: W, attr, zoom, hitsAttr: shown && hit(W, attr), hitsZoom: shown && hit(W, zoom) };
    });
    if (r.hitsAttr || r.hitsZoom) bad++;
    console.log((m ? 'MOBILE ' : 'DESKTOP') + '  ' + JSON.stringify(r));
    await b.close();
  }
  console.log(`\nFAB vs MAP: ${bad ? 'FAIL' : 'PASS'}`);
  process.exit(bad ? 1 : 0);
})();
