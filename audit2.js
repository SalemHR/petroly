// Second audit pass: contrast with real alpha compositing, form labelling,
// focus visibility, and how the page behaves on a slow connection.
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

  const out = await p.evaluate(() => {
    // composite rgba over its backdrop, then compute WCAG contrast properly
    const num = s => (s.match(/[-\d.]+/g) || []).map(Number);
    const over = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1;
      return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };
    const solidBehind = el => { let n = el;
      while (n) { const c = num(getComputedStyle(n).backgroundColor);
        if (c.length === 3 || (c[3] === undefined) || c[3] > 0.99) if (getComputedStyle(n).backgroundColor !== 'rgba(0, 0, 0, 0)') return c.slice(0, 3);
        n = n.parentElement; }
      return [255, 255, 255]; };
    const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

    const seen = new Map();
    document.querySelectorAll('p,span,a,li,label,h1,h2,h3,h4,h5,button,div').forEach(el => {
      if (!el.childNodes.length) return;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2);
      if (!hasText) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity < 0.1) return;
      const bg = solidBehind(el);
      const fg = over(num(cs.color), bg);
      const cr = ratio(fg, bg);
      const size = parseFloat(cs.fontSize);
      const bold = +cs.fontWeight >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      if (cr < need) {
        const key = `${cs.color}|${Math.round(size)}|${el.className}`;
        if (!seen.has(key)) seen.set(key, {
          sample: el.textContent.trim().slice(0, 34), cls: String(el.className).slice(0, 30),
          color: cs.color, sizePx: Math.round(size), ratio: +cr.toFixed(2), needs: need,
        });
      }
    });

    // form labelling and required-field signalling
    const fields = [...document.querySelectorAll('#qform input,#qform select,#qform textarea')];
    // a wrapping <label> counts, and hidden inputs need no label at all
    const unlabelled = fields.filter(e => e.type !== 'hidden'
        && !document.querySelector(`label[for="${e.id}"]`)
        && !e.closest('label') && !e.getAttribute('aria-label'))
      .map(e => `${e.tagName.toLowerCase()}#${e.id || '(no id)'} name=${e.name || '-'} type=${e.type || '-'}`);
    const noRequiredAttr = fields.filter(e => e.closest('.f') &&
      e.closest('.f').querySelector('label span') && !e.hasAttribute('required') && !e.hasAttribute('aria-required'))
      .map(e => e.id);

    // does anything announce an error to a screen reader?
    const errorLive = document.querySelectorAll('#qform [aria-live],#qform [role="alert"]').length;

    return {
      lowContrast: [...seen.values()].sort((a, b) => a.ratio - b.ratio).slice(0, 12),
      form: { fields: fields.length, unlabelled, noRequiredAttr, errorLive,
              hasNoscriptFallback: !!document.querySelector('noscript') },
      focusVisible: (() => {
        const s = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules].map(r => r.selectorText || ''); } catch { return []; } });
        return s.filter(t => t.includes(':focus-visible')).length;
      })(),
      skipLinkTarget: !!document.getElementById('main'),
      langOfLatin: document.querySelectorAll('[lang="en"]').length,
      motionToggle: !!document.querySelector('[data-motion],#motionToggle'),
      backToTop: !!document.querySelector('a[href="#top"],#backToTop'),
    };
  });

  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
