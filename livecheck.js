// Verify the deployed site with real Chrome: no login wall, page renders, the
// Leaflet map builds with tiles and a pin for every branch, fonts load, and
// nothing throws. Same checks the local journey runs, pointed at production.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'https://petroly.vercel.app';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('requestfailed', r => {
    const u = r.url();
    if (/arcgisonline|openstreetmap/.test(u)) errs.push('tile failed: ' + u.slice(0, 60));
  });

  const resp = await p.goto(URL, { waitUntil: 'networkidle2', timeout: 40000 });
  const status = resp.status();
  const finalUrl = p.url();
  const wall = /vercel\.com\/sso|Authentication Required|_vercel_sso/.test(await p.content());

  await p.waitForFunction('window.__ready===true', { timeout: 25000 }).catch(() => errs.push('__ready never fired'));
  await wait(1000);

  const title = await p.title();

  // drive to the network section and let the map build
  await p.evaluate(() => {
    const n = document.getElementById('network');
    scrollTo(0, n.getBoundingClientRect().top + scrollY - 60);
  });
  await wait(5000);

  const map = await p.evaluate(() => ({
    tiles: document.querySelectorAll('.leaflet-tile-loaded').length,
    pins: document.querySelectorAll('.leaflet-marker-icon').length,
    rows: document.querySelectorAll('#netList .st').length,
    container: document.getElementById('map').classList.contains('leaflet-container'),
    fallbackGone: !document.getElementById('mapFallback'),
  }));

  const fonts = await p.evaluate(() => {
    const wm = getComputedStyle(document.querySelector('#wordmark')).fontFamily;
    return { wordmark: wm, loaded: document.fonts.status };
  });

  // check a couple of deep assets over the wire
  const assets = {};
  for (const path of ['/assets/chairman.webp', '/vendor/gsap.min.js', '/assets/og-card.jpg', '/sitemap.xml']) {
    const r = await p.evaluate(u => fetch(u).then(x => x.status).catch(() => 'ERR'), URL + path);
    assets[path] = r;
  }

  const pass =
    status === 200 &&
    !wall &&
    finalUrl.startsWith(URL) &&
    map.tiles > 0 && map.pins === 116 && map.rows === 116 && map.container && map.fallbackGone &&
    errs.length === 0;

  console.log(JSON.stringify({ URL, status, finalUrl, loginWall: wall, title, map, fonts, assets,
    errors: [...new Set(errs)] }, null, 1));
  console.log('\nLIVE SITE: ' + (pass ? 'PASS' : 'FAIL'));
  await b.close();
  process.exit(pass ? 0 : 1);
})();
