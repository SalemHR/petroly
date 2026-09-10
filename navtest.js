// The mobile menu, opened from where a visitor actually opens it: part-way down
// the page, with the header in its scrolled state.
//
// Two things have to hold. The panel must cover the viewport — not the header's
// own box — and every link in it must be on screen and clickable, on a short
// phone as well as a tall one.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://localhost:4791';
const wait = ms => new Promise(r => setTimeout(r, ms));

// a tall phone, a short one, and a very short one in landscape-ish height
const SIZES = [
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'iPhone 12/13/14',   width: 390, height: 844 },
  { name: 'iPhone SE',         width: 375, height: 667 },
  { name: 'short viewport',    width: 390, height: 560 },
];

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const rows = [];

  for (const s of SIZES) {
    for (const where of ['top', 'scrolled']) {
      const p = await b.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await p.goto(URL, { waitUntil: 'networkidle2', timeout: 40000 });
      await p.waitForFunction('window.__ready===true', { timeout: 25000 });
      await wait(800);

      if (where === 'scrolled') {
        // where the visitor was when they hit the menu: down in the content
        await p.evaluate(() => {
          const n = document.getElementById('network');
          scrollTo(0, n.getBoundingClientRect().top + scrollY - 60);
        });
        await wait(1200);
      }

      await p.evaluate(() => document.getElementById('burger').click());
      await wait(700);

      const r = await p.evaluate(() => {
        const nav = document.getElementById('nav');
        const nb = nav.getBoundingClientRect();
        const links = [...nav.querySelectorAll('a')];
        // a link counts as reachable if its box is inside the viewport AND the
        // point at its centre actually hits it (nothing covering, not clipped)
        const reachable = links.filter(a => {
          const r = a.getBoundingClientRect();
          if (r.top < 0 || r.bottom > innerHeight) return false;
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!el && (el === a || a.contains(el));
        });
        return {
          headerSolid: document.getElementById('hdr').classList.contains('solid'),
          navCovers: Math.round(nb.height) >= innerHeight - 2 && Math.round(nb.top) <= 2,
          navBox: [Math.round(nb.top), Math.round(nb.height)],
          viewportH: innerHeight,
          links: links.length,
          reachable: reachable.length,
          missing: links.filter(a => !reachable.includes(a)).map(a => a.textContent.trim()),
          scrollable: nav.scrollHeight > nav.clientHeight
            ? (getComputedStyle(nav).overflowY === 'auto' || getComputedStyle(nav).overflowY === 'scroll')
            : true,
          overflowY: getComputedStyle(nav).overflowY,
        };
      });

      // whatever does not fit must be reachable by scrolling the panel itself
      const afterScroll = await p.evaluate(async () => {
        const nav = document.getElementById('nav');
        nav.scrollTop = nav.scrollHeight;
        await new Promise(r => setTimeout(r, 250));
        const links = [...nav.querySelectorAll('a')];
        const hit = links.filter(a => {
          const r = a.getBoundingClientRect();
          if (r.top < 0 || r.bottom > innerHeight) return false;
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!el && (el === a || a.contains(el));
        });
        nav.scrollTop = 0;
        return hit.map(a => a.textContent.trim());
      });
      // a link counts as usable if it is on screen at rest OR after scrolling
      const everReachable = new Set([...r.missing.filter(m => afterScroll.includes(m))]);
      const stillMissing = r.missing.filter(m => !afterScroll.includes(m));

      // and the menu has to actually navigate
      const navigated = await p.evaluate(async () => {
        const a = document.querySelector('#nav a[href="#network"]');
        a.click();
        await new Promise(r => setTimeout(r, 2600));
        const n = document.getElementById('network').getBoundingClientRect();
        return { closed: !document.getElementById('nav').classList.contains('open'),
                 landedTop: Math.round(n.top) };
      });

      const ok = r.navCovers && stillMissing.length === 0 &&
                 navigated.closed && Math.abs(navigated.landedTop) < 130 && errs.length === 0;
      rows.push({ size: `${s.name} ${s.width}x${s.height}`, at: where, ok, ...r,
                  stillMissing, reachedByScroll: [...everReachable], navigated,
                  errs: [...new Set(errs)] });
      await p.close();
    }
  }

  rows.forEach(r => {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.size.padEnd(30)} @${r.at.padEnd(9)}` +
      ` solid=${r.headerSolid ? 'y' : 'n'} covers=${r.navCovers ? 'y' : 'n'}` +
      ` nav=${r.navBox[1]}px/vp${r.viewportH} onscreen=${r.reachable}/${r.links}` +
      (r.reachedByScroll.length ? ` +${r.reachedByScroll.length} by scroll` : '') +
      ` link→${r.navigated.landedTop}px close=${r.navigated.closed ? 'y' : 'n'}` +
      (r.stillMissing.length ? `  UNREACHABLE: ${r.stillMissing.join(', ')}` : '') +
      (r.errs.length ? `  ERR: ${r.errs[0]}` : ''));
  });
  const failed = rows.filter(r => !r.ok);
  console.log(`\nMOBILE NAV: ${failed.length ? 'FAIL (' + failed.length + '/' + rows.length + ')' : 'PASS — ' + rows.length + '/' + rows.length}`);
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
