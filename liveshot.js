const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await p.goto('https://petroly.vercel.app', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1500);
  await p.screenshot({ path: 'shots/live-hero.png' });
  await p.evaluate(() => { const n = document.getElementById('network'); scrollTo(0, n.getBoundingClientRect().top + scrollY - 40); });
  await wait(5000);
  await p.screenshot({ path: 'shots/live-map.png' });
  console.log('done');
  await b.close();
})();
