// The corridor view is the answer to "can my trucks run this route without
// going dry", so it has to be honest: the branches it lists must genuinely sit
// near the line it draws, and the map, the list and the count must agree.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mobile = process.argv.includes('--mobile');

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.setViewport(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await p.goto('http://localhost:4791/', { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await p.evaluate(() => document.getElementById('network').scrollIntoView());
  await new Promise(r => setTimeout(r, 3500));

  const buttons = await p.evaluate(() => document.querySelectorAll('#corRow button').length);

  const results = [];
  for (let i = 0; i < buttons; i++) {
    await p.evaluate(n => document.querySelectorAll('#corRow button')[n].click(), i);
    await new Promise(r => setTimeout(r, 1400));
    results.push(await p.evaluate(n => {
      const btn = document.querySelectorAll('#corRow button')[n];
      const rows = [...document.querySelectorAll('#netList .st')];
      return {
        name: btn.textContent.replace(/\d+$/, '').trim(),
        rows: rows.length,
        pins: document.querySelectorAll('#map .pin').length,
        line: !!document.querySelector('.leaflet-overlay-pane path'),
        pressed: btn.getAttribute('aria-pressed') === 'true',
        countText: (document.getElementById('netCount') || {}).textContent.replace(/\s+/g,' ').trim(),
      };
    }, i));
    // clicking the active corridor again clears it
    await p.evaluate(n => document.querySelectorAll('#corRow button')[n].click(), i);
    await new Promise(r => setTimeout(r, 900));
  }

  const cleared = await p.evaluate(() => ({
    rows: document.querySelectorAll('#netList .st').length,
    line: !!document.querySelector('.leaflet-overlay-pane path'),
  }));

  // choosing a region must drop any corridor, and vice versa — they are alternatives
  await p.evaluate(() => document.querySelectorAll('#corRow button')[0].click());
  await new Promise(r => setTimeout(r, 1200));
  await p.evaluate(() => document.querySelectorAll('#regRow button')[1].click());
  await new Promise(r => setTimeout(r, 1200));
  const exclusive = await p.evaluate(() => ({
    corridorPressed: document.querySelectorAll('#corRow button[aria-pressed="true"]').length,
    regionPressed: document.querySelectorAll('#regRow button[aria-pressed="true"]').length,
    line: !!document.querySelector('.leaflet-overlay-pane path'),
  }));

  console.log(JSON.stringify({ buttons, results, cleared, exclusive }, null, 1));
  const pass = buttons >= 4
    && results.every(r => r.rows > 0 && r.pins === r.rows && r.line && r.pressed && /فرعاً منشوراً ضمن/.test(r.countText))
    && cleared.rows > results[0].rows && !cleared.line
    && exclusive.corridorPressed === 0 && exclusive.regionPressed === 1 && !exclusive.line
    && !errs.length;
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  console.log(pass ? '\nCORRIDORS: PASS' : '\nCORRIDORS: FAIL');
  await b.close();
  process.exit(pass ? 0 : 1);
})();
