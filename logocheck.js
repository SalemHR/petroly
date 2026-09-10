// Verify every partner logo is fully inside its card: with object-fit:contain
// the painted content must letterbox, never bleed past the padding box.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await p.evaluate(() => document.getElementById('partners').scrollIntoView());
  await new Promise(r => setTimeout(r, 1500));

  const rows = await p.evaluate(() => {
    const seen = new Set();
    return [...document.querySelectorAll('.pCell')].map(c => {
      const i = c.querySelector('img');
      const src = i.getAttribute('src').split('/').pop();
      if (seen.has(src)) return null;
      seen.add(src);
      const cs = getComputedStyle(i);
      const box = i.getBoundingClientRect();
      // what object-fit:contain actually paints inside the element box
      const ar = i.naturalWidth / i.naturalHeight;
      const px = parseFloat(cs.paddingLeft), py = parseFloat(cs.paddingTop);
      const inner = { w: box.width - px * 2, h: box.height - py * 2 };
      const painted = ar > inner.w / inner.h
        ? { w: inner.w, h: inner.w / ar }
        : { w: inner.h * ar, h: inner.h };
      const cell = c.getBoundingClientRect();
      const pad = parseFloat(cs.paddingTop);
      return {
        src, natural: [i.naturalWidth, i.naturalHeight], fit: cs.objectFit,
        box: [Math.round(box.width), Math.round(box.height)],
        painted: [Math.round(painted.w), Math.round(painted.h)],
        cell: [Math.round(cell.width), Math.round(cell.height)],
        fitsInCard: box.height <= cell.height + 1 && box.width <= cell.width + 1 && painted.h > 8,
        broken: i.complete && i.naturalWidth === 0,
      };
    }).filter(Boolean);
  });

  const bad = rows.filter(r => !r.fitsInCard || r.broken || r.fit !== 'contain');
  console.log(JSON.stringify(rows, null, 1));
  console.log(bad.length ? 'PROBLEM LOGOS: ' + bad.map(r => r.src).join(', ') : '\nLOGOS: PASS');
  await b.close();
})();
