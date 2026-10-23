#!/usr/bin/env node
// MAX 教育理念島 — 內容管理命令列工具（零相依，Node 18+）
// 給人用，也給 AI 用：所有內容都在 data/site.json，這支工具負責「安全地讀寫與驗證」。
//
//   node tools/site.mjs help
//   node tools/site.mjs validate              檢查資料（CI 也跑這個）
//   node tools/site.mjs stats                 統計與今天的季節
//   node tools/site.mjs list islands|links|people|values|seasons
//   node tools/site.mjs show <島嶼id>
//   node tools/site.mjs export-md [輸出檔]     匯出全部內容為 Markdown（預設 docs/CONTENT.md）
//   node tools/site.mjs add-island --name 名稱 [--icon 🌱 --color #4CC3A0 --landmark school --tagline .. --quote .. --values M,A --q 0 --r 3]
//   node tools/site.mjs add-item <島嶼id> --name 名稱 [--phase 短期 --target 對象 --summary 說明 --points "重點1|重點2" --schedule .. --link URL]
//   node tools/site.mjs add-person --name 名稱 --emoji 🙂 [--color #F5B041 --count 3 --carry "🧺:菜籃,🌾:稻穗" --homes food,green --desc 說明 --glasses true --age child|adult|elder]
//   node tools/site.mjs add-link --from 島id --to 島id,島id --title 說明 [--basis 課程實踐]
//   node tools/site.mjs set <路徑> <值>        例：set site.headline "讓每個孩子，都被看見。"、set islands.food.tagline "..."
//   node tools/site.mjs remove island|item|link|person|value <id>
//
// 加上 --dry-run 只顯示結果不寫檔。每次寫入前會備份到 data/backups/。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data', 'site.json');
const BACKUPS = path.join(ROOT, 'data', 'backups');

export const LANDMARKS = ['school', 'farm', 'harbor', 'library', 'tech', 'sports', 'temple', 'heart', 'hall', 'home', 'garden', 'art', 'puzzle', 'globe'];
export const PARTICLES = ['petal', 'firefly', 'leaf', 'snow'];
const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z0-9][a-z0-9-]*$/;

