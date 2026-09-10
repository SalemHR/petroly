const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff2':'font/woff2', '.json':'application/json', '.webmanifest':'application/manifest+json', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml' };

const ROOT = __dirname;

// Announce which folder is being served. A copy of this server once ran from an
// old scratch directory and quietly served a months-stale index.html on the same
// port — the log line makes that impossible to miss again.
const stamp = () => {
  try {
    const s = fs.statSync(path.join(ROOT, 'index.html'));
    return `index.html ${s.size} bytes, modified ${s.mtime.toISOString()}`;
  } catch { return 'index.html MISSING'; }
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  // never serve outside the project folder
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      // dev server: always hand back the current file, never a browser-cached one
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    });
    res.end(buf);
  });
}).listen(4791, () => {
  console.log('up on http://localhost:4791');
  console.log('serving ' + ROOT);
  console.log(stamp());
});
