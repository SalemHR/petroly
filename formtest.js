// Enquiry-panel contract. Each of the four intents must own its whole context —
// heading, lede, trust points, fields, button and reply — with no field from
// another intent visible, and validation must match the fields on screen.
// Also checks every CTA that claims to open it actually lands there.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4791';
const mobile = process.argv.includes('--mobile');
const wait = ms => new Promise(r => setTimeout(r, ms));

// what each intent must and must not show
const SPEC = {
  quote:   { heading: 'اطلب عرض سعر لأسطولك',   must: ['اسم الشركة', 'حجم الأسطول', 'المنطقة الرئيسية', 'نوع الوقود المطلوب'],
             mustNot: ['سنوات الخبرة', 'الوظيفة المطلوبة', 'تفاصيل المشكلة', 'نوع الفرصة'] },
  support: { heading: 'أبلغ عن مشكلة',           must: ['نوع البلاغ', 'المحطة أو الموقع', 'تفاصيل المشكلة'],
             mustNot: ['حجم الأسطول', 'نوع الوقود المطلوب', 'سنوات الخبرة', 'اسم الشركة'] },
  invest:  { heading: 'طلبات الاستثمار والشراكة', must: ['نوع الفرصة', 'المدينة أو الموقع المقترح', 'تفاصيل الفرصة'],
             mustNot: ['حجم الأسطول', 'نوع الوقود المطلوب', 'سنوات الخبرة', 'تفاصيل المشكلة'] },
  careers: { heading: 'انضم إلى فريق بترولي',    must: ['الوظيفة المطلوبة', 'سنوات الخبرة', 'رابط السيرة الذاتية'],
             mustNot: ['حجم الأسطول', 'نوع الوقود المطلوب', 'اسم الشركة', 'نوع الفرصة'] },
};

const steps = [];
const check = (name, ok, detail) => steps.push({ name, ok: !!ok, detail });

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
                             : { width: 1440, height: 900 });
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.waitForFunction('window.__ready===true', { timeout: 25000 });
  await wait(1200);

  // ── every CTA that promises the enquiry panel must reach it ──
  const ctas = mobile
    ? ['#nav a[href="#quote"]']
    : ['header .hdr-cta', '#resolve .goBtn', 'footer a[href="#quote"]'];
  for (const sel of ctas) {
    await p.evaluate(() => scrollTo(0, 0));
    await wait(700);
    if (mobile) await p.evaluate(() => document.getElementById('burger').click());
    await wait(400);
    const found = await p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
    if (!found) { check(`CTA ${sel} exists`, false, 'selector not found'); continue; }
    await wait(2800);
    const at = await p.evaluate(() => {
      const q = document.getElementById('quote').getBoundingClientRect();
      const h = (document.getElementById('hdr') || {}).offsetHeight || 0;
      return { top: Math.round(q.top), header: h };
    });
    // the panel's top edge should sit just under the fixed header
    check(`CTA "${sel}" lands on the enquiry panel`, at.top > -120 && at.top < 220, `top=${at.top}px`);
  }

  // ── each intent owns its own context ──
  await p.evaluate(() => document.getElementById('quote').scrollIntoView());
  await wait(700);
  for (const [key, want] of Object.entries(SPEC)) {
    await p.evaluate(k => document.querySelector(`.intents button[data-intent="${k}"]`).click(), key);
    await wait(450);
    const got = await p.evaluate(() => {
      const vis = el => el.offsetParent !== null;
      return {
        heading: document.querySelector('#qHeading').textContent.trim(),
        lede: document.querySelector('#qLede').textContent.trim(),
        trust: [...document.querySelectorAll('#qTrust div')].length,
        labels: [...document.querySelectorAll('#qform .f label, #qform fieldset.f legend')]
          .filter(vis).map(l => l.textContent.replace(/\s*\*\s*$/, '').trim()),
        submit: document.querySelector('#qform .submit .txt').textContent.trim(),
        hidden: document.querySelector('#intent').value,
      };
    });
    check(`${key}: heading matches the tab`, got.heading === want.heading, got.heading);
    check(`${key}: has its own lede and trust points`, got.lede.length > 30 && got.trust === 3,
          `${got.trust} trust points`);
    const missing = want.must.filter(m => !got.labels.includes(m));
    const leaked = want.mustNot.filter(m => got.labels.includes(m));
    check(`${key}: shows its own fields`, missing.length === 0, missing.join(', ') || got.labels.join(' · '));
    check(`${key}: no field from another intent`, leaked.length === 0, leaked.join(', ') || 'clean');
    check(`${key}: request is tagged`, got.hidden.length > 3, got.hidden);
  }

  // ── validation follows the visible fields, not a fixed list ──
  await p.evaluate(() => document.querySelector('.intents button[data-intent="careers"]').click());
  await wait(450);
  await p.evaluate(() => document.getElementById('qform').requestSubmit());
  await wait(600);
  const emptyCareers = await p.evaluate(() => ({
    errs: document.querySelectorAll('#qform .f.err').length,
    done: document.getElementById('done').classList.contains('on'),
  }));
  check('careers: empty submit is blocked on its own required fields',
        emptyCareers.errs >= 4 && !emptyCareers.done, `${emptyCareers.errs} fields flagged`);

  await p.setRequestInterception(true);
  p.on('request', r => { if (r.url().startsWith('mailto:')) r.abort(); else r.continue(); });
  const filled = await p.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (!e) return;
      if (e.tagName === 'SELECT') e.value = [...e.options].map(o=>o.value).find(o=>o) || v; else e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('nm', 'سالم العتيبي'); set('ph', '0551234567'); set('em', 'salem@example.com');
    set('ct', ''); set('po', ''); set('ex', '');
    ['ct','po','ex'].forEach(id => { const e = document.getElementById(id);
      if (e) { e.selectedIndex = 1; e.dispatchEvent(new Event('change', { bubbles: true })); } });
    set('ms', 'خبرة خمس سنوات في تشغيل محطات الوقود.');
    return true;
  });
  await p.evaluate(() => document.getElementById('qform').requestSubmit());
  await wait(1000);
  const sent = await p.evaluate(() => ({
    done: document.getElementById('done').classList.contains('on'),
    errs: document.querySelectorAll('#qform .f.err').length,
  }));
  check('careers: a valid application submits', sent.done && sent.errs === 0,
        `errors=${sent.errs} success=${sent.done}`);

  check('no javascript errors', errs.length === 0, [...new Set(errs)].slice(0, 3).join(' | '));

  const w = mobile ? 'MOBILE' : 'DESKTOP';
  console.log(`\n── ENQUIRY PANEL (${w}) ──`);
  steps.forEach(s => console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.name}${s.detail ? '   — ' + s.detail : ''}`));
  const failed = steps.filter(s => !s.ok);
  console.log(`\nFORM: ${failed.length ? 'FAIL (' + failed.length + ')' : 'PASS — ' + steps.length + '/' + steps.length}`);
  await b.close();
  process.exit(failed.length ? 1 : 0);
})();
