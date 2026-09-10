const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1440, height: 900 });
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await pg.waitForFunction('window.__ready===true', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 800));
  // walk the whole document so lazy images and the map actually boot
  await pg.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 2500));
  const state = await pg.evaluate(() => {
    const vis = s => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : null; };
    return {
      rmClass: document.documentElement.classList.contains('rm'),
      docHeight: document.body.scrollHeight,
      hero: vis('#hero'), stats: vis('#stats'), station: vis('#station'), resolve: vis('#resolve'),
      chairmanPhoto: (() => { const i = document.querySelector('#chairman .chFrame img');
        return i ? { shown: +getComputedStyle(i).opacity, w: i.naturalWidth, h: i.naturalHeight } : null; })(),
      statNumbers: [...document.querySelectorAll('#stats .v span')].map(e => e.textContent),
      stnCount: document.getElementById('stnCount').textContent,
      revealsStuck: [...document.querySelectorAll('.rv')].filter(e => +getComputedStyle(e).opacity < .9).length,
      brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
      mapReady: !!document.querySelector('.leaflet-container'),
      pins: document.querySelectorAll('#map .pin').length,
    };
  });
  await pg.screenshot({ path: 'shots/40-reduced-motion.png' });
  console.log(JSON.stringify(state, null, 1));
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  await b.close();
})();