// ---------------- 驗證 ----------------
export function validate(d) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(m), W = (m) => warnings.push(m);
  if (!d || typeof d !== 'object') return { errors: ['不是 JSON 物件'], warnings };
  if (!d.site) E('缺少 site');
  if (!Array.isArray(d.islands) || !d.islands.length) E('islands 必須是非空陣列');
  const islands = d.islands || [];
  const ids = new Set(), pos = new Map(), itemIds = new Set();
  const valueIds = new Set((d.values || []).map((v) => v.id));
  for (const [i, isl] of islands.entries()) {
    const at = `islands[${i}]（${isl?.name || isl?.id || '?'}）`;
    if (!isl.id || !ID.test(isl.id)) E(`${at} id 只能用小寫英數與 -：「${isl.id}」`);
    if (ids.has(isl.id)) E(`${at} id 重複：${isl.id}`);
    ids.add(isl.id);
    if (!isl.name) E(`${at} 缺少 name`);
    if (isl.color && !HEX.test(isl.color)) E(`${at} color 必須是 #RRGGBB`);
    if (isl.landmark && !LANDMARKS.includes(isl.landmark)) W(`${at} landmark「${isl.landmark}」不認得，會顯示成學校`);
    if (!Number.isInteger(isl.q) || !Number.isInteger(isl.r)) E(`${at} q、r 必須是整數（六角座標）`);
    else {
      const k = `${isl.q},${isl.r}`;
      if (pos.has(k)) E(`${at} 位置 (${k}) 和「${pos.get(k)}」重疊`);
      pos.set(k, isl.name);
      if (Math.abs(isl.q) > 4 || Math.abs(isl.r) > 4 || Math.abs(isl.q + isl.r) > 4) W(`${at} 位置 (${k}) 離中心太遠，可能會撞到海岸或機場島`);
    }
    for (const v of isl.values || []) if (!valueIds.has(v)) E(`${at} values 用到不存在的價值面向「${v}」`);
    for (const [j, it] of (isl.items || []).entries()) {
      const a2 = `${at}.items[${j}]（${it?.name || '?'}）`;
      if (!it.id) E(`${a2} 缺少 id`);
      else if (itemIds.has(it.id)) E(`${a2} id 重複：${it.id}`);
      itemIds.add(it.id);
      if (!it.name) E(`${a2} 缺少 name`);
      if (it.points && !Array.isArray(it.points)) E(`${a2} points 必須是陣列`);
    }
  }
  // 島嶼要連在一起，小人才走得過去
  if (pos.size > 1) {
    // 找出所有相連的島群，最大的那群以外都算離群
    const seen = new Set();
    const groups = [];
    for (const start of pos.keys()) {
      if (seen.has(start)) continue;
      const g = [start];
      seen.add(start);
      for (let i = 0; i < g.length; i++) {
        const [a, b] = g[i].split(',').map(Number);
        for (const [dq, dr] of HEX_DIRS) {
          const k = `${a + dq},${b + dr}`;
          if (pos.has(k) && !seen.has(k)) { seen.add(k); g.push(k); }
        }
      }
      groups.push(g);
    }
    groups.sort((x, y) => y.length - x.length);
    const lonely = groups.slice(1).flat().map((k) => pos.get(k));
    if (lonely.length) W(`這些島沒有和主島群相鄰，小人走不過去：${lonely.join('、')}`);
  }
  const linkIds = new Set();
  for (const [i, l] of (d.links || []).entries()) {
    const at = `links[${i}]（${l.id || '?'}）`;
    if (!l.id) E(`${at} 缺少 id`);
    if (linkIds.has(l.id)) E(`${at} id 重複`);
    linkIds.add(l.id);
    if (!ids.has(l.from)) E(`${at} from 指向不存在的島「${l.from}」`);
    if (!Array.isArray(l.to) || !l.to.length) E(`${at} to 必須是非空陣列`);
    for (const t of l.to || []) if (!ids.has(t)) E(`${at} to 指向不存在的島「${t}」`);
    if ((l.to || []).includes(l.from)) W(`${at} 連到自己`);
    if (l.basis && d.linkBasis && !d.linkBasis.includes(l.basis)) W(`${at} basis「${l.basis}」不在 linkBasis 清單`);
  }
  const typeIds = new Set();
  let walkers = 0;
  for (const [i, t] of (d.personTypes || []).entries()) {
    const at = `personTypes[${i}]（${t.name || '?'}）`;
    if (!t.id || !ID.test(t.id)) E(`${at} id 只能用小寫英數與 -`);
    if (typeIds.has(t.id)) E(`${at} id 重複`);
    typeIds.add(t.id);
    if (!t.name) E(`${at} 缺少 name`);
    if (t.color && !HEX.test(t.color)) E(`${at} color 必須是 #RRGGBB`);
    const c = Number(t.count);
    if (!Number.isFinite(c) || c < 0 || c > 30) E(`${at} count 必須是 0–30`);
    walkers += Number(t.count) || 0;
    for (const h of t.homes || []) if (!ids.has(h)) E(`${at} homes 指向不存在的島「${h}」`);
    if (!(t.carry || []).length) W(`${at} 沒有設定 carry（搬運的東西）`);
    if (t.glasses != null && typeof t.glasses !== 'boolean') E(`${at} glasses 必須是 true 或 false`);
    if (t.age != null && !['child', 'adult', 'elder'].includes(t.age)) E(`${at} age 必須是 child、adult 或 elder`);
  }
  if (walkers > 120) W(`地圖上共有 ${walkers} 位小人，超過 120 可能讓手機變慢`);
  const seasons = d.seasons?.list || [];
  const months = new Map();
  for (const s of seasons) {
    if (s.accent && !HEX.test(s.accent)) E(`seasons.${s.id} accent 必須是 #RRGGBB`);
    if (s.particle && !PARTICLES.includes(s.particle)) W(`seasons.${s.id} particle 應為 ${PARTICLES.join('/')}`);
    for (const f of s.focus || []) if (!ids.has(f)) E(`seasons.${s.id} focus 指向不存在的島「${f}」`);
    for (const m of s.months || []) months.set(m, (months.get(m) || 0) + 1);
  }
  for (let m = 1; m <= 12; m++) {
    const n = months.get(m) || 0;
    if (n !== 1) E(`${m} 月被分配給 ${n} 個季節（每個月必須剛好屬於一季）`);
  }
  if (d.seasons?.mode && !['auto', 'spring', 'summer', 'autumn', 'winter'].includes(d.seasons.mode)) E('seasons.mode 必須是 auto/spring/summer/autumn/winter');
  if (d.airport?.enabled && d.airport.island && !ids.has(d.airport.island)) E(`airport.island 指向不存在的島「${d.airport.island}」`);
  return { errors, warnings };
}

