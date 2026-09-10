// A plain visit: no ?jump, no forced refresh — exactly what a first-time
// visitor gets. Screenshots the fold and reports whether the hero actually
// painted, because the ?jump harness force-settles state the real boot does not.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const width = +(process.argv[2] || 1440);
const height = +(process.argv[3] || 900);

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'] });
  const p = await b.newPage();
  await p.setViewport({ width, height });
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await new Promise(r => setTimeout(r, 2500));      // let the intro play out
  await p.screenshot({ path: `shots/cold-${width}.png` });

  const s = await p.evaluate(() => {
    const px = el => { const r = el.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const w = document.getElementById('wordmark');
    const inner = w.querySelector('span');
    return {
      scrollY: Math.round(scrollY),
      innerWidth, clientWidth: document.documentElement.clientWidth,
      heroOpacity: +getComputedStyle(document.getElementById('hero')).opacity,
      wordmarkBox: px(w), innerBox: px(inner),
      innerTransform: getComputedStyle(inner).transform,
      innerOpacity: +getComputedStyle(inner).opacity,
      subOpacity: +getComputedStyle(document.getElementById('heroSub')).opacity,
      metaOpacity: +getComputedStyle(document.getElementById('heroMeta')).opacity,
      chapter: (document.getElementById('chName') || {}).textContent,
    };
  });

  // is the hero region actually painted, or is it flat background?
  const region = await p.screenshot({ clip: { x: 0, y: 100, width, height: 600 }, encoding: 'base64' });
  const buf = Buffer.from(region, 'base64');
  s.foldBytes = buf.length;   // a blank fold compresses to almost nothing

  console.log(JSON.stringify(s, null, 1));
  await b.close();
})();
