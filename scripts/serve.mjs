#!/usr/bin/env node
// Tiny local preview server for _site/ (run `npm run build` first).
// It serves the site under the same base path as GitHub Pages
// (basePath in site.config.json), so what works here works there.
// Usage: npm run serve   (optional: PORT=3000 npm run serve)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readSiteConfig } from './lib/catalog.mjs';

const SITE = path.join(ROOT, '_site');
const PORT = Number(process.env.PORT) || 8080;
const raw = readSiteConfig().basePath || '/';
const BASE = raw === '/' ? '/' : '/' + raw.replace(/^\/+|\/+$/g, '') + '/';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

if (!fs.existsSync(SITE)) {
  console.error('No _site/ folder yet. Run `npm run build` first.');
  process.exit(1);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (BASE !== '/' && (p === '/' || p === BASE.slice(0, -1))) {
    res.writeHead(302, { location: BASE });
    return res.end();
  }
  if (!p.startsWith(BASE)) return send404(res);
  let file = path.normalize(path.join(SITE, p.slice(BASE.length)));
  if (!file.startsWith(SITE)) return send404(res);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return send404(res);
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}${BASE}`));

function send404(res) {
  res.writeHead(404, { 'content-type': TYPES['.html'] });
  fs.createReadStream(path.join(SITE, '404.html')).pipe(res);
}
