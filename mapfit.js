// The default map view must actually contain every station — no branch may sit
// outside the frame when the visitor first sees the network.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mobile = process.argv.includes('--mobile');

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await p.evaluate(() => document.getElementById('network').scrollIntoView());
  await new Promise(r => setTimeout(r, 4000));

  const r = await p.evaluate(() => {
    const box = document.getElementById('map').getBoundingClientRect();
    const outside = [...document.querySelectorAll('#map .pin')].filter(el => {
      const b = el.getBoundingClientRect();
      return b.top < box.top - 2 || b.bottom > box.bottom + 2 || b.left < box.left - 2 || b.right > box.right + 2;
    }).length;
    return { pins: document.querySelectorAll('#map .pin').length, outsideFrame: outside,
             mapBox: [Math.round(box.width), Math.round(box.height)] };
  });
  console.log(JSON.stringify({ viewport: mobile ? 'mobile' : 'desktop', ...r }, null, 1));
  console.log(r.outsideFrame === 0 && r.pins > 100 ? 'MAP FIT: PASS' : 'MAP FIT: FAIL');
  await b.close();
  process.exit(r.outsideFrame === 0 && r.pins > 100 ? 0 : 1);
})();
