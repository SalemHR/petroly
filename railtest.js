// The partner rails must loop seamlessly: a -50% shift has to land on an
// identical frame, which is only true when track width == 2 x copy width.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await p.evaluate(() => document.getElementById('partners').scrollIntoView());
  await new Promise(r => setTimeout(r, 1200));

  const rails = await p.evaluate(() => [...document.querySelectorAll('.pTrack')].map(t => {
    const cells = [...t.children];
    const n = cells.length / 2;
    const box = c => c.getBoundingClientRect();
    // distance between cell i and cell i+n must equal exactly half the track
    const drift = Math.abs(Math.abs(box(cells[0]).x - box(cells[n]).x) - t.getBoundingClientRect().width / 2);
    return {
      cells: cells.length, copies: n,
      trackW: Math.round(t.getBoundingClientRect().width),
      seamDriftPx: +drift.toFixed(2),
      running: getComputedStyle(t).animationPlayState,
      duration: getComputedStyle(t).animationDuration,
    };
  }));

  // A rail must never run dry: sample the whole cycle and check logos still
  // cover the visible window. (Under RTL a naive marquee walks itself blank.)
  const coverage = await p.evaluate(() => {
    const rails = [...document.querySelectorAll('.pRail')];
    return rails.map(rail => {
      const track = rail.querySelector('.pTrack');
      const dur = parseFloat(getComputedStyle(track).animationDuration);
      const prev = track.style.animationDelay;
      let worst = Infinity;
      for (let f = 0; f <= 1.0001; f += 0.05) {
        track.style.animationDelay = `-${(f * dur).toFixed(3)}s`;
        void track.offsetWidth;
        const w = rail.getBoundingClientRect();
        const seen = [...track.children].filter(c => {
          const b = c.getBoundingClientRect();
          return b.right > w.left + 1 && b.left < w.right - 1;
        }).length;
        worst = Math.min(worst, seen);
      }
      track.style.animationDelay = prev;
      return worst;
    });
  });

  // The tracks carry each logo twice for the loop, but a visitor must never see
  // the same brand on screen twice at once — in either rail, at any moment.
  const dupes = await p.evaluate(() => {
    const rails = [...document.querySelectorAll('.pRail')];
    const tracks = rails.map(r => r.querySelector('.pTrack'));
    const dur = tracks.map(t => parseFloat(getComputedStyle(t).animationDuration));
    const prev = tracks.map(t => t.style.animationDelay);
    const seenTwice = new Set();
    const key = c => c.querySelector('img').getAttribute('src').split('/').pop();
    for (let f = 0; f <= 1.0001; f += 0.02) {
      tracks.forEach((t, i) => { t.style.animationDelay = `-${(f * dur[i]).toFixed(3)}s`; void t.offsetWidth; });
      const onScreen = [];
      rails.forEach((rail, i) => {
        const w = rail.getBoundingClientRect();
        [...tracks[i].children].forEach(c => {
          const b = c.getBoundingClientRect();
          if (b.right > w.left + 2 && b.left < w.right - 2) onScreen.push(key(c));
        });
      });
      const counts = {};
      onScreen.forEach(k => counts[k] = (counts[k] || 0) + 1);
      Object.entries(counts).forEach(([k, n]) => { if (n > 1) seenTwice.add(k); });
    }
    tracks.forEach((t, i) => { t.style.animationDelay = prev[i]; });
    return [...seenTwice];
  });

  // hovering the rails must pause them
  await p.hover('.pRails');
  await new Promise(r => setTimeout(r, 400));
  const paused = await p.evaluate(() =>
    [...document.querySelectorAll('.pTrack')].every(t => getComputedStyle(t).animationPlayState === 'paused'));

  // and no logo may be clipped by its card
  const clipped = await p.evaluate(() => [...document.querySelectorAll('.pCell')].filter(c => {
    const i = c.querySelector('img'), a = c.getBoundingClientRect(), b = i.getBoundingClientRect();
    return b.height > a.height + 1 || b.width > a.width + 1;
  }).map(c => c.querySelector('img').getAttribute('src')));

  const out = { rails, minVisibleCellsPerRail: coverage, duplicatesOnScreen: dupes,
                pauseOnHover: paused, clippedLogos: clipped };
  console.log(JSON.stringify(out, null, 1));
  const pass = rails.length === 2 && rails.every(r => r.seamDriftPx < 1 && r.copies >= 5)
               && coverage.every(n => n >= 5) && dupes.length === 0
               && paused && clipped.length === 0 && !errs.length;
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  console.log(pass ? '\nRAILS: PASS' : '\nRAILS: FAIL');
  await b.close();
})();