// ---------------- 小工具 ----------------
const load = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
function save(d, dry) {
  const { errors, warnings } = validate(d);
  warnings.forEach((w) => console.warn('⚠️ ', w));
  if (errors.length) {
    errors.forEach((e) => console.error('❌', e));
    console.error('資料有錯，沒有寫入。');
    process.exit(1);
  }
  if (dry) { console.log('（--dry-run：沒有寫入）'); return; }
  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  fs.copyFileSync(DATA, path.join(BACKUPS, `site-${stamp}.json`));
  d.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('✅ 已寫入 data/site.json');
}
function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}
const slug = (s, prefix) => {
  const base = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
};
const uniq = (id, taken) => { let x = id, n = 2; while (taken.has(x)) x = `${id}-${n++}`; return x; };
const list = (v) => (v === true || v == null ? [] : String(v).split(/[,，]/).map((s) => s.trim()).filter(Boolean));
function freeCell(d) {
  const taken = new Set(d.islands.map((i) => `${i.q},${i.r}`));
  for (let ring = 1; ring <= 4; ring++) {
    for (const isl of d.islands) {
      for (const [dq, dr] of HEX_DIRS) {
        const q = isl.q + dq, r = isl.r + dr;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= ring && !taken.has(`${q},${r}`)) return { q, r };
      }
    }
  }
  return { q: 0, r: 3 };
}
export function seasonToday(d, date = new Date()) {
  const m = date.getMonth() + 1;
  return (d.seasons?.list || []).find((s) => (s.months || []).includes(m));
}

export function toMarkdown(d) {
  const L = [];
  const s = d.site || {};
  L.push(`# ${s.pageTitle || 'MAX 教育理念島'}`, '', `> ${s.headline || ''}`, '', s.description || '', '');
  L.push('## 價值面向', '');
  for (const v of d.values || []) L.push(`- **${v.id} · ${v.name}**（${v.en || ''}）：${v.desc || ''}`);
  L.push('');
  d.islands.forEach((isl, i) => {
    L.push(`## ${String(i + 1).padStart(2, '0')} ${isl.icon || ''} ${isl.name}`, '');
    if (isl.tagline) L.push(`**${isl.tagline}**`, '');
    if (isl.quote) L.push(`> ${isl.quote}`, '');
    L.push(`價值面向：${(isl.values || []).join('、') || '—'}　｜　id：\`${isl.id}\``, '');
    for (const it of isl.items || []) {
      L.push(`### ${it.name}`, '');
      const meta = [it.phase && `時程：${it.phase}`, it.target && `對象：${it.target}`, it.schedule && `推動：${it.schedule}`].filter(Boolean).join('　｜　');
      if (meta) L.push(meta, '');
      if (it.summary) L.push(it.summary, '');
      for (const p of it.points || []) L.push(`- ${p}`);
      if (it.link) L.push('', `相關資源：${it.link}`);
      L.push('');
    }
  });
  L.push('## 協作連結', '');
  const name = (id) => d.islands.find((i) => i.id === id)?.name || id;
  for (const l of d.links || []) L.push(`- **${l.id}** ${name(l.from)} → ${l.to.map(name).join('、')}：${l.title}（${l.basis || ''}）`);
  L.push('', '## 人物類型', '');
  for (const t of d.personTypes || []) L.push(`- ${t.emoji || ''} **${t.name}** ×${t.count}：${t.desc || ''}　搬運：${(t.carry || []).map((c) => `${c.emoji}${c.name}`).join('、')}`);
  L.push('', '## 四季', '');
  for (const se of d.seasons?.list || []) L.push(`- ${se.emoji || ''} **${se.title}**（${(se.months || []).join('、')} 月）：${se.tagline || ''}　焦點：${(se.focus || []).map(name).join('、')}`);
  L.push('', `_資料更新：${d.updatedAt || ''}_`, '');
  return L.join('\n');
}

