// Is the 64ms frame at film p=0.49 a one-off first-raster cost, or does it
// recur every time the visitor passes that point? Sweep the same range three
// times in one page load and compare.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:4791', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(800);

  for (let pass = 1; pass <= 3; pass++) {
    await p.evaluate(() => scrollTo(0, 2600));
    await wait(700);
    const worst = await p.evaluate(() => new Promise(res => {
      const deltas = []; let last = performance.now(); let y = 2600;
      const step = () => {
        const now = performance.now();
        deltas.push({ d: now - last, y: Math.round(scrollY) });
        last = now;
        y += 26; scrollTo(0, y);
        if (y < 3700) requestAnimationFrame(step);
        else res(deltas.sort((a, c) => c.d - a.d).slice(0, 3)
                       .map(e => `${Math.round(e.d)}ms @ y=${e.y}`));
      };
      requestAnimationFrame(step);
    }));
    console.log(`pass ${pass}: ${worst.join('  |  ')}`);
  }
  await b.close();
})();
