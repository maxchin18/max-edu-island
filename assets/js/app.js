import { seasonByMonth } from './palette.js';

// MAX 教育理念島 — 介面主程式
// 內容全部來自 data/site.json（後台或 AI 只需要改那個檔案）

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d = null) { try { const v = localStorage.getItem('maxisland.' + k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('maxisland.' + k, v); } catch { /* 私密模式 */ } }
};
const pad = (n) => String(n).padStart(2, '0');
// Windows 沒有國旗 emoji：把兩個區域指示字母換成 Twemoji 國旗圖
const flagHtml = (s) => esc(s).replace(/([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/gu, (m, a, b) =>
  `<img class="flag" alt="${m}" src="https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${a.codePointAt(0).toString(16)}-${b.codePointAt(0).toString(16)}.svg">`);
const fmtHour = (h) => `${pad(Math.floor(h))}:${pad(Math.floor((h % 1) * 60))}`;

const state = {
  data: null, world: null, season: 'spring', seasonMode: 'auto', timeMode: 'auto',
  tab: 'islands', query: '', open: null, detail: null, focusType: null, logFilter: { link: '', type: '' },
  log: [], lastLog: 0, tools: { tags: false, items: true, links: false, pause: false, bird: false, log: false },
  popWalker: null
};

// ---------------- 資料 ----------------
async function loadData() {
  const params = new URLSearchParams(location.search);
  if (params.get('preview') === '1') {
    try {
      const draft = JSON.parse(localStorage.getItem('maxisland.draft'));
      if (draft?.data?.islands) { $('#previewBar').hidden = false; return normalize(draft.data); }
    } catch { /* 沒有草稿就讀正式資料 */ }
  }
  const res = await fetch(`data/site.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('無法讀取 data/site.json');
  return normalize(await res.json());
}

function normalize(d) {
  d.site ||= {};
  d.values ||= [];
  d.islands = (d.islands || []).filter((i) => i && i.id);
  d.islands.forEach((i) => { i.items ||= []; i.values ||= []; i.source ||= {}; i.items.forEach((it) => { it.points ||= []; }); });
  d.links = (d.links || []).filter((l) => l && l.from);
  d.links.forEach((l) => { l.to = Array.isArray(l.to) ? l.to : [l.to].filter(Boolean); });
  d.personTypes ||= [];
  d.personTypes.forEach((t) => { t.carry ||= []; t.homes ||= []; });
  d.seasons ||= { mode: 'auto', list: [] };
  d.seasons.list ||= [];
  d.airport ||= { enabled: false, partners: [] };
  return d;
}

const island = (id) => state.data.islands.find((i) => i.id === id);
const islandNo = (id) => pad(state.data.islands.findIndex((i) => i.id === id) + 1);
const valueOf = (id) => state.data.values.find((v) => v.id === id);
const seasonDef = (id) => state.data.seasons.list.find((s) => s.id === id);

// ---------------- 啟動 ----------------
async function boot() {
  try {
    state.data = await loadData();
  } catch (e) {
    $('#loading p').textContent = '資料讀取失敗：' + e.message;
    return;
  }
  const d = state.data;
  applySiteText(d.site);
  state.seasonMode = store.get('season', d.seasons.mode || 'auto');
  state.timeMode = store.get('time', d.site.timeMode || 'auto');
  renderIndex();
  buildLogFilters();
  bindUI();

  let World;
  try {
    ({ World } = await import('./world.js'));
    const quality = store.get('quality') || (matchMedia('(pointer: coarse)').matches || innerWidth < 820 ? 'standard' : 'high');
    const t0 = performance.now();
    state.world = new World($('#stage'), d, { quality });
    console.info(`[教育理念島] 3D 世界建置 ${Math.round(performance.now() - t0)} ms`);
  } catch (e) {
    console.error(e);
    showFallback(e);
    applySeason(true);
    return;
  }
  const w = state.world;
  buildLabels();
  w.on('pickIsland', (id) => openIsland(id, { fly: true }));
  w.on('pickWalker', ({ walker, x, y }) => openWalker(walker, x, y));
  w.on('pickNone', () => closeWalker());
  w.on('hover', (id) => $$('.isl-label').forEach((el) => el.classList.toggle('hover', el.dataset.id === id)));
  w.on('log', onWalkerEvent);
  w.on('flight', onFlightEvent);
  w.on('tick', onTick);
  w.on('quality', updateQualityButton);
  w.on('autoQuality', (q) => toast(`偵測到裝置較吃力，已自動切換為「${QUALITY_LABEL[q]}」畫質`));
  w.on('userCamera', () => { if (state.tools.bird) setTool('bird', false, true); });
  w.setTimeMode(state.timeMode);
  applySeason(true);
  applyTimeButtons();
  updateQualityButton(w.quality);
  setTimeout(() => $('#loading').classList.add('done'), 350);
  setTimeout(() => { $('#loading').hidden = true; }, 1300);
  routeFromHash();
  if (!store.get('toured') && !location.hash) setTimeout(() => openTour(0), 1600);
  setInterval(() => { if (state.seasonMode === 'auto') applySeason(); }, 60 * 1000);
}

function applySiteText(s) {
  const set = (id, v) => { if (v != null && v !== '') $(id).textContent = v; };
  set('#brandTop', s.brandTop); set('#brandBottom', s.brandBottom); set('#brandTitle', s.title);
  set('#brandBadge', s.badge); set('#brandSubtitle', s.subtitle); set('#indexKicker', s.indexKicker);
  set('#headline', s.headline); set('#footer', s.footer);
  if (s.pageTitle) document.title = s.pageTitle;
  if (s.description) document.querySelector('meta[name="description"]').content = s.description;
  const items = state.data.islands.reduce((a, i) => a + i.items.length, 0);
  $('#indexMeta').innerHTML = `${state.data.islands.length} 個理念主題 ／ ${items} 個實踐細項<br>${esc(s.intro || '')}`;
  $('#linkCount').textContent = state.data.links.length;
  $('#peopleCount').textContent = state.data.personTypes.length;
}

function showFallback(e) {
  $('#loading').classList.add('done');
  const f = document.createElement('div');
  f.className = 'fallback';
  f.innerHTML = `<div><p style="font-size:40px;margin:0">🏝️</p><p><b>這台裝置暫時無法顯示 3D 島嶼</b><br>可以直接使用右側清單瀏覽所有教育理念。</p><small>${esc(e?.message || '')}</small></div>`;
  $('#stage').appendChild(f);
}

// ---------------- 季節 ----------------
function currentSeason() {
  const list = state.data.seasons.list;
  if (state.seasonMode !== 'auto' && seasonDef(state.seasonMode)) return state.seasonMode;
  if (state.seasonMode !== 'auto' && ['spring', 'summer', 'autumn', 'winter'].includes(state.seasonMode)) return state.seasonMode;
  return list.length ? seasonByMonth(list, new Date().getMonth() + 1) : ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][new Date().getMonth()];
}

function applySeason(initial = false) {
  const id = currentSeason();
  const changed = id !== state.season || initial;
  state.season = id;
  const def = seasonDef(id) || { id, title: id, emoji: '', accent: '#E58A4A', tagline: '', focus: [] };
  const root = document.documentElement;
  root.style.setProperty('--accent', def.accent || '#E58A4A');
  document.querySelector('meta[name="theme-color"]').content = def.accent || '#E58A4A';
  $$('[data-season]').forEach((b) => b.classList.toggle('on', b.dataset.season === state.seasonMode));
  const auto = state.seasonMode === 'auto';
  $('#seasonChip').innerHTML = `${esc(def.emoji || '')} ${esc(def.title || '')}　<span style="font-weight:500;color:var(--ink2)">${auto ? '依日期自動換季' : '手動選擇'}</span>`;
  const focus = new Set(def.focus || []);
  $$('.isl-label').forEach((el) => {
    el.classList.toggle('is-focus', focus.has(el.dataset.id));
    const f = el.querySelector('.focus');
    if (f) f.textContent = `${def.emoji || ''} 本季焦點`;
  });
  $$('#listBody .row[data-island]').forEach((el) => {
    el.classList.toggle('focus-season', focus.has(el.dataset.island));
    el.dataset.focus = `${def.emoji || ''} 本季`;
  });
  if (state.world && changed) state.world.setSeason(id);
  if (changed && !initial) closeWalker();
  if (changed) seasonToast(def);
}

function seasonToast(def) {
  const t = $('#seasonToast');
  t.innerHTML = `<em>${esc(def.emoji || '')}</em><b>${esc(def.title || '')}</b><span>${esc(def.tagline || '')}</span>`;
  t.classList.add('show');
  clearTimeout(seasonToast.t);
  seasonToast.t = setTimeout(() => t.classList.remove('show'), 4200);
}

// ---------------- 時間 ----------------
function applyTimeButtons() {
  $$('[data-time]').forEach((b) => b.classList.toggle('on', b.dataset.time === state.timeMode));
}

function onTick({ hour, lightHour }) {
  const h = state.timeMode === 'auto' ? hour : lightHour;
  const txt = fmtHour(h);
  if (txt !== onTick.last) { $('#clock').textContent = txt; onTick.last = txt; }
  if (state.popWalker && !$('#walkerPop').hidden) positionPop();
}

// ---------------- 畫質 ----------------
const QUALITY_LABEL = { high: '高畫質', standard: '標準', low: '省電' };
const QUALITY_ICON = { high: '✨', standard: '⚖️', low: '🔋' };
function updateQualityButton(q) {
  $('#btnQuality').textContent = `${QUALITY_ICON[q]} ${QUALITY_LABEL[q]}`;
}

// ---------------- 島名標籤 ----------------
function buildLabels() {
  const wrap = $('#labels');
  wrap.innerHTML = '';
  const map = new Map();
  state.data.islands.forEach((isl, i) => {
    const b = document.createElement('button');
    b.className = 'isl-label';
    b.dataset.id = isl.id;
    b.style.setProperty('--c', isl.color);
    b.tabIndex = -1;
    b.innerHTML = `<span class="no">${pad(i + 1)}</span><span class="ic">${esc(isl.icon || '')}</span><span class="nm">${esc(isl.name)}</span><span class="focus"></span>`;
    b.addEventListener('click', () => openIsland(isl.id, { fly: true }));
    wrap.appendChild(b);
    map.set(isl.id, b);
  });
  state.world.setLabelElements(map);
}

// ---------------- 索引清單 ----------------
function renderIndex() {
  const body = $('#listBody');
  const q = state.query.trim().toLowerCase();
  const hl = (s) => {
    const t = esc(s);
    if (!q) return t;
    const i = String(s).toLowerCase().indexOf(q);
    if (i < 0) return t;
    return esc(String(s).slice(0, i)) + '<mark>' + esc(String(s).slice(i, i + q.length)) + '</mark>' + esc(String(s).slice(i + q.length));
  };
  const has = (...xs) => !q || xs.some((x) => String(x || '').toLowerCase().includes(q));

  if (state.tab === 'islands') {
    const def = seasonDef(state.season);
    const focus = new Set(def?.focus || []);
    let html = '';
    state.data.islands.forEach((isl, idx) => {
      const itemHits = isl.items.filter((it) => has(it.name, it.summary, it.target, (it.points || []).join(' ')));
      const selfHit = has(isl.name, isl.tagline, isl.quote);
      if (q && !selfHit && !itemHits.length) return;
      const open = state.open === isl.id || (q && itemHits.length);
      html += `<button class="row ${open ? 'open' : ''} ${focus.has(isl.id) ? 'focus-season' : ''}" data-island="${esc(isl.id)}" data-focus="${esc((def?.emoji || '') + ' 本季')}" style="--c:${esc(isl.color)}">
        <span class="no">${pad(idx + 1)}</span><span class="ic">${esc(isl.icon || '')}</span>
        <span class="tx"><strong>${hl(isl.name)}</strong><span>${hl(isl.tagline || '')}</span></span>
        <span class="cnt">${isl.items.length} ↗</span></button>`;
      if (open) {
        const list = q ? itemHits : isl.items;
        html += `<div class="sub" style="--c:${esc(isl.color)}"><button class="go" data-go="${esc(isl.id)}">走進這座島 ↗</button>
          ${list.map((it, k) => `<button class="item" data-island="${esc(isl.id)}" data-item="${esc(it.id)}"><i>${k + 1}</i>${hl(it.name)}</button>`).join('')}</div>`;
      }
    });
    body.innerHTML = html || `<p class="empty">找不到「${esc(state.query)}」相關的理念或做法</p>`;
  } else if (state.tab === 'links') {
    const html = state.data.links.filter((l) => has(l.id, l.title, l.basis, island(l.from)?.name, ...l.to.map((t) => island(t)?.name))).map((l) => {
      const A = island(l.from);
      return `<button class="link-row ${state.detail?.type === 'link' && state.detail.id === l.id ? 'on' : ''}" data-link="${esc(l.id)}" style="--c:${esc(A?.color || '#999')}">
        <span class="code">${esc(l.id)}</span><strong>${hl(l.title)}</strong>
        <span class="path"><span class="chip" style="--c:${esc(A?.color)}">${esc(A?.icon || '')} ${esc(A?.name || l.from)}</span> →
        ${l.to.map((t) => island(t)).filter(Boolean).map((B) => `<span class="chip" style="--c:${esc(B.color)}">${esc(B.icon || '')} ${esc(B.name)}</span>`).join('')}</span>
        <span class="basis">依據：${esc(l.basis || '—')}</span></button>`;
    }).join('');
    body.innerHTML = html || '<p class="empty">沒有符合的協作連結</p>';
  } else {
    const html = state.data.personTypes.filter((t) => has(t.name, t.desc, ...(t.carry || []).map((c) => c.name))).map((t) => `
      <button class="person ${state.focusType === t.id ? 'on' : ''}" data-person="${esc(t.id)}" style="--c:${esc(t.color)}">
        <span class="avatar">${esc(t.emoji || '🙂')}</span>
        <span><strong>${hl(t.name)}</strong> <span class="on-road" data-road="${esc(t.id)}"></span>
        <p>${hl(t.desc || '')}</p><span class="carry" title="會搬運的東西">${(t.carry || []).map((c) => esc(c.emoji)).join(' ')}</span></span>
      </button>`).join('');
    body.innerHTML = `<p class="person-hint">點一種人物，地圖上只會亮起他們，看看他們在搬運什麼。</p>${html || '<p class="empty">沒有符合的人物</p>'}`;
    updateRoadCounts();
  }
}

function updateRoadCounts() {
  if (!state.world) return;
  $$('[data-road]').forEach((el) => { el.textContent = `· ${state.world.walkers.countOnRoad(el.dataset.road)} 位在路上`; });
}

// ---------------- 詳情卡 ----------------
function showDetail(html, color) {
  const d = $('#detail');
  d.hidden = false;
  d.style.setProperty('--c', color || 'var(--accent)');
  d.innerHTML = `<button class="icon-btn close" id="detailClose" aria-label="關閉">✕</button><div class="detail-scroll">${html}</div>`;
  $('#detailClose').addEventListener('click', closeDetail);
  d.querySelector('.detail-scroll').scrollTop = 0;
}

function closeDetail() {
  $('#detail').hidden = true;
  state.detail = null;
  state.world?.select(null);
  $$('.isl-label').forEach((el) => el.classList.remove('on'));
  $('#labels').classList.remove('dim');
  setHash('');
  if (state.focusType) setFocusType(null);
  if (!state.tools.links) state.world?.setLinksVisible(false);
  renderIndex();
}

function valueTags(isl) {
  return (isl.values || []).map(valueOf).filter(Boolean).map((v) => `<span class="tag" style="--vc:${esc(v.color)}" title="${esc(v.desc || '')}"><span class="dot"></span>${esc(v.id)} · ${esc(v.name)}</span>`).join('');
}

function linksOf(id) {
  return state.data.links.filter((l) => l.from === id || l.to.includes(id));
}

function openIsland(id, { fly = false, item = null } = {}) {
  const isl = island(id);
  if (!isl) return;
  if (item) return openItem(id, item, { fly });
  state.detail = { type: 'island', id };
  state.open = id;
  const links = linksOf(id);
  const html = `
    <div class="d-top"><span class="d-icon">${esc(isl.icon || '')}</span>
      <div><p class="d-kicker">ISLAND ${islandNo(id)} · 理念</p><h2 class="d-title">${esc(isl.name)}</h2></div></div>
    <p class="d-tagline">${esc(isl.tagline || '')}</p>
    ${isl.quote ? `<p class="d-quote">「${esc(isl.quote)}」</p>` : ''}
    <div class="tags">${valueTags(isl)}<span class="tag">${isl.items.length} 個細項</span><span class="tag">${links.length} 條協作</span></div>
    <p class="d-sec">實踐細項</p>
    ${isl.items.map((it) => `<button class="item-btn" data-item="${esc(it.id)}"><span class="dot"></span>${esc(it.name)}<span class="ph">${esc(it.phase || '')} ›</span></button>`).join('') || '<p class="empty">尚未新增細項</p>'}
    ${links.length ? `<p class="d-sec">和誰一起做</p>${links.map((l) => collabRow(l, id)).join('')}` : ''}
    ${isl.source?.url ? `<a class="d-link" href="${esc(isl.source.url)}" target="_blank" rel="noopener">↗ ${esc(isl.source.label || '延伸閱讀')}</a>` : ''}`;
  showDetail(html, isl.color);
  $$('#detail .item-btn').forEach((b) => b.addEventListener('click', () => openItem(id, b.dataset.item)));
  bindCollabs();
  afterOpen(id, fly);
  setHash(`island=${id}`);
}

function collabRow(l, id) {
  const A = island(l.from);
  const others = l.from === id ? l.to : [l.from];
  const names = others.map(island).filter(Boolean);
  const dir = l.from === id ? '→' : '←';
  const label = names.length ? `${dir} ${esc(names[0].name)}${names.length > 1 ? ` 等 ${names.length} 處` : ''}` : '';
  return `<button class="collab" data-link="${esc(l.id)}" style="--c:${esc(A?.color)}"><span class="code">${esc(l.id)}</span>${label}<span style="margin-left:auto;color:var(--ink3);font-size:12px">${esc(l.title)}</span></button>`;
}

function bindCollabs() {
  $$('#detail .collab').forEach((b) => b.addEventListener('click', () => openLink(b.dataset.link)));
}

function openItem(id, itemId, { fly = false } = {}) {
  const isl = island(id);
  const it = isl?.items.find((x) => x.id === itemId);
  if (!it) return openIsland(id, { fly });
  state.detail = { type: 'item', id, item: itemId };
  state.open = id;
  const html = `
    <button class="back" id="backIsland">‹ ${esc(isl.name)}</button>
    <div class="d-top"><span class="d-icon">${esc(isl.icon || '')}</span>
      <div><p class="d-kicker">${esc(isl.name)} · 實踐細項</p><h2 class="d-title">${esc(it.name)}</h2></div></div>
    <div class="tags">${valueTags(isl)}${it.phase ? `<span class="tag dark">${esc(it.phase)}</span>` : ''}${it.target ? `<span class="tag">對象：${esc(it.target)}</span>` : ''}</div>
    ${it.summary ? `<p class="d-summary">${esc(it.summary)}</p>` : ''}
    ${it.image ? `<img class="d-img" src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy">` : ''}
    ${it.schedule ? `<div class="timeline-card"><strong>推動時程</strong><p>${esc(it.schedule)}</p></div>` : ''}
    ${(it.points || []).length ? `<p class="d-sec">重點</p><ul class="points">${it.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    ${linksOf(id).length ? `<p class="d-sec">和誰一起做</p>${linksOf(id).map((l) => collabRow(l, id)).join('')}` : ''}
    ${it.link ? `<a class="d-link" href="${esc(it.link)}" target="_blank" rel="noopener">↗ 相關資源</a>` : ''}`;
  showDetail(html, isl.color);
  $('#backIsland').addEventListener('click', () => openIsland(id));
  bindCollabs();
  afterOpen(id, fly);
  setHash(`island=${id}&item=${itemId}`);
}

function afterOpen(id, fly) {
  const w = state.world;
  if (w) {
    w.select(id);
    if (fly || !openIsland.flewTo || openIsland.flewTo !== id) w.focusIsland(id);
    openIsland.flewTo = id;
  }
  $$('.isl-label').forEach((el) => el.classList.toggle('on', el.dataset.id === id));
  $('#labels').classList.add('dim');
  if (state.tab === 'islands') renderIndex();
  closeWalker();
  if (innerWidth < 820) $('#panel').dataset.sheet = 'peek';
}

function openLink(linkId) {
  const l = state.data.links.find((x) => x.id === linkId);
  if (!l) return;
  const A = island(l.from);
  state.detail = { type: 'link', id: linkId };
  const walkers = state.world ? state.world.walkers.list.filter((w) => w.link?.id === linkId && w.state === 'walk') : [];
  const html = `
    <div class="d-top"><span class="d-icon">🔗</span><div><p class="d-kicker">COLLAB ${esc(l.id)} · 協作連結</p><h2 class="d-title">${esc(l.title)}</h2></div></div>
    <div class="tags"><span class="tag dark">依據：${esc(l.basis || '—')}</span><span class="tag">${walkers.length} 位正在這條線上搬運</span></div>
    <p class="d-sec">從</p>
    <button class="item-btn" data-isl="${esc(l.from)}" style="--c:${esc(A?.color)}"><span class="dot"></span>${esc(A?.icon || '')} ${esc(A?.name || l.from)}<span class="ph">打開 ›</span></button>
    <p class="d-sec">連到</p>
    ${l.to.map(island).filter(Boolean).map((B) => `<button class="item-btn" data-isl="${esc(B.id)}" style="--c:${esc(B.color)}"><span class="dot"></span>${esc(B.icon || '')} ${esc(B.name)}<span class="ph">打開 ›</span></button>`).join('')}
    ${walkers.length ? `<p class="d-sec">正在路上</p>${walkers.slice(0, 8).map((w) => `<div class="collab" style="--c:${esc(w.type.color)}">${esc(w.type.emoji || '')} ${esc(w.type.name)} → ${esc(island(w.dest)?.name || '')}<span style="margin-left:auto">${esc(w.carry?.emoji || '')} ${esc(w.carry?.name || '')}</span></div>`).join('')}` : ''}`;
  showDetail(html, A?.color);
  $$('#detail [data-isl]').forEach((b) => b.addEventListener('click', () => openIsland(b.dataset.isl, { fly: true })));
  if (state.world) {
    state.world.setLinksVisible(true);
    state.world.highlightLinks({ linkId });
    state.world.select(null);
    state.world.focusIsland(l.from);
  }
  setHash(`link=${linkId}`);
  if (state.tab === 'links') renderIndex();
}

function openPerson(typeId) {
  const t = state.data.personTypes.find((x) => x.id === typeId);
  if (!t) return;
  if (state.focusType === typeId) { setFocusType(null); closeDetail(); return; }
  setFocusType(typeId);
  state.detail = { type: 'person', id: typeId };
  const homes = (t.homes || []).map(island).filter(Boolean);
  const html = `
    <div class="d-top"><span class="d-icon">${esc(t.emoji || '🙂')}</span><div><p class="d-kicker">PEOPLE · 人物類型</p><h2 class="d-title">${esc(t.name)}</h2></div></div>
    <p class="d-tagline">${esc(t.desc || '')}</p>
    <div class="tags"><span class="tag dark">島上共 ${esc(t.count || 0)} 位</span><span class="tag" id="personRoad"></span></div>
    <p class="d-sec">會搬運的東西</p>
    <div class="tags">${(t.carry || []).map((c) => `<span class="tag">${esc(c.emoji)} ${esc(c.name)}</span>`).join('')}</div>
    <p class="d-sec">常去的島</p>
    ${homes.length ? homes.map((B) => `<button class="item-btn" data-isl="${esc(B.id)}" style="--c:${esc(B.color)}"><span class="dot"></span>${esc(B.icon || '')} ${esc(B.name)}<span class="ph">打開 ›</span></button>`).join('') : '<p class="meta">每一座島都會去。</p>'}
    <button class="btn" id="unfocus" style="margin-top:14px">取消聚焦，顯示所有人</button>`;
  showDetail(html, t.color);
  $('#personRoad').textContent = `${state.world?.walkers.countOnRoad(typeId) ?? 0} 位在路上`;
  $$('#detail [data-isl]').forEach((b) => b.addEventListener('click', () => openIsland(b.dataset.isl, { fly: true })));
  $('#unfocus').addEventListener('click', () => { setFocusType(null); closeDetail(); });
  setHash(`person=${typeId}`);
}

function setFocusType(id) {
  state.focusType = id;
  state.world?.walkers.setFocusType(id);
  if (state.tab === 'people') renderIndex();
}

// ---------------- 小人泡泡 ----------------
function openWalker(w) {
  state.popWalker = w;
  const pop = $('#walkerPop');
  const from = island(w.island), to = island(w.dest);
  const walking = w.state === 'walk';
  pop.style.setProperty('--c', w.type.color);
  pop.innerHTML = `<div class="wp-head"><span class="avatar">${esc(w.type.emoji || '🙂')}</span><div><strong>${esc(w.type.name)}</strong><br>
    <span style="font-size:12px;color:var(--ink3)">${walking ? `正從 ${esc(from?.name || '')} 前往 ${esc(to?.name || '')}` : `在 ${esc(from?.name || '')} 交接中`}</span></div></div>
    <p class="carry-big">搬運：${esc(w.carry?.emoji || '📦')} ${esc(w.carry?.name || '物資')}</p>
    ${w.link ? `<p><b style="color:var(--c)">${esc(w.link.id)}</b> ${esc(w.link.title)}</p>` : ''}
    <p>${esc(w.type.desc || '')}</p>`;
  pop.hidden = false;
  positionPop();
}

function positionPop() {
  const w = state.popWalker;
  if (!w || !state.world) return;
  const p = w.group.position.clone();
  p.y += 2.6;
  const s = state.world.project(p);
  const pop = $('#walkerPop');
  if (!s.visible) { pop.hidden = true; return; }
  const stage = $('#stage').getBoundingClientRect();
  pop.style.left = `${Math.max(130, Math.min(stage.width - 130, s.x))}px`;
  pop.style.top = `${Math.max(pop.offsetHeight + 30, s.y)}px`;
}

function closeWalker() {
  state.popWalker = null;
  $('#walkerPop').hidden = true;
}

// ---------------- 日誌 ----------------
function buildLogFilters() {
  const ls = $('#logLink'), ts = $('#logType');
  state.data.links.forEach((l) => ls.insertAdjacentHTML('beforeend', `<option value="${esc(l.id)}">${esc(l.id)} ${esc(l.title.slice(0, 16))}${l.title.length > 16 ? '…' : ''}</option>`));
  state.data.personTypes.forEach((t) => ts.insertAdjacentHTML('beforeend', `<option value="${esc(t.id)}">${esc(t.emoji || '')} ${esc(t.name)}</option>`));
  ls.addEventListener('change', () => { state.logFilter.link = ls.value; renderLog(); });
  ts.addEventListener('change', () => { state.logFilter.type = ts.value; renderLog(); });
}

const KIND = { depart: '出發', arrive: '抵達', handoff: '交接', flight: '航班' };

function onWalkerEvent(e) {
  const filtered = state.logFilter.link || state.logFilter.type;
  const match = (!state.logFilter.link || e.link?.id === state.logFilter.link) && (!state.logFilter.type || e.walker.type.id === state.logFilter.type);
  const now = performance.now();
  if (!filtered && now - state.lastLog < 1100) return;
  if (filtered && !match) return;
  state.lastLog = now;
  const t = e.walker.type;
  const to = island(e.to)?.name || '';
  const verb = e.kind === 'depart' ? `前往 ${esc(to)}` : e.kind === 'arrive' ? `抵達 ${esc(to)}` : `在 ${esc(to)} 交接`;
  pushLog({
    kind: e.kind, link: e.link?.id || '', type: t.id, color: island(e.link?.from)?.color || t.color,
    html: `${e.link ? `<span class="code">${esc(e.link.id)}</span>｜` : ''}${esc(t.emoji || '')} ${esc(t.name)} ${verb} · ${esc(e.carry?.emoji || '')} ${esc(e.carry?.name || '')}`
  });
}

function onFlightEvent(e) {
  const ap = state.data.airport || {};
  const partners = ap.partners?.length ? ap.partners : [{ flag: '🌏', name: '國際夥伴', carry: '交流邀請' }];
  const p = partners[Math.floor(Math.random() * partners.length)];
  const dest = island(ap.island)?.name || '國際教育';
  pushLog({
    kind: 'flight', link: '', type: 'global-partner', color: island(ap.island)?.color || '#3CC1C7',
    html: e.kind === 'arrive'
      ? `✈️ 交流班機降落：${flagHtml(p.flag)} ${esc(p.name)} 帶來「${esc(p.carry)}」，送往 ${esc(dest)}`
      : `✈️ 交流班機起飛：帶著台江的故事飛向 ${flagHtml(p.flag)} ${esc(p.name)}`
  }, true);
}

function pushLog(entry, force = false) {
  entry.time = fmtHour(state.world?.clockHour ?? 0);
  state.log.unshift(entry);
  state.log.length = Math.min(state.log.length, 120);
  if (!$('#logView').hidden && !$('#logBody').hidden) {
    if (!passFilter(entry) && !force) return;
    const li = logItem(entry);
    const list = $('#logList');
    list.querySelectorAll('.empty').forEach((x) => x.remove());
    list.prepend(li);
    while (list.children.length > 80) list.lastChild.remove();
  }
}

function passFilter(e) {
  return (!state.logFilter.link || e.link === state.logFilter.link) && (!state.logFilter.type || e.type === state.logFilter.type);
}

function logItem(e) {
  const li = document.createElement('li');
  li.style.setProperty('--c', e.color);
  li.innerHTML = `<span class="kind ${e.kind}">${KIND[e.kind]}</span><span><time>${e.time}</time>${e.html}</span>`;
  return li;
}

function renderLog() {
  const list = $('#logList');
  list.innerHTML = '';
  state.log.filter(passFilter).slice(0, 80).forEach((e) => list.appendChild(logItem(e)));
  if (!list.children.length) list.innerHTML = '<li style="display:block;border:0" class="empty">等等，島上的人正在出發…</li>';
}

function renderOverview() {
  const d = state.data;
  const items = d.islands.reduce((a, i) => a + i.items.length, 0);
  const road = state.world ? state.world.walkers.countOnRoad() : 0;
  const basis = {};
  d.links.forEach((l) => { basis[l.basis || '其他'] = (basis[l.basis || '其他'] || 0) + 1; });
  const max = Math.max(1, ...d.values.map((v) => d.islands.filter((i) => i.values.includes(v.id)).length));
  $('#overviewBody').innerHTML = `
    <div class="ov-tiles">
      <div class="ov-tile" style="--c:#F07C5A"><b>${d.islands.length}</b><span>理念島</span></div>
      <div class="ov-tile" style="--c:#F2C94C"><b>${items}</b><span>實踐細項</span></div>
      <div class="ov-tile" style="--c:#5B8DEF"><b>${d.links.length}</b><span>協作連結</span></div>
      <div class="ov-tile" style="--c:#4CC3A0"><b>${road}</b><span>位在路上</span></div>
    </div>
    <p class="ov-sec">價值面向</p>
    ${d.values.map((v) => { const n = d.islands.filter((i) => i.values.includes(v.id)).length; return `<div class="bar-row" style="--vc:${esc(v.color)}" title="${esc(v.desc || '')}"><span class="letter">${esc(v.id)}</span><span><span style="font-size:12px">${esc(v.name)} ${esc(v.en || '')}</span><span class="bar"><i style="width:${(n / max) * 100}%"></i></span></span><b>${n}</b></div>`; }).join('')}
    <p class="meta" style="margin:6px 4px 0;font-size:12px">各價值面向被標記的理念數（一個理念可同時標記多個面向）</p>
    <p class="ov-sec">協作依據</p>
    <div class="tags" style="margin:0 4px">${Object.entries(basis).map(([k, n]) => `<span class="tag">${esc(k)} · ${n}</span>`).join('')}</div>
    <p class="ov-sec">各島細項數</p>
    <div class="ov-grid">${d.islands.map((i) => `<button data-isl="${esc(i.id)}" style="--c:${esc(i.color)}">${esc(i.icon || '')} ${esc(i.name)}<b>${i.items.length}</b></button>`).join('')}</div>
    <p class="ov-sec">人物在路上</p>
    <div class="ov-grid">${d.personTypes.map((t) => `<button data-per="${esc(t.id)}" style="--c:${esc(t.color)}">${esc(t.emoji || '')} ${esc(t.name)}<b>${state.world ? state.world.walkers.countOnRoad(t.id) : 0}/${esc(t.count || 0)}</b></button>`).join('')}</div>`;
  $$('#overviewBody [data-isl]').forEach((b) => b.addEventListener('click', () => openIsland(b.dataset.isl, { fly: true })));
  $$('#overviewBody [data-per]').forEach((b) => b.addEventListener('click', () => openPerson(b.dataset.per)));
}

function setLogTab(tab) {
  $$('[data-ltab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ltab === tab)));
  $('#overviewBody').hidden = tab !== 'overview';
  $('#logBody').hidden = tab !== 'log';
  if (tab === 'overview') renderOverview(); else renderLog();
}

// ---------------- 工具列 ----------------
function setTool(name, on, silent = false) {
  state.tools[name] = on;
  const btn = $(`[data-tool="${name}"]`);
  btn?.setAttribute('aria-pressed', String(on));
  const w = state.world;
  if (name === 'tags') w?.walkers.setTags(on);
  if (name === 'items') w?.walkers.setItems(on);
  if (name === 'links') { w?.setLinksVisible(on); if (on) w?.highlightLinks({ islandId: state.detail?.type === 'island' ? state.detail.id : null }); }
  if (name === 'pause') w?.setPaused(on);
  if (name === 'bird' && !silent) w?.setBirdEye(on);
  if (name === 'log') {
    $('#indexView').hidden = on;
    $('#logView').hidden = !on;
    if (on) { setLogTab($('[data-ltab][aria-selected="true"]').dataset.ltab); showPanel(true); }
  }
}

function showPanel(on) {
  $('#app').classList.toggle('panel-hidden', !on);
  if (innerWidth < 820) $('#panel').dataset.sheet = on ? 'half' : 'peek';
}

// ---------------- 導覽 ----------------
function openTour(i) {
  const steps = state.data.site.tutorial?.length ? state.data.site.tutorial : [{ title: '歡迎來到教育理念島', body: '點一座島，開始探索。' }];
  if (i >= steps.length) return closeTour();
  openTour.i = i;
  $('#tour').hidden = false;
  $('#tourKicker').textContent = `HELLO, ${(state.data.site.badge || 'MAX').toUpperCase()} / ${pad(i + 1)}`;
  $('#tourTitle').textContent = steps[i].title;
  $('#tourBody').textContent = steps[i].body;
  $('#tourDots').innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  $('#tourNext').textContent = i === steps.length - 1 ? '走進島嶼 →' : '下一步 →';
  $('#tourNext').focus();
}
function closeTour() { $('#tour').hidden = true; store.set('toured', '1'); }

// ---------------- 分享與網址 ----------------
function setHash(h) {
  const url = location.pathname + location.search + (h ? '#' + h : '');
  history.replaceState(null, '', url);
}

function routeFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('island')) openIsland(p.get('island'), { fly: true, item: p.get('item') });
  else if (p.get('link')) openLink(p.get('link'));
  else if (p.get('person')) { setTab('people'); openPerson(p.get('person')); }
}

async function share() {
  const url = location.href.replace(/\?preview=1/, '');
  try {
    if (navigator.share && innerWidth < 820) await navigator.share({ title: document.title, url });
    else { await navigator.clipboard.writeText(url); toast('已複製這個畫面的連結'); }
  } catch { /* 使用者取消 */ }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function setTab(tab) {
  state.tab = tab;
  $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  renderIndex();
}

// ---------------- 事件綁定 ----------------
function bindUI() {
  $$('[data-season]').forEach((b) => b.addEventListener('click', () => {
    state.seasonMode = b.dataset.season;
    store.set('season', state.seasonMode);
    applySeason(false);
    if (state.seasonMode === 'auto') toast('已改為依日期自動換季（每三個月）');
  }));
  $$('[data-time]').forEach((b) => b.addEventListener('click', () => {
    state.timeMode = b.dataset.time;
    store.set('time', state.timeMode);
    state.world?.setTimeMode(state.timeMode);
    applyTimeButtons();
  }));
  $$('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool, !state.tools[b.dataset.tool])));
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $$('[data-ltab]').forEach((b) => b.addEventListener('click', () => setLogTab(b.dataset.ltab)));
  $('#logClose').addEventListener('click', () => setTool('log', false));

  $('#listBody').addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) return openIsland(go.dataset.go, { fly: true });
    const item = e.target.closest('[data-item]');
    if (item) return openItem(item.dataset.island, item.dataset.item, { fly: true });
    const row = e.target.closest('.row[data-island]');
    if (row) {
      const id = row.dataset.island;
      state.open = state.open === id ? null : id;
      renderIndex();
      if (state.open) { state.world?.select(id); state.world?.focusIsland(id); }
      return;
    }
    const link = e.target.closest('[data-link]');
    if (link) return openLink(link.dataset.link);
    const per = e.target.closest('[data-person]');
    if (per) return openPerson(per.dataset.person);
  });

  let qt;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(qt);
    qt = setTimeout(() => { state.query = e.target.value; renderIndex(); }, 120);
  });

  $('#btnHome').addEventListener('click', () => { closeDetail(); closeWalker(); setTool('bird', false, true); state.world?.flyHome(); });
  $('#btnList').addEventListener('click', () => showPanel($('#app').classList.contains('panel-hidden')));
  $('#btnHelp').addEventListener('click', () => openTour(0));
  $('#btnShare').addEventListener('click', share);
  $('#btnQuality').addEventListener('click', () => {
    if (!state.world) return;
    const order = ['high', 'standard', 'low'];
    const next = order[(order.indexOf(state.world.quality) + 1) % order.length];
    state.world.applyQuality(next);
    store.set('quality', next);
    toast(`畫質：${QUALITY_LABEL[next]}`);
  });
  $('#tourNext').addEventListener('click', () => openTour((openTour.i || 0) + 1));
  $('#tourSkip').addEventListener('click', closeTour);
  $('#sheetHandle').addEventListener('click', () => {
    const p = $('#panel');
    const order = ['peek', 'half', 'full'];
    p.dataset.sheet = order[(order.indexOf(p.dataset.sheet || 'peek') + 1) % order.length];
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#tour').hidden) return closeTour();
      if (!$('#walkerPop').hidden) return closeWalker();
      if (!$('#detail').hidden) return closeDetail();
    }
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); $('#search').focus(); }
  });
  addEventListener('hashchange', routeFromHash);
  setInterval(() => {
    if (state.tab === 'people') updateRoadCounts();
    if (!$('#overviewBody').hidden && !$('#logView').hidden) renderOverview();
  }, 3000);
}

// 給除錯與 AI 自動化檢查用
window.maxIsland = { state };

boot();
