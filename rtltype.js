// Two checks the visitor sees on a phone:
//  1. Arabic is a joining script. Any letter-spacing on a run of Arabic pulls
//     the letters apart and breaks the joins, so the word stops being a word.
//     Report every visible element whose own text contains Arabic and whose
//     computed letter-spacing is not zero.
//  2. The film's thread is a 5px bar pinned to the middle of the stage. Report
//     whether it overlaps the wordmark, which reads as a stray mark on the logo.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.argv[2] || 'http://localhost:4791';
const mobile = !process.argv.includes('--desktop');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                             : { width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 40000 });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1200);

  const tracked = await p.evaluate(() => {
    const AR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const out = [];
    document.querySelectorAll('*').forEach(el => {
      // only the element's own text, not its descendants'
      const own = [...el.childNodes]
        .filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!own || !AR.test(own)) return;
      const cs = getComputedStyle(el);
      const ls = parseFloat(cs.letterSpacing);
      if (!ls) return;                       // 'normal' parses to NaN -> falsy
      out.push({
        tag: el.tagName.toLowerCase(),
        id: el.id, cls: (el.className || '').toString().slice(0, 34),
        letterSpacing: cs.letterSpacing,
        font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        text: own.slice(0, 34),
      });
    });
    return out;
  });

  const thread = await p.evaluate(() => {
    const t = document.getElementById('thread');
    const w = document.getElementById('wordmark');
    if (!t || !w) return null;
    const a = t.getBoundingClientRect(), c = w.getBoundingClientRect();
    const cs = getComputedStyle(t);
    const overlapX = Math.min(a.right, c.right) - Math.max(a.left, c.left);
    const overlapY = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
    return {
      opacity: +cs.opacity,
      thread: { l: Math.round(a.left), t: Math.round(a.top), r: Math.round(a.right), b: Math.round(a.bottom) },
      wordmark: { l: Math.round(c.left), t: Math.round(c.top), r: Math.round(c.right), b: Math.round(c.bottom) },
      overlaps: +cs.opacity > 0.02 && overlapX > 0 && overlapY > 0,
      overlapPx: [Math.round(overlapX), Math.round(overlapY)],
    };
  });

  const pass = tracked.length === 0 && thread && !thread.overlaps;
  console.log(JSON.stringify({ viewport: mobile ? 'mobile' : 'desktop', url: URL,
    arabicWithTracking: tracked, thread }, null, 1));
  console.log('\nRTL TYPE: ' + (pass ? 'PASS' : 'FAIL'));
  await b.close();
  process.exit(pass ? 0 : 1);
})();
