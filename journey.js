// End-to-end user journey. Walks the page the way a fleet manager would —
// land, read the film, check the services, find a station near them, look at
// the partners, open a question, request a quote — asserting at every step.
//   node journey.js            desktop 1440x900
//   node journey.js --mobile   390x844
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4791';
const mobile = process.argv.includes('--mobile');
const wait = ms => new Promise(r => setTimeout(r, ms));

const steps = [];
const check = (name, ok, detail) => { steps.push({ name, ok: !!ok, detail }); };

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('requestfailed', r => {
    const t = (r.failure() || {}).errorText || '';
    if (t.includes('ERR_ABORTED')) return;          // teardown noise, not a failure
    errs.push('reqfail: ' + r.url() + ' ' + t);
  });
  await p.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                             : { width: 1440, height: 900 });

  // 1 — the page has to actually finish opening
  const t0 = Date.now();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  const openMs = Date.now() - t0;
  check('page opens and the loader clears', openMs < 20000, openMs + 'ms');
  await wait(1000);   // the loader fades over .7s — let it finish before judging
  const loader = await p.evaluate(() => {
    const l = document.getElementById('loader');
    if (!l) return { removed: true };
    const c = getComputedStyle(l);
    return { removed: false, cls: l.className, opacity: +c.opacity,
             visibility: c.visibility, pointer: c.pointerEvents };
  });
  check('loader clears and stops blocking the page',
        loader.removed || (loader.opacity === 0 && loader.visibility === 'hidden'),
        JSON.stringify(loader));

  // 2 — the brand reads correctly the moment you land
  const hero = await p.evaluate(() => ({
    wordmark: (document.getElementById('wordmark') || {}).textContent || '',
    split: document.querySelectorAll('#wordmark span').length,
    title: document.title,
  }));
  check('wordmark is one joined Arabic word', hero.wordmark.trim() === 'بترولي' && hero.split === 1, hero.wordmark);

  // 3 — walk the whole document so lazy content boots, and watch for breakage
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 45));
    }
  });
  await wait(2500);
  const media = await p.evaluate(() => ({
    broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
    total: document.images.length,
    upscaled: [...document.images].filter(i => {
      const r = i.getBoundingClientRect();
      return i.naturalWidth && r.width > 40 && i.naturalWidth < r.width * 0.9;
    }).map(i => `${i.getAttribute('src').split('/').pop()} natural=${i.naturalWidth} shown=${Math.round(i.getBoundingClientRect().width)}`),
  }));
  check('every image loads', media.broken.length === 0, media.broken.join(', ') || `${media.total} images`);
  check('no image is stretched past its resolution', media.upscaled.length === 0, media.upscaled.join(' | '));

  // 4 — chairman: whole person, nothing cropped away
  const ch = await p.evaluate(() => {
    const img = document.querySelector('#chairman .chFrame img');
    const frame = document.querySelector('#chairman .chFrame');
    if (!img || !frame) return null;
    const f = frame.getBoundingClientRect();
    const ar = img.naturalWidth / img.naturalHeight;
    const painted = ar > f.width / f.height ? { w: f.width, h: f.width / ar }
                                            : { w: f.height * ar, h: f.height };
    return { fit: getComputedStyle(img).objectFit, natural: [img.naturalWidth, img.naturalHeight],
             frame: [Math.round(f.width), Math.round(f.height)],
             painted: [Math.round(painted.w), Math.round(painted.h)],
             name: (document.querySelector('#chairman .chN') || {}).textContent };
  });
  check('chairman portrait is shown whole (contain, never cropped)',
        ch && ch.fit === 'contain' && ch.painted[1] <= ch.frame[1] + 1 && ch.painted[0] <= ch.frame[0] + 1,
        ch && `${ch.natural} -> painted ${ch.painted} in ${ch.frame}`);
  check('chairman is named', ch && /بالعبيد/.test(ch.name || ''), ch && ch.name);

  // 5 — the station network: map, pins, filter, and focusing one branch
  const net = await p.evaluate(() => ({
    map: !!document.querySelector('.leaflet-container'),
    tiles: document.querySelectorAll('.leaflet-tile-loaded').length,
    pins: document.querySelectorAll('#map .pin').length,
    rows: document.querySelectorAll('#netList .st').length,
    regions: document.querySelectorAll('#regRow button').length,
    stats: [...document.querySelectorAll('.netStat')].map(s => s.textContent.trim()),
    centred: [...document.querySelectorAll('.netStat')].every(s => getComputedStyle(s).textAlign === 'center'),
  }));
  check('map paints with a pin for every branch', net.map && net.tiles > 0 && net.pins === net.rows && net.rows > 100,
        `${net.pins} pins / ${net.rows} rows / ${net.tiles} tiles`);
  check('network figures sit centred over their captions', net.centred, net.stats.join(' | '));

  await p.evaluate(() => document.querySelectorAll('#regRow button')[2].click());
  await wait(1500);
  const filtered = await p.evaluate(() => {
    const r = document.querySelectorAll('#regRow button')[2].dataset.r;
    const rows = [...document.querySelectorAll('#netList .st')];
    return { region: r, rows: rows.length, pins: document.querySelectorAll('#map .pin').length,
             clean: rows.every(e => e.textContent.includes(r)) };
  });
  check('region filter drives the list and the map together',
        filtered.rows > 0 && filtered.clean && filtered.pins === filtered.rows,
        `${filtered.region}: ${filtered.rows} rows / ${filtered.pins} pins`);

  await p.evaluate(() => document.querySelector('#netList .st').click());
  await wait(1800);
  const popped = await p.evaluate(() => ({
    popup: !!document.querySelector('.leaflet-popup'),
    name: (document.querySelector('.leaflet-popup-content .n') || {}).textContent || '',
    directions: !!document.querySelector('.leaflet-popup-content .go'),
  }));
  check('picking a branch opens it on the map with directions',
        popped.popup && popped.name && popped.directions, popped.name);
  await p.evaluate(() => document.querySelectorAll('#regRow button')[0].click());
  await wait(1200);

  // 6 — partners drift, in colour, and stop when you look at them
  const partners = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('.pCell')];
    return { rails: document.querySelectorAll('.pRail').length, cells: cells.length,
             moving: [...document.querySelectorAll('.pTrack')].every(t => {
               const a = getComputedStyle(t);
               return a.animationName.startsWith('rail') && a.animationPlayState === 'running';
             }),
             greyscale: cells.some(c => /grayscale|saturate\(0/.test(getComputedStyle(c.querySelector('img')).filter)) };
  });
  check('partner logos are in motion', partners.rails === 2 && partners.moving, `${partners.cells} cards on ${partners.rails} rails`);
  check('partner logos are in full colour', !partners.greyscale);

  // 7 — an answer to a real question
  await p.evaluate(() => document.querySelector('.fq button').click());
  await wait(700);
  const faq = await p.evaluate(() => ({
    h: document.querySelector('.fq .ans').getBoundingClientRect().height,
    aria: document.querySelector('.fq button').getAttribute('aria-expanded'),
  }));
  check('FAQ opens and announces itself', faq.h > 30 && faq.aria === 'true');

  // 8 — the lead: fill the quote form the way a real visitor would
  await p.evaluate(() => document.getElementById('quote').scrollIntoView());
  await wait(600);
  await p.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('co', 'الشركة المتحدة للنقل'); set('nm', 'سالم العتيبي');
    set('ph', '0551234567'); set('em', 'fleet@united-transport.sa');
    set('fl', document.getElementById('fl').options[2].value);
    set('rg', document.getElementById('rg').options[1].value);
    set('ms', 'نستهلك نحو 40 ألف لتر ديزل شهرياً على خط الرياض–الدمام.');
  });
  await p.setRequestInterception(true);
  p.on('request', r => { if (r.url().startsWith('mailto:')) r.abort(); else r.continue(); });
  await p.evaluate(() => document.getElementById('qform').requestSubmit());
  await wait(1200);
  const sent = await p.evaluate(() => ({
    done: document.getElementById('done').classList.contains('on'),
    formHidden: getComputedStyle(document.getElementById('qform')).display === 'none',
    errors: document.querySelectorAll('.f.err').length,
  }));
  check('a valid quote request goes through', sent.done && sent.errors === 0,
        `errors=${sent.errors} success=${sent.done}`);

  // 9 — nothing may hang off the side of the page, at the top of the page as
  //     well as after scrolling. Off-screen-by-offset tricks (skip links,
  //     honeypots) park content thousands of pixels away, and in an RTL
  //     document that lands on the scrollable side.
  await p.evaluate(() => scrollTo(0, 0));
  await wait(900);
  const ovTop = await p.evaluate(() => {
    const de = document.documentElement, vw = de.clientWidth;
    let worst = null, worstX = vw;
    document.querySelectorAll('*').forEach(e => {
      const r = e.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const off = Math.max(r.right - vw, -r.left);
      if (off > 2 && off > worstX - vw) {
        if (!worst || off > worst.off) worst = { off: Math.round(off),
          el: e.tagName + (e.id ? '#' + e.id : ''), L: Math.round(r.left), R: Math.round(r.right) };
      }
    });
    return { sw: de.scrollWidth, cw: vw, worst };
  });
  check('page never scrolls sideways at the top', ovTop.sw <= ovTop.cw + 1,
        `${ovTop.sw} vs ${ovTop.cw}` + (ovTop.worst ? ` — worst: ${ovTop.worst.el} L${ovTop.worst.L} R${ovTop.worst.R}` : ''));

  await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await wait(900);
  const ov = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));
  check('page never scrolls sideways after scrolling', ov.sw <= ov.cw + 1, `${ov.sw} vs ${ov.cw}`);

  check('no javascript errors anywhere in the journey', errs.length === 0, [...new Set(errs)].slice(0, 4).join(' | '));

  const w = mobile ? 'MOBILE' : 'DESKTOP';
  console.log(`\n── USER JOURNEY (${w}) ──`);
  steps.forEach(s => console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.name}${s.detail ? '   — ' + s.detail : ''}`));
  const failed = steps.filter(s => !s.ok);
  console.log(`\n${w}: ${failed.length ? 'FAIL (' + failed.length + ')' : 'PASS — ' + steps.length + '/' + steps.length}`);
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
