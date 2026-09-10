// Screenshot the deployed site. Pass --mobile for the phone viewport.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mobile = process.argv.includes('--mobile');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                             : { width: 1440, height: 900, deviceScaleFactor: 1.5 });
  const tag = mobile ? '-m' : '';
  await p.goto('https://petroly.vercel.app', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1500);
  await p.screenshot({ path: `shots/live-hero${tag}.png` });
  await p.evaluate(() => { const n = document.getElementById('network'); scrollTo(0, n.getBoundingClientRect().top + scrollY - 40); });
  await wait(5000);
  await p.screenshot({ path: `shots/live-map${tag}.png` });
  console.log('done ' + (mobile ? 'mobile' : 'desktop'));
  await b.close();
})();
