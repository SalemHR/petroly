// Every place the site states how many stations there are, as the visitor sees
// it — rendered text, the map, the region cards, the list, the counters and the
// structured data — so the claims can be compared against each other and
// against the branch data the map is actually drawn from.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://localhost:4791';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 40000 });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1000);
  // let the map build
  await p.evaluate(() => { const n = document.getElementById('network'); scrollTo(0, n.getBoundingClientRect().top + scrollY - 60); });
  await wait(4000);

  const out = await p.evaluate(() => {
    const txt = document.body.innerText;
    // any sentence that mentions a station/branch count
    const claims = [];
    const re = /([٠-٩0-9]{2,4})\s*\+?\s*(?=[^\n]{0,24}?(محطة|محطات|فرع|فرعاً|فروع))/g;
    let m;
    while ((m = re.exec(txt))) {
      const around = txt.slice(Math.max(0, m.index - 60), m.index + 70).replace(/\s+/g, ' ').trim();
      claims.push({ n: m[1], context: around });
    }
    // the region cards
    const regions = [...document.querySelectorAll('#netTrack .nCard')].map(c => ({
      region: (c.querySelector('.r') || {}).textContent,
      count: +(c.querySelector('.c') || {}).textContent,
    }));
    // the list and the map
    const rows = document.querySelectorAll('#netList .st').length;
    const pins = document.querySelectorAll('.leaflet-marker-icon').length;
    const regionChips = [...document.querySelectorAll('.regRow button')].map(x => ({
      label: (x.childNodes[0] || {}).textContent, n: +(x.querySelector('.n') || {}).textContent,
    }));
    // structured data
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(s => s.textContent).join(' ');
    const ldClaims = [...ld.matchAll(/([0-9]{2,4})\s*محطة/g)].map(x => x[1]);
    const meta = [...document.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]')]
      .map(x => x.content);
    const metaClaims = meta.flatMap(c => [...c.matchAll(/([0-9]{2,4})\s*محطة/g)].map(x => x[1]));
    return { claims, regions, rows, pins, regionChips, ldClaims, metaClaims,
             netLabel: (document.getElementById('netLabel') || {}).textContent,
             stnCounter: (document.getElementById('stnCount') || {}).textContent };
  });

  const regionSum = out.regions.reduce((a, r) => a + r.count, 0);
  const chipSum = out.regionChips.filter(c => c.n && c.label && !/كل/.test(c.label))
                                 .reduce((a, c) => a + c.n, 0);
  const claimNums = [...new Set(out.claims.map(c => +c.n))].sort((a, b) => a - b);

  console.log(JSON.stringify({
    claimedInProse: out.claims,
    distinctClaims: claimNums,
    regionCards: out.regions, regionCardSum: regionSum,
    regionChips: out.regionChips, regionChipSum: chipSum,
    listRows: out.rows, mapPins: out.pins,
    structuredData: out.ldClaims, metaDescriptions: out.metaClaims,
  }, null, 1));

  const headline = 200;
  const checks = [
    ['region cards sum to the mapped branches', regionSum === out.rows, `${regionSum} vs ${out.rows}`],
    ['region chips sum to the mapped branches', chipSum === out.rows, `${chipSum} vs ${out.rows}`],
    ['map pin per list row', out.pins === out.rows, `${out.pins} pins / ${out.rows} rows`],
    ['one headline figure everywhere', new Set([...out.ldClaims, ...out.metaClaims].map(Number)).size <= 1,
      [...new Set([...out.ldClaims, ...out.metaClaims])].join(', ')],
    // 3579 is the head-office street number; only counts near a station word
    // that are plausibly a network size are compared
    ['prose states only the headline total or the mapped-branch count',
      claimNums.filter(n => n < 1000).every(n => n === headline || n === out.rows),
      claimNums.join(', ')],
    // the two figures differ, so the page must say why where they meet
    ['the gap between the two figures is explained',
      /فرعاً بموقع محدّد|المنشورة على الخريطة/.test(out.netLabel || '') &&
      /200/.test(out.netLabel || ''),
      out.netLabel || 'no label'],
  ];
  checks.forEach(([n, ok, d]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}   — ${d}`));
  const bad = checks.filter(c => !c[1]);
  console.log(`\nSTATION NUMBERS: ${bad.length ? 'FAIL (' + bad.length + ')' : 'PASS'}`);
  await b.close();
  process.exit(bad.length ? 1 : 0);
})();
