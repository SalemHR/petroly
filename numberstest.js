// Guards against the failure the client caught by eye: the same fact quoted as
// two different numbers in two places. Every headline figure on the page must
// resolve to one value.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 2500));

  const r = await p.evaluate(() => {
    const text = document.body.innerText;
    const grab = re => [...new Set([...text.matchAll(re)].map(m => m[1]))];
    return {
      // how many stations does the page claim, anywhere?
      stationClaims: grab(/(\d{2,4})\s*\+?\s*محطة/g),
      // how many trucks?
      truckClaims: grab(/(\d{2,4})\s*\+?\s*(?:ناقلة|شاحنة)/g),
      // how many years of operation? the counter reads 0 until the film
      // scrolls to it, so take the target it counts up to
      yearClaims: [...new Set([...document.querySelectorAll('#stats .v span[data-c]')]
        .filter(e => /عاماً/.test((e.closest('.c') || {}).textContent || ''))
        .map(e => e.dataset.c))],
      founded: grab(/منذ\s*(?:عام\s*)?(\d{4})/g),
      // the branch directory is a separate, explicitly-labelled figure
      publishedBranches: (document.getElementById('netCount') || {}).textContent || '',
      heroMeta: [...document.querySelectorAll('#heroMeta span')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      netStats: [...document.querySelectorAll('.netStat')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    };
  });

  const thisYear = new Date().getFullYear();
  const expectYears = String(thisYear - 1976);
  const problems = [];
  if (r.stationClaims.length > 1) problems.push('station count quoted as: ' + r.stationClaims.join(' / '));
  if (r.truckClaims.length > 1) problems.push('fleet size quoted as: ' + r.truckClaims.join(' / '));
  if (r.yearClaims.length > 1) problems.push('years quoted as: ' + r.yearClaims.join(' / '));
  if (r.yearClaims.length === 1 && r.yearClaims[0] !== expectYears)
    problems.push(`years says ${r.yearClaims[0]}, but ${thisYear} − 1976 = ${expectYears}`);
  if (r.founded.length > 1) problems.push('founding year quoted as: ' + r.founded.join(' / '));

  console.log(JSON.stringify(r, null, 1));
  console.log(problems.length ? '\nCONFLICTS:\n - ' + problems.join('\n - ') : '\nNUMBERS: PASS — no conflicting figures');
  await b.close();
  process.exit(problems.length ? 1 : 0);
})();
