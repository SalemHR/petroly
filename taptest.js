// Touch-target audit. WCAG 2.5.8 asks for 24x24 CSS px minimum; the mobile
// guideline most people design to is 44x44. Anything interactive that falls
// under 44 in either axis is listed with enough identity to act on.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:4791', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1200);

  const scan = async () => p.evaluate(() => {
    const out = [];
    // an element is only a tap target if a finger can actually hit it: visible,
    // hit-testable, and not clipped away (honeypot) or proxied by a styled
    // sibling (the chip checkboxes, whose <b> is what you press).
    const hittable = el => {
      let n = el;
      while (n && n.nodeType === 1) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') return false;
        if (parseFloat(cs.opacity) === 0) return false;
        if (cs.pointerEvents === 'none') return false;
        if (cs.clipPath && cs.clipPath !== 'none') return false;
        n = n.parentElement;
      }
      return true;
    };
    document.querySelectorAll('a,button,input,select,textarea,summary,[role="button"]').forEach(el => {
      if (el.offsetParent === null) return;
      if (!hittable(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.width >= 44 && r.height >= 44) return;
      out.push({
        tag: el.tagName.toLowerCase(), type: el.type || '', id: el.id,
        cls: (el.className && el.className.toString() || '').slice(0, 44),
        w: Math.round(r.width), h: Math.round(r.height),
        txt: (el.textContent || '').trim().slice(0, 26),
        aria: el.getAttribute('aria-label') || '',
      });
    });
    return out;
  });

  const top = await scan();
  // open the enquiry panel so its controls are measured too
  await p.evaluate(() => document.getElementById('quote').scrollIntoView());
  await wait(900);
  const form = await scan();

  const key = e => `${e.tag}${e.type ? ':' + e.type : ''}#${e.id}.${e.cls}|${e.w}x${e.h}`;
  const all = new Map();
  [...top, ...form].forEach(e => all.set(key(e), e));

  console.log(JSON.stringify([...all.values()], null, 1));
  console.log(`\nSMALL TARGETS: ${all.size}`);
  await b.close();
})();
