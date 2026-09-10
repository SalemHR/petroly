// Walk the film in small steps and record what a visitor actually sees at each
// one: which scene is on, how much of it is legible, how long each beat lasts in
// screens of scrolling, and whether any stretch is blank.
//
// Three complaints to locate:
//   1. the region run shows only two or three cards, and they pass too fast
//   2. the station caption arrives at the very end of its shot
//   3. a white screen with nothing on it
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://localhost:4791';
const mobile = !process.argv.includes('--desktop');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
                             : { width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 40000 });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1000);

  const geo = await p.evaluate(() => ({
    filmH: document.getElementById('film').offsetHeight,
    vh: innerHeight,
  }));

  // scan the film AND the handover into the content below it: the reported
  // white screen is at the seam, not inside the film
  const END = geo.filmH + geo.vh * 1.6;
  const STEPS = 150;
  const rows = [];
  for (let i = 0; i <= STEPS; i++) {
    const prog = i / STEPS;
    const y = Math.round(prog * END);
    await p.evaluate(v => scrollTo(0, v), y);
    await wait(70);
    const s = await p.evaluate(() => {
      const vis = el => el ? +getComputedStyle(el).opacity : 0;
      const seen = id => {
        const el = document.getElementById(id);
        if (!el) return 0;
        // effective opacity = own * every ancestor's
        let o = 1, n = el;
        while (n && n.nodeType === 1) { o *= +getComputedStyle(n).opacity; n = n.parentElement; }
        return +o.toFixed(3);
      };
      // region cards fully inside the viewport
      const cards = [...document.querySelectorAll('#netTrack .nCard')];
      const onScreen = cards.filter(c => {
        const r = c.getBoundingClientRect();
        return r.left >= -4 && r.right <= innerWidth + 4 && r.width > 0;
      }).length;
      const partly = cards.filter(c => {
        const r = c.getBoundingClientRect();
        return r.right > 0 && r.left < innerWidth;
      }).length;
      // is anything meaningful painted? sample the scenes and the seam
      const scenes = ['hero','dawn','stats','mapScene','netRun','station','stationCopy','resolve'];
      const on = scenes.filter(id => seen(id) > 0.06);
      // what is the visitor actually looking at? sample the middle of the screen
      const mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      // does the screen carry any readable text at all?
      const readable = [...document.querySelectorAll('h1,h2,h3,p,span,div,a')].some(el => {
        const t = (el.textContent || '').trim();
        if (t.length < 3 || el.children.length) return false;
        const r = el.getBoundingClientRect();
        if (r.top > innerHeight - 20 || r.bottom < 20 || r.width < 8) return false;
        if (el.closest('#hdr,#readout,#wa,#skipFilm,.leaflet-control')) return false;
        let o = 1, n = el;
        while (n && n.nodeType === 1) { o *= +getComputedStyle(n).opacity; n = n.parentElement; }
        return o > 0.12;
      });
      return {
        seam: seen('seam'),
        vig: seen('vig'),
        scenesOn: on,
        readable,
        midEl: mid ? (mid.id || mid.className || mid.tagName).toString().slice(0, 22) : 'none',
        netRunOpacity: seen('netRun'),
        cardsWhole: onScreen, cardsPartly: partly,
        stationOpacity: seen('station'),
        copyOpacity: seen('stationCopy'),
        resolveOpacity: seen('resolve'),
      };
    });
    rows.push({ i, prog: +prog.toFixed(3), y, ...s });
  }

  const screens = n => (n * (geo.filmH - geo.vh) / geo.vh).toFixed(2);

  // ---- 1. the region run ----
  const net = rows.filter(r => r.netRunOpacity > 0.06);
  const netSpan = net.length ? (net[net.length - 1].prog - net[0].prog) : 0;
  const maxWhole = Math.max(0, ...net.map(r => r.cardsWhole));
  const maxPartly = Math.max(0, ...net.map(r => r.cardsPartly));

  // ---- 2. the station caption ----
  const shot = rows.filter(r => r.stationOpacity > 0.06);
  const copy = rows.filter(r => r.copyOpacity > 0.06);
  const shotSpan = shot.length ? [shot[0].prog, shot[shot.length - 1].prog] : null;
  const copySpan = copy.length ? [copy[0].prog, copy[copy.length - 1].prog] : null;

  // ---- 3. blank stretches ----
  // Either nothing is readable, or the white seam has washed over everything —
  // #seam is an opaque sheet of --paper on z-21, so once it is near 1 the
  // visitor is looking at a blank page whatever is underneath it.
  const blank = rows.filter(r => !r.readable || r.seam > 0.85);
  // group them into runs so a long dead zone is obvious
  const runs = [];
  blank.forEach(r => {
    const last = runs[runs.length - 1];
    if (last && r.i === last.to.i + 1) last.to = r; else runs.push({ from: r, to: r });
  });

  // Thresholds. The road beat carries no words but is not blank — it is the
  // driving sequence, with the thread, the road and the streaks all moving — so
  // a wordless stretch only counts against the film past two thirds of a screen.
  const longBlank = runs.filter(r => r.screensOfScroll > 0.66);
  const checks = [
    ['every region legible at once', mobile ? maxWhole === 5 : maxWhole >= 3, `${maxWhole} of 5`],
    ['regions held long enough to read', +screens(netSpan) >= 0.5, screens(netSpan) + ' screens'],
    ['station caption arrives early in the shot',
      shotSpan && copySpan && (copySpan[0] - shotSpan[0]) / (shotSpan[1] - shotSpan[0]) <= 0.28,
      copySpan && shotSpan ? Math.round((copySpan[0] - shotSpan[0]) / (shotSpan[1] - shotSpan[0]) * 100) + '% in' : 'n/a'],
    ['station caption held long enough',
      +screens(copySpan ? copySpan[1] - copySpan[0] : 0) >= 0.5,
      screens(copySpan ? copySpan[1] - copySpan[0] : 0) + ' screens'],
    ['no blank stretch', longBlank.length === 0,
      longBlank.map(r => r.screensOfScroll + ' screens @' + r.y[0]).join(', ') || 'none'],
  ];

  console.log(JSON.stringify({
    viewport: mobile ? 'mobile 390x844' : 'desktop 1440x900',
    film: { height: geo.filmH, screensOfScroll: +(geo.filmH / geo.vh).toFixed(1) },
    regionRun: {
      progress: net.length ? [net[0].prog, net[net.length - 1].prog] : null,
      screensOfScroll: +screens(netSpan),
      cardsFullyOnScreenAtOnce: maxWhole,
      cardsTouchingScreenAtOnce: maxPartly,
      totalCards: 5,
    },
    stationShot: {
      shotProgress: shotSpan, copyProgress: copySpan,
      copyStartsAfterShotBegins: shotSpan && copySpan
        ? +((copySpan[0] - shotSpan[0]) / (shotSpan[1] - shotSpan[0]) * 100).toFixed(0) + '%' : null,
      copyVisibleForScreens: +screens(copySpan ? copySpan[1] - copySpan[0] : 0),
    },
    blankRuns: runs.map(r => ({
      y: [r.from.y, r.to.y],
      screensOfScroll: +((r.to.y - r.from.y + END / STEPS) / geo.vh).toFixed(2),
      seam: [r.from.seam, r.to.seam],
      showing: r.from.midEl,
      insideFilm: r.to.y < geo.filmH,
    })).filter(r => r.screensOfScroll > 0.12),
  }, null, 1));

  checks.forEach(([name, ok, detail]) =>
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}   — ${detail}`));
  const failed = checks.filter(c => !c[1]);
  console.log(`\nFILM (${mobile ? 'MOBILE' : 'DESKTOP'}): ` +
    (failed.length ? `FAIL (${failed.length})` : `PASS — ${checks.length}/${checks.length}`));
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
