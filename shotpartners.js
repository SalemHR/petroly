// Photograph the partner rails exactly as a visitor sees them, at several
// points in the loop, so duplicates or clipping show up in a real frame.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const width = +(process.argv[2] || 1440);

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width, height: 1000 });
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await p.evaluate(() => document.getElementById('partners').scrollIntoView());
  await new Promise(r => setTimeout(r, 1200));

  for (const f of [0, 0.25, 0.5, 0.75]) {
    await p.evaluate(frac => {
      document.querySelectorAll('.pTrack').forEach(t => {
        const d = parseFloat(getComputedStyle(t).animationDuration);
        t.style.animationDelay = `-${(frac * d).toFixed(3)}s`;
        t.style.animationPlayState = 'paused';
      });
    }, f);
    await new Promise(r => setTimeout(r, 300));
    const el = await p.$('#partners');
    await el.screenshot({ path: `shots/rails-${width}-${String(f).replace('.', '')}.png` });
  }
  console.log('wrote rail frames at', width);
  await b.close();
})();
