// Mobile viewport smoke test against the deployed URL.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'https://petroly.vercel.app';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const r = await p.goto(URL, { waitUntil: 'networkidle2', timeout: 40000 });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1500);

  const d = await p.evaluate(() => {
    const de = document.documentElement;
    scrollTo(0, 0);
    return {
      sideScrollTop: de.scrollWidth > de.clientWidth + 1,
      w: de.scrollWidth, cw: de.clientWidth,
      burgerVisible: !!document.getElementById('burger') &&
        getComputedStyle(document.getElementById('burger')).display !== 'none',
    };
  });
  // scroll the whole page, then re-check overflow
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 900) { scrollTo(0, y); await new Promise(r=>setTimeout(r,80)); }
  });
  const after = await p.evaluate(() => {
    const de = document.documentElement;
    return { sideScrollAfter: de.scrollWidth > de.clientWidth + 1 };
  });

  const pass = r.status() === 200 && !d.sideScrollTop && !after.sideScrollAfter && d.burgerVisible && errs.length === 0;
  console.log(JSON.stringify({ http: r.status(), ...d, ...after, errs: [...new Set(errs)] }, null, 1));
  console.log('\nLIVE MOBILE: ' + (pass ? 'PASS' : 'FAIL'));
  await b.close();
  process.exit(pass ? 0 : 1);
})();
