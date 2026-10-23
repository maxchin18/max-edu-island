#!/usr/bin/env node
// MAX 教育理念島 — 本機開發伺服器（零相依）
// 用法：node server.js   →  前台 http://localhost:5173/   後台 http://localhost:5173/admin/
// 後台在本機模式下會透過 /api/save 直接寫回 data/site.json，並自動備份到 data/backups/。

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
const DATA_FILE = path.join(ROOT, 'data', 'site.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'uploads');
const MAX_BACKUPS = 30;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2'
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('內容太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function backupCurrent() {
  if (!fs.existsSync(DATA_FILE)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `site-${stamp()}.json`));
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort();
  while (files.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, mode: 'local' });

  if (url.pathname === '/api/save' && req.method === 'POST') {
    let data;
    try { data = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { ok: false, error: 'JSON 格式錯誤：' + e.message }); }
    if (!data || !Array.isArray(data.islands) || !data.site) return send(res, 400, { ok: false, error: '資料缺少 site 或 islands' });
    data.updatedAt = new Date().toISOString();
    backupCurrent();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return send(res, 200, { ok: true, updatedAt: data.updatedAt });
  }

  if (url.pathname === '/api/upload' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { ok: false, error: 'JSON 格式錯誤' }); }
    const safe = String(body.name || 'image').replace(/[^\w.\-]+/g, '_').slice(-80);
    const ext = path.extname(safe).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return send(res, 400, { ok: false, error: '只接受圖片檔' });
    const b64 = String(body.base64 || '').replace(/^data:[^,]+,/, '');
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now()}-${safe}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(b64, 'base64'));
    return send(res, 200, { ok: true, path: `assets/uploads/${name}` });
  }

  return send(res, 404, { ok: false, error: '找不到 API' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => send(res, 500, { ok: false, error: e.message }));
  } else {
    serveStatic(req, res, url);
  }
}).listen(PORT, HOST, () => {
  console.log(`MAX 教育理念島 本機伺服器：http://localhost:${PORT}/`);
  console.log(`後台：http://localhost:${PORT}/admin/`);
});