// ---------------- 指令 ----------------
function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0] || 'help';
  const dry = !!a['dry-run'];

  if (cmd === 'help') {
    const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
    console.log(src);
    return;
  }
  const d = load();

  if (cmd === 'validate') {
    const { errors, warnings } = validate(d);
    warnings.forEach((w) => console.warn('⚠️ ', w));
    errors.forEach((e) => console.error('❌', e));
    if (errors.length) { console.error(`\n共 ${errors.length} 個錯誤`); process.exit(1); }
    console.log(`✅ 資料正確（${d.islands.length} 島、${d.islands.reduce((n, i) => n + i.items.length, 0)} 細項、${(d.links || []).length} 連結、${(d.personTypes || []).length} 種人物，${warnings.length} 個提醒）`);
    return;
  }
  if (cmd === 'stats') {
    const s = seasonToday(d);
    console.log(`島嶼 ${d.islands.length}｜細項 ${d.islands.reduce((n, i) => n + i.items.length, 0)}｜連結 ${d.links.length}｜人物類型 ${d.personTypes.length}（共 ${d.personTypes.reduce((n, t) => n + (+t.count || 0), 0)} 位）`);
    console.log(`季節模式：${d.seasons?.mode}｜今天依日期是：${s ? `${s.emoji} ${s.title}` : '（未設定）'}`);
    console.log(`最後更新：${d.updatedAt}`);
    return;
  }
  if (cmd === 'list') {
    const what = a._[1] || 'islands';
    if (what === 'islands') d.islands.forEach((i, k) => console.log(`${String(k + 1).padStart(2, '0')} ${i.id.padEnd(12)} ${i.icon || ''} ${i.name}（${i.items.length} 細項，位置 ${i.q},${i.r}，地標 ${i.landmark}）`));
    else if (what === 'links') d.links.forEach((l) => console.log(`${l.id.padEnd(4)} ${l.from} → ${l.to.join(',')}｜${l.title}（${l.basis}）`));
    else if (what === 'people') d.personTypes.forEach((t) => console.log(`${t.id.padEnd(16)} ${t.emoji} ${t.name} ×${t.count}（${{ child: '兒童', adult: '成人', elder: '長者' }[t.age] || '自動'}）｜${(t.carry || []).map((c) => c.emoji + c.name).join(' ')}`));
    else if (what === 'values') d.values.forEach((v) => console.log(`${v.id} ${v.name}（${v.en}）${v.color}`));
    else if (what === 'seasons') d.seasons.list.forEach((s) => console.log(`${s.id.padEnd(7)} ${s.emoji} ${s.title} 月份 ${s.months.join(',')}｜焦點 ${s.focus.join(',')}`));
    else console.error('可列出：islands | links | people | values | seasons');
    return;
  }
  if (cmd === 'show') {
    const isl = d.islands.find((i) => i.id === a._[1]);
    if (!isl) { console.error('找不到島嶼', a._[1]); process.exit(1); }
    console.log(JSON.stringify(isl, null, 2));
    return;
  }
  if (cmd === 'export-md') {
    const out = path.resolve(ROOT, a._[1] || 'docs/CONTENT.md');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, toMarkdown(d), 'utf8');
    console.log('✅ 已匯出', path.relative(ROOT, out));
    return;
  }
  if (cmd === 'add-island') {
    if (!a.name) { console.error('需要 --name'); process.exit(1); }
    const taken = new Set(d.islands.map((i) => i.id));
    const cell = a.q != null && a.r != null ? { q: +a.q, r: +a.r } : freeCell(d);
    const isl = {
      id: uniq(a.id || slug(a.en || '', 'isl'), taken), name: a.name, icon: a.icon || '🌱', color: a.color || '#4CC3A0',
      landmark: a.landmark || 'school', q: cell.q, r: cell.r, tagline: a.tagline || '', quote: a.quote || '',
      values: list(a.values), source: { label: '', url: '' }, items: []
    };
    d.islands.push(isl);
    console.log(`新增島嶼 ${isl.id}（位置 ${isl.q},${isl.r}）`);
    save(d, dry);
    return;
  }
  if (cmd === 'add-item') {
    const isl = d.islands.find((i) => i.id === a._[1]);
    if (!isl || !a.name) { console.error('用法：add-item <島嶼id> --name 名稱'); process.exit(1); }
    const taken = new Set(d.islands.flatMap((i) => i.items.map((x) => x.id)));
    let n = isl.items.length + 1;
    while (taken.has(`${isl.id}-${n}`)) n++;
    const it = {
      id: `${isl.id}-${n}`, name: a.name, phase: a.phase || '', target: a.target || '', summary: a.summary || '',
      points: a.points ? String(a.points).split('|').map((s) => s.trim()).filter(Boolean) : [], schedule: a.schedule || '', image: a.image || '', link: a.link || ''
    };
    isl.items.push(it);
    console.log(`在「${isl.name}」新增細項 ${it.id}`);
    save(d, dry);
    return;
  }
  if (cmd === 'add-person') {
    if (!a.name) { console.error('需要 --name'); process.exit(1); }
    const taken = new Set(d.personTypes.map((t) => t.id));
    const carry = list(a.carry).map((c) => { const [emoji, ...rest] = c.split(':'); return { emoji: emoji.trim(), name: rest.join(':').trim() || '物資' }; });
    const t = {
      id: uniq(a.id || slug(a.en || '', 'person'), taken), name: a.name, emoji: a.emoji || '🙂', color: a.color || '#F5B041',
      count: Number(a.count ?? 3), desc: a.desc || '', homes: list(a.homes), carry: carry.length ? carry : [{ emoji: '📦', name: '物資' }]
    };
    if (a.glasses != null) t.glasses = a.glasses === true || a.glasses === 'true';
    if (a.age) t.age = a.age;
    d.personTypes.push(t);
    console.log(`新增人物類型 ${t.id}`);
    save(d, dry);
    return;
  }
  if (cmd === 'add-link') {
    if (!a.from || !a.to || !a.title) { console.error('需要 --from --to --title'); process.exit(1); }
    let n = d.links.length + 1;
    const taken = new Set(d.links.map((l) => l.id));
    while (taken.has(`C${n}`)) n++;
    const l = { id: a.id || `C${n}`, from: a.from, to: list(a.to), title: a.title, basis: a.basis || (d.linkBasis || [])[0] || '' };
    d.links.push(l);
    console.log(`新增連結 ${l.id}`);
    save(d, dry);
    return;
  }
  if (cmd === 'set') {
    const [, p, ...rest] = a._;
    if (!p || !rest.length) { console.error('用法：set <路徑> <值>，例如 set site.headline "標題"、set islands.food.tagline "..."'); process.exit(1); }
    let val = rest.join(' ');
    try { val = JSON.parse(val); } catch { /* 當成字串 */ }
    const keys = p.split('.');
    let obj = d;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (Array.isArray(obj)) obj = obj.find((x) => x.id === k) ?? obj[+k];
      else obj = obj[k];
      if (obj == null) { console.error('路徑不存在：', keys.slice(0, i + 1).join('.')); process.exit(1); }
    }
    obj[keys.at(-1)] = val;
    console.log(`設定 ${p} =`, val);
    save(d, dry);
    return;
  }
  if (cmd === 'remove') {
    const [, kind, id] = a._;
    const before = JSON.stringify(d).length;
    if (kind === 'island') {
      d.islands = d.islands.filter((i) => i.id !== id);
      d.links = d.links.filter((l) => l.from !== id).map((l) => ({ ...l, to: l.to.filter((t) => t !== id) })).filter((l) => l.to.length);
      d.personTypes.forEach((t) => { t.homes = (t.homes || []).filter((h) => h !== id); });
      d.seasons.list.forEach((s) => { s.focus = (s.focus || []).filter((f) => f !== id); });
      if (d.airport?.island === id) d.airport.island = d.islands[0]?.id;
    } else if (kind === 'item') d.islands.forEach((i) => { i.items = i.items.filter((x) => x.id !== id); });
    else if (kind === 'link') d.links = d.links.filter((l) => l.id !== id);
    else if (kind === 'person') d.personTypes = d.personTypes.filter((t) => t.id !== id);
    else if (kind === 'value') { d.values = d.values.filter((v) => v.id !== id); d.islands.forEach((i) => { i.values = (i.values || []).filter((v) => v !== id); }); }
    else { console.error('可刪除：island | item | link | person | value'); process.exit(1); }
    if (JSON.stringify(d).length === before) { console.error('找不到', kind, id); process.exit(1); }
    console.log(`已刪除 ${kind} ${id}`);
    save(d, dry);
    return;
  }
  console.error('不認得的指令：', cmd, '（node tools/site.mjs help）');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
