// Ad-hoc DOM probe: `node probe.js "<selector>"` dumps geometry + computed
// styles for the element and its children, so layout bugs get measured not guessed.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4791';
const sel = process.argv[2];
const width = +(process.argv[3] || 1440);

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width, height: 900 });
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  const out = await p.evaluate(s => {
    const root = document.querySelector(s);
    if (!root) return 'NOT FOUND: ' + s;
    const dump = (el, d) => {
      const r = el.getBoundingClientRect(), c = getComputedStyle(el);
      return `${'  '.repeat(d)}${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''} ` +
        `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] ` +
        `display=${c.display} dir=${c.direction} bidi=${c.unicodeBidi} wrap=${c.overflowWrap} align=${c.textAlign}` +
        (el.children.length ? '' : ` "${el.textContent.trim().slice(0, 34)}"`);
    };
    const lines = [];
    const walk = (el, d) => { lines.push(dump(el, d)); if (d < 3) [...el.children].forEach(k => walk(k, d + 1)); };
    walk(root, 0);
    return lines.join('\n');
  }, sel);
  console.log(out);
  await b.close();
})();
