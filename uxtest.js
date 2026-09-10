const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4791';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const results = {}; const errs = [];

  // ── desktop interactions ──
  const pg = await b.newPage();
  pg.on('pageerror', e => errs.push('desktop: ' + e.message));
  await pg.setViewport({ width: 1440, height: 900 });
  await pg.goto(BASE, { waitUntil: 'networkidle2' });
  await pg.waitForFunction('window.__ready===true', { timeout: 25000 });

  // FAQ accordion
  await pg.evaluate(() => document.getElementById('faq').scrollIntoView());
  await wait(400);
  const faqClosed = await pg.evaluate(() => document.querySelector('.fq .ans').getBoundingClientRect().height);
  await pg.click('.fq button');
  await wait(700);
  const faqOpen = await pg.evaluate(() => ({
    h: document.querySelector('.fq .ans').getBoundingClientRect().height,
    aria: document.querySelector('.fq button').getAttribute('aria-expanded'),
    text: document.querySelector('.fq .ans p').textContent.trim().slice(0, 30),
  }));
  await pg.click('.fq button'); await wait(700);
  const faqReclosed = await pg.evaluate(() => document.querySelector('.fq .ans').getBoundingClientRect().height);
  results.faq = { closed: Math.round(faqClosed), open: Math.round(faqOpen.h), aria: faqOpen.aria,
                  reclosed: Math.round(faqReclosed), answer: faqOpen.text,
                  pass: faqClosed < 2 && faqOpen.h > 30 && faqOpen.aria === 'true' && faqReclosed < 2 };

  // station search
  const total = await pg.evaluate(() => document.querySelectorAll('#netList .st').length);
  await pg.click('#netQ'); await pg.type('#netQ', 'الدمام'); await wait(500);
  const filtered = await pg.evaluate(() => ({
    n: document.querySelectorAll('#netList .st').length,
    count: document.getElementById('netCount').textContent.trim(),
    allMatch: [...document.querySelectorAll('#netList .st')].every(e => e.textContent.includes('الدمام')),
  }));
  await pg.evaluate(() => { const i = document.getElementById('netQ'); i.value = 'zzzzقطر'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(400);
  const empty = await pg.evaluate(() => !!document.querySelector('.netEmpty'));
  await pg.evaluate(() => { const i = document.getElementById('netQ'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(400);
  const restored = await pg.evaluate(() => document.querySelectorAll('#netList .st').length);
  results.search = { total, filtered: filtered.n, allMatch: filtered.allMatch, emptyState: empty, restored,
                     pass: total > 100 && filtered.n > 0 && filtered.n < total && filtered.allMatch && empty && restored === total };

  // region filter buttons drive both the list and the pins on the map
  const regions = await pg.evaluate(() => document.querySelectorAll('#regRow button').length);
  await pg.evaluate(() => document.querySelectorAll('#regRow button')[1].click());
  await wait(1400);
  const byRegion = await pg.evaluate(() => {
    const r = document.querySelectorAll('#regRow button')[1].dataset.r;
    const rows = [...document.querySelectorAll('#netList .st')];
    return { region: r, rows: rows.length, pins: document.querySelectorAll('#map .pin').length,
             allMatch: rows.every(e => e.textContent.includes(r)),
             pressed: document.querySelectorAll('#regRow button[aria-pressed="true"]').length };
  });
  await pg.evaluate(() => document.querySelectorAll('#regRow button')[0].click());
  await wait(1200);
  const reset = await pg.evaluate(() => document.querySelectorAll('#netList .st').length);
  results.regionFilter = { regions, ...byRegion, reset,
    pass: regions === 6 && byRegion.rows > 0 && byRegion.rows < total && byRegion.allMatch
          && byRegion.pins === byRegion.rows && byRegion.pressed === 1 && reset === total };

  // clicking a branch focuses its real pin and opens the popup
  await pg.evaluate(() => document.querySelector('#netList .st').click());
  await wait(1800);
  const focused = await pg.evaluate(() => ({
    popup: !!document.querySelector('.leaflet-popup'),
    popupText: (document.querySelector('.leaflet-popup-content .n') || {}).textContent || '',
    current: (document.querySelector('#netList .st[aria-current="true"] .n') || {}).textContent || '',
    tiles: document.querySelectorAll('.leaflet-tile-loaded').length,
  }));
  results.mapFocus = { ...focused,
    pass: focused.popup && focused.tiles > 0 && focused.popupText === focused.current && !!focused.current };

  // in-page anchor nav
  await pg.evaluate(() => scrollTo(0, 0)); await wait(300);
  await pg.evaluate(() => document.querySelector('a[href="#quote"]').click());
  await wait(2200);
  const anchored = await pg.evaluate(() => {
    const t = document.getElementById('quote').getBoundingClientRect().top;
    return { top: Math.round(t), ok: Math.abs(t) < 90 };
  });
  results.anchorNav = anchored;

  // ── mobile interactions ──
  const mp = await b.newPage();
  mp.on('pageerror', e => errs.push('mobile: ' + e.message));
  await mp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mp.goto(BASE, { waitUntil: 'networkidle2' });
  await mp.waitForFunction('window.__ready===true', { timeout: 25000 });

  const burgerVisible = await mp.evaluate(() => getComputedStyle(document.getElementById('burger')).display !== 'none');
  await mp.click('#burger'); await wait(600);
  const menuOpen = await mp.evaluate(() => {
    const n = document.getElementById('nav'), cs = getComputedStyle(n);
    return { vis: cs.visibility, op: +cs.opacity, locked: document.body.classList.contains('locked'),
             aria: document.getElementById('burger').getAttribute('aria-expanded') };
  });
  await mp.screenshot({ path: 'shots/50-mobile-menu.png' });
  await mp.evaluate(() => document.querySelector('#nav a[href="#services"]').click());
  await wait(1600);
  const menuClosed = await mp.evaluate(() => ({
    vis: getComputedStyle(document.getElementById('nav')).visibility,
    locked: document.body.classList.contains('locked'),
    atServices: Math.abs(document.getElementById('services').getBoundingClientRect().top) < 100,
  }));
  results.mobileNav = { burgerVisible, menuOpen, menuClosed,
    pass: burgerVisible && menuOpen.vis === 'visible' && menuOpen.op > .9 && menuOpen.locked
          && menuOpen.aria === 'true' && menuClosed.vis === 'hidden' && !menuClosed.locked && menuClosed.atServices };

  // tap-target sizing on mobile
  const taps = await mp.evaluate(() => {
    const small = [];
    document.querySelectorAll('a,button,input,select,.chip b').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (getComputedStyle(el).visibility === 'hidden') return;
      if (el.closest('#nav') && getComputedStyle(document.getElementById('nav')).visibility === 'hidden') return;
      if (r.height < 32 || r.width < 32) {
        const cls = (typeof el.className === 'string' && el.className.trim()) ? '.' + el.className.trim().split(/\s+/)[0] : '';
        small.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    return [...new Set(small)].slice(0, 10);
  });
  results.smallTapTargets = taps;

  console.log(JSON.stringify(results, null, 1));
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  const pass = results.faq.pass && results.search.pass && results.regionFilter.pass && results.mapFocus.pass
               && results.anchorNav.ok && results.mobileNav.pass && !errs.length;
  console.log(pass ? '\nUX: PASS' : '\nUX: FAIL');
  await b.close();
})();
