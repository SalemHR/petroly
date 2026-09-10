// Render the 1200x630 social card in the browser so it uses the real brand
// type, then screenshot it. ffmpeg's drawtext has no fontconfig on this box.
const pp = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="http://localhost:4791/assets/fonts/fonts.css">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:'Tajawal',sans-serif}
.card{position:relative;width:1200px;height:630px;background:#0E2244;overflow:hidden}
.card img.shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scrim{position:absolute;inset:0;background:
  linear-gradient(255deg,rgba(10,26,53,.95) 0%,rgba(14,34,68,.90) 46%,rgba(14,34,68,.40) 100%)}
.body{position:absolute;inset:0;padding:58px 72px;display:flex;flex-direction:column;
  justify-content:space-between;align-items:flex-start;color:#fff}
.top{display:flex;flex-direction:column;align-items:flex-start}
.mk{height:54px;width:auto;margin-bottom:30px}
h1{font-size:62px;font-weight:800;line-height:1.3;letter-spacing:0;max-width:14ch}
.rule{width:96px;height:6px;background:#ED1B24;border-radius:3px;margin:24px 0 20px}
p{font-size:25px;font-weight:300;line-height:1.65;color:rgba(255,255,255,.86);max-width:26ch}
.facts{display:flex;gap:40px}
.f b{display:block;font-family:'Space Grotesk',sans-serif;font-size:38px;font-weight:700;
  color:#FF3D46;line-height:1;direction:ltr}
.f span{display:block;font-size:16px;color:rgba(255,255,255,.72);margin-top:6px}
</style></head><body>
<div class="card">
  <img class="shot" src="http://localhost:4791/assets/film-station.jpg" alt="">
  <div class="scrim"></div>
  <div class="body">
    <div class="top">
      <img class="mk" src="http://localhost:4791/assets/footer-logo.png" alt="">
      <h1>ثقة على الطريق<br>منذ عام 1976</h1>
      <div class="rule"></div>
      <p>الخدمات البترولية والنقليات — وقود الأساطيل والشركات في المملكة.</p>
    </div>
    <div class="facts">
      <div class="f"><b>200+</b><span>محطة</span></div>
      <div class="f"><b>136+</b><span>ناقلة</span></div>
      <div class="f"><b>24/7</b><span>بالخدمة</span></div>
    </div>
  </div>
</div></body></html>`;

(async () => {
  const b = await pp.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));
  await p.screenshot({ path: 'assets/og-card.jpg', type: 'jpeg', quality: 90 });
  console.log('wrote assets/og-card.jpg');
  await b.close();
})();
