/* MAX 教育理念島｜後台管理
 * 純 HTML / CSS / JS，不需建置。資料來源：../data/site.json
 * 儲存模式：本機（node server.js）、GitHub（Contents API）、離線（只能匯出 JSON）
 * 草稿：localStorage['maxisland.draft'] = { savedAt, data }，前台 ?preview=1 會讀取。
 */
(function () {
  'use strict';

  /* =====================================================================
   * 常數
   * ===================================================================== */
  const DRAFT_KEY = 'maxisland.draft';
  const LASTMODE_KEY = 'maxisland.admin.lastMode';
  const GHCONF_KEY = 'maxisland.admin.github';
  const TOKEN_KEY = 'maxisland.admin.ghToken';
  const COMMIT_MESSAGE = '更新教育理念島資料（後台）';
  const WALKER_WARN = 120;
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
  const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

  const SECTIONS = [
    { id: 'overview', label: '總覽', icon: '🏝️' },
    { id: 'site', label: '網站設定', icon: '⚙️' },
    { id: 'islands', label: '理念島嶼', icon: '🗺️' },
    { id: 'links', label: '協作連結', icon: '🔗' },
    { id: 'persons', label: '人物類型', icon: '🚶' },
    { id: 'airport', label: '國際航線', icon: '✈️' },
    { id: 'values', label: '價值面向', icon: '💎' },
    { id: 'seasons', label: '四季設定', icon: '🍃' },
    { id: 'options', label: '選項清單', icon: '📋' },
    { id: 'data', label: '資料', icon: '💾' }
  ];

  const LANDMARKS = [
    ['school', '學校'], ['farm', '農場'], ['harbor', '漁港'], ['library', '圖書館'],
    ['tech', '科技實驗室'], ['sports', '運動場'], ['temple', '廟宇'], ['heart', '心靈涼亭'],
    ['hall', '會議廳'], ['home', '家屋'], ['garden', '溫室花園'], ['art', '藝廊'],
    ['puzzle', '積木'], ['globe', '地球儀']
  ];
  const TIME_MODES = [['auto', '自動流動'], ['dawn', '清晨'], ['day', '白天'], ['dusk', '黃昏'], ['night', '夜晚']];
  const SEASON_MODES = [['auto', '自動依月份'], ['spring', '固定春'], ['summer', '固定夏'], ['autumn', '固定秋'], ['winter', '固定冬']];
  const PARTICLES = [['petal', '花瓣 🌸'], ['firefly', '螢火蟲 ✨'], ['leaf', '落葉 🍂'], ['snow', '雪花 ❄️']];
  const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_DEFAULTS = {
    spring: { id: 'spring', name: '春', title: '春', emoji: '🌸', months: [3, 4, 5], tagline: '', accent: '#E2789A', focus: [], particle: 'petal' },
    summer: { id: 'summer', name: '夏', title: '夏', emoji: '☀️', months: [6, 7, 8], tagline: '', accent: '#2FA9C7', focus: [], particle: 'firefly' },
    autumn: { id: 'autumn', name: '秋', title: '秋', emoji: '🍁', months: [9, 10, 11], tagline: '', accent: '#E58A4A', focus: [], particle: 'leaf' },
    winter: { id: 'winter', name: '冬', title: '冬', emoji: '❄️', months: [12, 1, 2], tagline: '', accent: '#5B8CC9', focus: [], particle: 'snow' }
  };

  const ISLAND_EMOJIS = ['🧒', '🥬', '🐟', '📚', '🤖', '🏃', '🏮', '💛', '🍎', '🏡', '🌍', '🎨', '🧩', '✈️', '🌱', '🔬', '🎵', '🧪', '🏫', '🌊', '🌻', '🧠', '⚽', '💡'];
  const PERSON_EMOJIS = ['🎒', '🧑‍🏫', '👪', '👩‍🌾', '🎣', '👴', '👵', '🙋', '🎓', '🌏', '👩‍🍳', '🧑‍🔬', '🧑‍🎨', '🧑‍⚕️', '👷', '🧑‍💻', '👧', '👦', '🧑‍🚒', '👮', '🧑‍🎤', '🦸', '🚶', '🐕'];
  const CARRY_EMOJIS = ['📒', '🎨', '🥬', '📘', '📋', '💻', '📚', '🍱', '🤝', '💬', '🧺', '🌾', '🌱', '🐟', '🦪', '📦', '🌳', '🔬', '📊', '🏮', '📜', '✉️', '🎁', '💡'];
  const FLAG_EMOJIS = ['🇯🇵', '🇰🇷', '🇺🇸', '🇻🇳', '🇦🇺', '🇫🇷', '🇬🇧', '🇩🇪', '🇨🇦', '🇳🇿', '🇸🇬', '🇹🇭', '🇮🇩', '🇵🇭', '🇲🇾', '🇮🇳', '🇪🇸', '🇮🇹', '🇳🇱', '🇫🇮', '🇸🇪', '🇧🇷', '🇲🇽', '🇹🇼'];

  const SITE_GROUPS = [
    {
      title: '網頁資訊', desc: '顯示在瀏覽器分頁、搜尋結果與社群分享。',
      fields: [
        { key: 'pageTitle', label: '網頁標題', hint: '瀏覽器分頁與分享連結上的標題。', wide: true },
        { key: 'description', label: '網站描述', hint: '搜尋引擎與社群分享的摘要，約 50–100 字。', multiline: true, wide: true }
      ]
    },
    {
      title: '品牌與標題', desc: '網站左上角的品牌字與主標題區。',
      fields: [
        { key: 'brandTop', label: '品牌字（上排）', hint: '例如 GROW' },
        { key: 'brandBottom', label: '品牌字（下排）', hint: '例如 TOGETHER.' },
        { key: 'badge', label: '徽章文字', hint: '標題旁的小徽章，例如 MAX' },
        { key: 'subtitle', label: '副標題', hint: '例如「教育理念島」' },
        { key: 'title', label: '主標題', hint: '網站最主要的一句話。', wide: true }
      ]
    },
    {
      title: '首頁文案', desc: '島嶼清單與頁尾的文字。',
      fields: [
        { key: 'indexKicker', label: '清單小標', hint: '島嶼清單上方的英文小字，例如 THE EDUCATION INDEX' },
        { key: 'headline', label: '大標語' },
        { key: 'intro', label: '引導文字', multiline: true, wide: true },
        { key: 'footer', label: '頁尾文字', wide: true }
      ]
    }
  ];

  /* =====================================================================
   * 狀態
   * ===================================================================== */
  const S = {
    mode: null,            // 'local' | 'github' | 'offline'
    data: null,            // 工作中的資料（整份）
    publishedStr: '',      // 已發布版本（正規化後）的 JSON 字串，用來判斷是否有未發布修改
    section: 'overview',
    gh: { owner: '', repo: '', branch: 'main', path: 'data/site.json', token: '', sha: null },
    layers: [],
    busy: false,
    draftSavedAt: null,
    warnedQuota: false,
    uploadPreview: {},     // 上傳後的路徑 → blob URL（GitHub Pages 尚未部署前也能預覽）
    linkFilter: '',
    localOk: null
  };

  /* =====================================================================
   * 小工具
   * ===================================================================== */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad2 = (n) => String(n).padStart(2, '0');
  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const str = (v) => (v == null ? '' : String(v));
  const arrOf = (v) => (Array.isArray(v) ? v : []);
  const def = (o, k, v) => { if (o[k] == null) o[k] = v; };
  let elSeq = 0;
  const elId = (p) => `${p || 'f'}-${++elSeq}`;
  const randId = (n) => {
    let s = '';
    while (s.length < n) s += Math.random().toString(36).slice(2);
    return s.slice(0, n);
  };
  const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
  const isHex = (c) => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
  const toHex6 = (c) => {
    c = c.trim();
    if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return c.toUpperCase();
  };
  const safeColor = (c) => (isHex(c) ? toHex6(c) : '#9AABA5');
  const isHttp = (u) => /^https?:\/\//i.test(str(u).trim());
  const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));
  const sum = (arr, fn) => arr.reduce((n, x) => n + fn(x), 0);
  const clampInt = (v, min, max) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  };

  function debounce(fn, ms) {
    let t = null;
    const d = () => { clearTimeout(t); t = setTimeout(() => { t = null; fn(); }, ms); };
    d.flush = () => { if (t) { clearTimeout(t); t = null; fn(); } };
    return d;
  }

  function moveInArray(arr, from, to) {
    if (to < 0 || to >= arr.length || from === to) return false;
    const x = arr.splice(from, 1)[0];
    arr.splice(to, 0, x);
    return true;
  }
  const mvKeys = (prefix, idx, dir) => [`${prefix}-${dir}-${idx}`, `${prefix}-${dir === 'up' ? 'down' : 'up'}-${idx}`];

  function fmtTime(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function fmtClock(v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function fmtDur(sec) {
    if (sec < 90) return `${Math.round(sec)} 秒`;
    const m = sec / 60;
    if (m < 90) return `${Math.round(m * 10) / 10} 分鐘`;
    return `${Math.round(m / 6) / 10} 小時`;
  }
  function todayStamp() {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  }
  function countBy(list) {
    const m = new Map();
    list.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
    return m;
  }

  const store = {
    get(area, k) { try { return window[area].getItem(k); } catch (e) { return null; } },
    set(area, k, v) { try { window[area].setItem(k, v); return true; } catch (e) { return false; } },
    del(area, k) { try { window[area].removeItem(k); } catch (e) { /* 忽略 */ } }
  };
  function readStoredJSON(k) {
    const raw = store.get('localStorage', k);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* =====================================================================
   * DOM 建構（全部用 textContent，不把資料塞進 innerHTML）
   * ===================================================================== */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const BOOL_PROPS = ['checked', 'disabled', 'hidden', 'selected', 'multiple', 'required'];

  function setProps(el, props, isSvg) {
    if (!props) return;
    Object.keys(props).forEach((k) => {
      const v = props[k];
      if (v == null || v === false || k === 'value') return;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') {
        Object.keys(v).forEach((sk) => {
          if (v[sk] == null) return;
          if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]);
          else el.style[sk] = v[sk];
        });
      } else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (!isSvg && BOOL_PROPS.includes(k)) el[k] = true;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function addKids(el, kids) {
    const walk = (k) => {
      if (k == null || k === false || k === true) return;
      if (Array.isArray(k)) { k.forEach(walk); return; }
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    };
    walk(kids);
  }
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    setProps(el, props, false);
    addKids(el, kids);
    if (props && props.value != null) el.value = props.value;
    return el;
  }
  function sv(tag, props, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    setProps(el, props, true);
    addKids(el, kids);
    return el;
  }
  function focusFk(root, ...keys) {
    for (const k of keys) {
      if (!k) continue;
      const el = (root || document).querySelector(`[data-fk="${cssEsc(k)}"]`);
      if (el && !el.disabled) { el.focus(); return true; }
    }
    return false;
  }
  function flash(el) {
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1800);
  }

  /* =====================================================================
   * 通知（toast）
   * ===================================================================== */
  function toast(msg, type, opts) {
    type = type || 'ok';
    opts = opts || {};
    const box = $('#toasts');
    const icons = { ok: '✓', error: '!', warn: '!', info: 'i' };
    const el = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : null },
      h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, icons[type] || ''),
      h('span', { class: 'toast-msg' }, msg));
    let timer = null;
    const remove = () => {
      clearTimeout(timer);
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    };
    if (opts.action) {
      el.dataset.action = '1';
      el.append(h('button', { type: 'button', class: 'toast-action', onclick: () => { remove(); opts.action.run(); } }, opts.action.label));
    }
    el.append(h('button', { type: 'button', class: 'toast-close', 'aria-label': '關閉通知', onclick: remove }, '✕'));
    box.append(el);
    while (box.children.length > 4) box.firstElementChild.remove();
    timer = setTimeout(remove, opts.ms || (type === 'error' ? 8000 : opts.action ? 7000 : 3600));
    return remove;
  }

  /* =====================================================================
   * 對話框 / 側邊抽屜
   * ===================================================================== */
  function focusables(root) {
    return Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.classList.contains('sr-only') && (el.offsetParent !== null || el.getClientRects().length));
  }

  function openLayer(opt) {
    const kind = opt.kind || 'modal';
    const titleId = elId('dlg');
    const prevFocus = document.activeElement;
    const dismissable = opt.dismissable !== false;
    const layer = { dirty: false, dismissable, closed: false };

    const closeBtn = dismissable
      ? h('button', { type: 'button', class: 'icon-btn layer-x', 'aria-label': '關閉', onclick: () => layer.requestClose() }, '✕')
      : null;
    const titleEl = h('h2', { id: titleId, class: 'layer-title' }, opt.title);
    const bodyEl = h('div', { class: 'layer-body' }, opt.body);
    const panel = h('div', {
      class: `layer-panel layer-${kind}${opt.wide ? ' is-wide' : ''}`,
      role: opt.role || 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1'
    },
      h('header', { class: 'layer-head' }, h('div', { class: 'layer-titles' }, titleEl, opt.subtitle ? h('p', { class: 'layer-sub' }, opt.subtitle) : null), closeBtn),
      bodyEl,
      opt.footer ? h('footer', { class: 'layer-foot' }, opt.footer) : null);
    const wrap = h('div', { class: `layer-wrap wrap-${kind}` },
      h('div', { class: 'layer-backdrop', onclick: () => { if (dismissable) layer.requestClose(); } }),
      panel);

    Object.assign(layer, { wrap, panel, body: bodyEl, titleEl });
    layer.close = () => {
      if (layer.closed) return;
      layer.closed = true;
      const i = S.layers.indexOf(layer);
      if (i >= 0) S.layers.splice(i, 1);
      wrap.remove();
      if (!S.layers.length) document.body.classList.remove('has-layer');
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      if (opt.onClose) opt.onClose();
    };
    layer.requestClose = async () => {
      if (layer.closed) return;
      if (opt.onRequestClose) {
        const ok = await opt.onRequestClose(layer);
        if (!ok) return;
      }
      layer.close();
    };

    // 打開對話框時，收掉帶「復原」按鈕的通知，避免資料參照錯亂
    document.querySelectorAll('.toast[data-action]').forEach((t) => t.remove());
    S.layers.push(layer);
    $('#layers').append(wrap);
    document.body.classList.add('has-layer');
    requestAnimationFrame(() => {
      let f = typeof opt.initialFocus === 'function' ? opt.initialFocus() : opt.initialFocus;
      if (!f) f = focusables(bodyEl)[0];
      (f || panel).focus({ preventScroll: true });
    });
    return layer;
  }
  function closeAllLayers() {
    while (S.layers.length) S.layers[S.layers.length - 1].close();
  }
  function paragraphs(msg) {
    return (Array.isArray(msg) ? msg : [msg]).filter(Boolean).map((m) => (m instanceof Node ? m : h('p', { class: 'dlg-text' }, m)));
  }
  function ask(o) {
    return new Promise((resolve) => {
      let settled = false;
      let layer = null;
      const done = (v) => { if (settled) return; settled = true; if (layer) layer.close(); resolve(v); };
      const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => done(false) }, o.cancelText || '取消');
      const okBtn = h('button', { type: 'button', class: 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary'), onclick: () => done(true) }, o.okText || '確定');
      layer = openLayer({
        kind: 'modal', role: 'alertdialog', title: o.title,
        body: [paragraphs(o.message), o.extra || null],
        footer: [cancelBtn, okBtn],
        onRequestClose: () => { done(false); return false; },
        initialFocus: () => (o.danger ? cancelBtn : okBtn)
      });
    });
  }
  function choose(o) {
    return new Promise((resolve) => {
      let settled = false;
      let layer = null;
      const done = (v) => { if (settled) return; settled = true; if (layer) layer.close(); resolve(v); };
      const btns = o.buttons.map((b) => h('button', { type: 'button', class: 'btn' + (b.kind ? ' btn-' + b.kind : ''), onclick: () => done(b.value) }, b.label));
      layer = openLayer({
        kind: 'modal', title: o.title,
        body: [paragraphs(o.message), o.extra || null],
        footer: btns,
        dismissable: o.dismissable !== false,
        onRequestClose: () => { done(null); return false; },
        initialFocus: () => btns[o.focus == null ? btns.length - 1 : o.focus]
      });
    });
  }
  async function confirmDiscard(layer) {
    if (!layer.dirty) return true;
    return ask({ title: '放棄未儲存的修改？', message: '這個表單的修改還沒有套用，關閉後就會消失。', okText: '放棄修改', cancelText: '繼續編輯', danger: true });
  }

  /* =====================================================================
   * 資料正規化（只補缺少的欄位，不刪除未知欄位）
   * ===================================================================== */
  function normalize(input) {
    const d = isObj(input) ? input : {};
    def(d, 'version', 1);
    if (!isObj(d.site)) d.site = {};
    const s = d.site;
    ['pageTitle', 'description', 'brandTop', 'brandBottom', 'title', 'badge', 'subtitle', 'indexKicker', 'headline', 'intro', 'footer'].forEach((k) => def(s, k, ''));
    if (typeof s.timeSpeed !== 'number' || !Number.isFinite(s.timeSpeed)) {
      const n = Number(s.timeSpeed);
      s.timeSpeed = s.timeSpeed !== '' && s.timeSpeed != null && Number.isFinite(n) ? n : 2;
    }
    if (!s.timeMode) s.timeMode = 'auto';
    s.tutorial = arrOf(s.tutorial).map((t) => {
      const o = isObj(t) ? t : { title: str(t) };
      def(o, 'title', ''); def(o, 'body', '');
      return o;
    });
    if (!isObj(s.adminRepo)) s.adminRepo = {};
    def(s.adminRepo, 'owner', ''); def(s.adminRepo, 'repo', ''); def(s.adminRepo, 'branch', 'main'); def(s.adminRepo, 'path', 'data/site.json');

    d.values = arrOf(d.values).filter(isObj).map((v) => {
      def(v, 'id', ''); def(v, 'name', ''); def(v, 'en', ''); def(v, 'color', '#2BB59A'); def(v, 'desc', '');
      return v;
    });
    d.linkBasis = arrOf(d.linkBasis).map(str);
    d.phases = arrOf(d.phases).map(str);
    d.islands = arrOf(d.islands).filter(isObj).map(normIsland);
    d.links = arrOf(d.links).filter(isObj).map(normLink);
    d.personTypes = arrOf(d.personTypes).filter(isObj).map(normPerson);
    d.seasons = normSeasons(d.seasons);
    d.airport = normAirport(d.airport);
    return d;
  }
  function toNum(v) {
    const n = Number(v);
    return v !== '' && v != null && Number.isFinite(n) ? n : 0;
  }
  function normIsland(o) {
    def(o, 'id', ''); def(o, 'name', ''); def(o, 'icon', '⬢'); def(o, 'color', '#2BB59A'); def(o, 'landmark', 'school');
    if (typeof o.q !== 'number') o.q = toNum(o.q);
    if (typeof o.r !== 'number') o.r = toNum(o.r);
    def(o, 'tagline', ''); def(o, 'quote', '');
    o.values = arrOf(o.values).map(str);
    if (!isObj(o.source)) o.source = { label: '', url: '' };
    def(o.source, 'label', ''); def(o.source, 'url', '');
    o.items = arrOf(o.items).filter(isObj).map(normItem);
    return o;
  }
  function normItem(o) {
    def(o, 'id', ''); def(o, 'name', ''); def(o, 'phase', ''); def(o, 'target', ''); def(o, 'summary', '');
    if (!Array.isArray(o.points)) o.points = typeof o.points === 'string' ? o.points.split('\n').map((x) => x.trim()).filter(Boolean) : [];
    def(o, 'schedule', ''); def(o, 'image', ''); def(o, 'link', '');
    return o;
  }
  function normLink(o) {
    def(o, 'id', ''); def(o, 'from', '');
    if (!Array.isArray(o.to)) o.to = typeof o.to === 'string' && o.to ? [o.to] : [];
    o.to = o.to.map(str);
    def(o, 'title', ''); def(o, 'basis', '');
    return o;
  }
  function normPerson(o) {
    def(o, 'id', ''); def(o, 'name', ''); def(o, 'emoji', '🙂'); def(o, 'color', '#2BB59A');
    if (typeof o.count !== 'number') o.count = toNum(o.count);
    def(o, 'desc', '');
    o.homes = arrOf(o.homes).map(str);
    o.carry = arrOf(o.carry).filter(isObj).map((c) => { def(c, 'emoji', ''); def(c, 'name', ''); return c; });
    return o;
  }
  function normSeasons(ss) {
    const o = isObj(ss) ? ss : {};
    def(o, 'mode', 'auto');
    const list = arrOf(o.list).filter(isObj);
    SEASON_IDS.forEach((id) => { if (!list.some((x) => x.id === id)) list.push(clone(SEASON_DEFAULTS[id])); });
    list.forEach((x) => {
      const base = SEASON_DEFAULTS[x.id] || {};
      def(x, 'name', base.name || ''); def(x, 'title', base.title || ''); def(x, 'emoji', base.emoji || '');
      if (!Array.isArray(x.months)) x.months = base.months ? base.months.slice() : [];
      x.months = Array.from(new Set(x.months.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)));
      def(x, 'tagline', ''); def(x, 'accent', base.accent || '#2BB59A');
      x.focus = arrOf(x.focus).map(str);
      def(x, 'particle', base.particle || 'petal');
    });
    o.list = list;
    return o;
  }
  function normAirport(a) {
    const o = isObj(a) ? a : { enabled: false, island: '', planes: 0, partners: [] };
    if (typeof o.enabled !== 'boolean') o.enabled = !!o.enabled;
    def(o, 'island', '');
    if (typeof o.planes !== 'number') o.planes = toNum(o.planes);
    o.partners = arrOf(o.partners).filter(isObj).map((p) => { def(p, 'flag', ''); def(p, 'name', ''); def(p, 'carry', ''); return p; });
    return o;
  }

  /* =====================================================================
   * 查詢與參照
   * ===================================================================== */
  const islandById = (id) => S.data.islands.find((x) => x.id === id) || null;
  const valueById = (id) => S.data.values.find((x) => x.id === id) || null;
  const landmarkLabel = (v) => { const f = LANDMARKS.find((l) => l[0] === v); return f ? f[1] : (v || '—'); };
  const totalWalkers = (d) => sum(d.personTypes, (p) => Math.max(0, Number(p.count) || 0));
  const fixedSeasons = (d) => SEASON_IDS.map((id) => d.seasons.list.find((s) => s.id === id)).filter(Boolean);
  const seasonForMonth = (d, m) => fixedSeasons(d).find((s) => s.months.includes(m)) || null;
  const todaySeason = (d) => seasonForMonth(d, new Date().getMonth() + 1);

  function islandOptions(excludeId) {
    return S.data.islands.filter((i) => i.id !== excludeId).map((i) => ({ value: i.id, label: i.name || i.id, icon: i.icon, color: i.color }));
  }
  function islandRefs(d, id) {
    const linksFrom = d.links.filter((l) => l.from === id).length;
    const linksTo = d.links.filter((l) => l.from !== id && l.to.includes(id)).length;
    const focus = d.seasons.list.filter((s) => s.focus.includes(id)).length;
    const homes = d.personTypes.filter((p) => p.homes.includes(id)).length;
    const airport = d.airport.island === id ? 1 : 0;
    const parts = [];
    if (linksFrom) parts.push(`${linksFrom} 條以它為起點的協作連結（會整條刪除）`);
    if (linksTo) parts.push(`${linksTo} 條協作連結的目標`);
    if (focus) parts.push(`${focus} 個季節焦點`);
    if (homes) parts.push(`${homes} 個人物類型的常去島嶼`);
    if (airport) parts.push('國際航線的降落島');
    return { total: linksFrom + linksTo + focus + homes + airport, desc: parts.join('、') };
  }
  function removeIslandRefs(d, id) {
    d.links = d.links.filter((l) => l.from !== id).filter((l) => {
      if (!l.to.includes(id)) return true;
      l.to = l.to.filter((x) => x !== id);
      return l.to.length > 0;
    });
    d.seasons.list.forEach((s) => { s.focus = s.focus.filter((x) => x !== id); });
    d.personTypes.forEach((p) => { p.homes = p.homes.filter((x) => x !== id); });
    if (d.airport.island === id) d.airport.island = '';
  }
  function renameIslandRefs(d, from, to) {
    const swap = (x) => (x === from ? to : x);
    d.links.forEach((l) => { l.from = swap(l.from); l.to = l.to.map(swap); });
    d.seasons.list.forEach((s) => { s.focus = s.focus.map(swap); });
    d.personTypes.forEach((p) => { p.homes = p.homes.map(swap); });
    d.airport.island = swap(d.airport.island);
  }

  function sortMonths(arr) {
    const a = Array.from(new Set(arr)).sort((x, y) => x - y);
    if (a.length < 2) return a;
    let gapIdx = 0;
    let gap = -1;
    for (let i = 0; i < a.length; i++) {
      const next = a[(i + 1) % a.length];
      const g = ((next - a[i]) + 12) % 12 || 12;
      if (g > gap) { gap = g; gapIdx = i; }
    }
    return a.slice(gapIdx + 1).concat(a.slice(0, gapIdx + 1));
  }
  function monthIssues(d) {
    const owners = new Map(range(1, 12).map((m) => [m, []]));
    fixedSeasons(d).forEach((s) => s.months.forEach((m) => { if (owners.has(m) && !owners.get(m).includes(s)) owners.get(m).push(s); }));
    const missing = [];
    const dup = [];
    owners.forEach((list, m) => {
      if (!list.length) missing.push(m);
      else if (list.length > 1) dup.push({ m, seasons: list });
    });
    return { missing, dup };
  }

  /* ---------- 六角格（pointy-top、axial q,r） ---------- */
  const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const hexDist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
  function firstFreeCell(islands) {
    if (!islands.length) return { q: 0, r: 0 };
    const occ = new Set(islands.map((i) => `${i.q},${i.r}`));
    let best = null;
    islands.forEach((isl, order) => {
      HEX_DIRS.forEach(([dq, dr]) => {
        const q = isl.q + dq;
        const r = isl.r + dr;
        if (!Number.isInteger(q) || !Number.isInteger(r) || occ.has(`${q},${r}`)) return;
        const dist = hexDist(q, r);
        if (!best || dist < best.dist || (dist === best.dist && order < best.order)) best = { q, r, dist, order };
      });
    });
    return best ? { q: best.q, r: best.r } : { q: 0, r: 0 };
  }
  function hexPoints(size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${(size * Math.cos(a)).toFixed(2)},${(size * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
  }
  function hexGridSVG(o) {
    const SIZE = 24;
    const islands = o.islands;
    const editing = o.editing || null;
    const occ = new Map();
    islands.forEach((isl, i) => { const k = `${isl.q},${isl.r}`; if (!occ.has(k)) occ.set(k, { isl, i: o.indexMap ? o.indexMap[i] : i }); });
    let R = 4;
    islands.concat(editing ? [editing] : []).forEach((isl) => {
      if (Number.isInteger(isl.q) && Number.isInteger(isl.r)) R = Math.max(R, hexDist(isl.q, isl.r));
    });
    R = Math.min(R, 10);
    const W = Math.sqrt(3) * SIZE;
    const cells = [];
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (let q = -R; q <= R; q++) {
      for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
        const x = W * (q + r / 2);
        const y = SIZE * 1.5 * r;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        cells.push({ q, r, x, y });
      }
    }
    const pad = SIZE + 4;
    const vb = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map((n) => n.toFixed(1)).join(' ');
    const pts = hexPoints(SIZE - 1.4);
    const svg = sv('svg', { viewBox: vb, class: 'hexgrid', role: 'group', 'aria-label': o.label || '島嶼位置圖' });
    const curKey = editing ? `${editing.q},${editing.r}` : null;
    cells.forEach((c) => {
      const k = `${c.q},${c.r}`;
      const hit = occ.get(k);
      const g = sv('g', { class: 'hex', transform: `translate(${c.x.toFixed(2)} ${c.y.toFixed(2)})` });
      const poly = sv('polygon', { points: pts });
      g.append(poly);
      let title;
      if (curKey === k) {
        g.classList.add('hex-current');
        poly.style.setProperty('--c', safeColor(editing.color));
        g.append(sv('text', { class: 'hex-icon', 'font-size': (SIZE * 0.85).toFixed(1) }, editing.icon || '⬢'));
        title = `這座島目前的位置（q ${c.q}, r ${c.r}）`;
        if (hit) { g.classList.add('hex-conflict'); title += `，與「${hit.isl.name || hit.isl.id}」重疊！`; }
      } else if (hit) {
        g.classList.add('hex-taken');
        poly.style.setProperty('--c', safeColor(hit.isl.color));
        g.append(sv('text', { class: 'hex-icon', 'font-size': (SIZE * 0.8).toFixed(1) }, hit.isl.icon || '⬢'));
        title = `${hit.isl.name || hit.isl.id}（q ${c.q}, r ${c.r}）`;
        if (o.onIslandClick) {
          g.classList.add('hex-clickable');
          g.addEventListener('click', () => o.onIslandClick(hit.i));
        }
      } else {
        g.classList.add('hex-empty');
        title = `空位（q ${c.q}, r ${c.r}）`;
        if (o.onPick) {
          g.classList.add('hex-clickable');
          g.addEventListener('click', () => o.onPick(c.q, c.r));
          title += '，點一下把島移到這裡';
        }
      }
      if (c.q === 0 && c.r === 0 && !hit && curKey !== k) g.classList.add('hex-origin');
      g.append(sv('title', null, title));
      if (o.onHover) g.addEventListener('mouseenter', () => o.onHover(title));
      svg.append(g);
    });
    return svg;
  }

  /* =====================================================================
   * 資料檢查
   * ===================================================================== */
  function validate(d) {
    const out = [];
    const add = (level, msg, target) => out.push({ level, msg, target });
    const islandIds = new Set(d.islands.map((x) => x.id));
    const valueIds = new Set(d.values.map((v) => v.id));
    const landmarkSet = new Set(LANDMARKS.map((l) => l[0]));

    // 島嶼
    const idCount = countBy(d.islands.map((x) => x.id));
    const reportedIds = new Set();
    const pos = new Map();
    const itemSeen = new Map();
    const reportedItems = new Set();
    d.islands.forEach((isl, i) => {
      const t = { section: 'islands', kind: 'island', index: i };
      const nm = isl.name ? `島嶼「${isl.name}」` : `第 ${i + 1} 座島`;
      if (!str(isl.name).trim()) add('error', `第 ${i + 1} 座島沒有名稱`, t);
      if (!str(isl.id).trim()) add('error', `${nm} 沒有 ID`, t);
      else if (!ID_RE.test(isl.id)) add('warn', `${nm} 的 ID「${isl.id}」含有特殊字元，建議只用英數字、- 或 _`, t);
      if (isl.id && idCount.get(isl.id) > 1 && !reportedIds.has(isl.id)) {
        reportedIds.add(isl.id);
        const where = d.islands.map((x, j) => (x.id === isl.id ? j + 1 : 0)).filter(Boolean).join('、');
        add('error', `島嶼 ID「${isl.id}」重複（第 ${where} 座）`, t);
      }
      if (!Number.isInteger(isl.q) || !Number.isInteger(isl.r)) add('error', `${nm} 的位置不是整數（q ${isl.q}, r ${isl.r}）`, t);
      else {
        const k = `${isl.q},${isl.r}`;
        if (!pos.has(k)) pos.set(k, []);
        pos.get(k).push(i);
      }
      if (!isHex(isl.color)) add('warn', `${nm} 的主題色「${isl.color}」不是有效的色碼`, t);
      if (!landmarkSet.has(isl.landmark)) add('warn', `${nm} 的地標「${isl.landmark}」不在清單中`, t);
      isl.values.forEach((v) => { if (!valueIds.has(v)) add('error', `${nm} 使用了不存在的價值面向「${v}」`, t); });
      isl.items.forEach((it, j) => {
        const ti = { section: 'islands', kind: 'item', index: i, item: j };
        if (!str(it.name).trim()) add('error', `${nm} 的第 ${j + 1} 個項目沒有名稱`, ti);
        if (!str(it.id).trim()) add('warn', `${nm} 的第 ${j + 1} 個項目沒有 ID`, ti);
        else if (itemSeen.has(it.id)) {
          if (!reportedItems.has(it.id)) { reportedItems.add(it.id); add('error', `項目 ID「${it.id}」重複`, ti); }
        } else itemSeen.set(it.id, true);
      });
    });
    pos.forEach((list, k) => {
      if (list.length < 2) return;
      const names = list.map((i) => `「${d.islands[i].name || d.islands[i].id}」`).join('、');
      const [q, r] = k.split(',');
      add('error', `${names} 的位置重疊（q ${q}, r ${r}）`, { section: 'islands', kind: 'island', index: list[1] });
    });

    // 協作連結
    const linkIdCount = countBy(d.links.map((l) => l.id));
    const reportedLinks = new Set();
    const basisSet = new Set(d.linkBasis);
    d.links.forEach((l, i) => {
      const t = { section: 'links', kind: 'link', index: i };
      const code = l.id ? `協作連結 ${l.id}` : `第 ${i + 1} 條協作連結`;
      if (!str(l.id).trim()) add('error', `${code} 沒有代碼`, t);
      else if (linkIdCount.get(l.id) > 1 && !reportedLinks.has(l.id)) { reportedLinks.add(l.id); add('error', `協作連結代碼「${l.id}」重複`, t); }
      if (!islandIds.has(l.from)) add('error', l.from ? `${code} 的起點島「${l.from}」不存在` : `${code} 沒有起點島`, t);
      if (!l.to.length) add('error', `${code} 沒有任何目標島`, t);
      l.to.forEach((x) => { if (!islandIds.has(x)) add('error', `${code} 指向不存在的島「${x}」`, t); });
      if (l.from && l.to.includes(l.from)) add('warn', `${code} 的目標包含起點島自己`, t);
      if (!str(l.title).trim()) add('warn', `${code} 沒有說明文字`, t);
      if (l.basis && !basisSet.has(l.basis)) add('warn', `${code} 的連結依據「${l.basis}」不在選項清單中`, t);
    });

    // 人物類型
    const pIdCount = countBy(d.personTypes.map((p) => p.id));
    const reportedP = new Set();
    d.personTypes.forEach((p, i) => {
      const t = { section: 'persons', kind: 'person', index: i };
      const nm = p.name ? `人物類型「${p.name}」` : `第 ${i + 1} 個人物類型`;
      if (!str(p.name).trim()) add('error', `第 ${i + 1} 個人物類型沒有名稱`, t);
      if (!str(p.id).trim()) add('error', `${nm} 沒有 ID`, t);
      else if (pIdCount.get(p.id) > 1 && !reportedP.has(p.id)) { reportedP.add(p.id); add('error', `人物類型 ID「${p.id}」重複`, t); }
      p.homes.forEach((x) => { if (!islandIds.has(x)) add('error', `${nm} 的常去島嶼「${x}」不存在`, t); });
      if (!p.carry.length) add('warn', `${nm} 沒有可搬運的物品`, t);
      if (!Number.isInteger(p.count) || p.count < 0 || p.count > 30) add('warn', `${nm} 的人數「${p.count}」應該是 0–30 的整數`, t);
    });
    const walkers = totalWalkers(d);
    if (walkers > WALKER_WARN) add('warn', `島上小人共 ${walkers} 位，超過 ${WALKER_WARN} 位可能讓前台變慢`, { section: 'persons' });

    // 國際航線
    const ap = d.airport;
    const tAir = { section: 'airport', kind: 'field', fk: 'air-island' };
    if (ap.enabled && !ap.island) add('error', '國際航線已啟用，但還沒有選擇降落的島', tAir);
    else if (ap.island && !islandIds.has(ap.island)) add(ap.enabled ? 'error' : 'warn', `國際航線的降落島「${ap.island}」不存在`, tAir);
    if (!Number.isInteger(ap.planes) || ap.planes < 0 || ap.planes > 4) add('warn', `國際航線的飛機數「${ap.planes}」應該是 0–4 的整數`, { section: 'airport', kind: 'field', fk: 'air-planes' });
    if (ap.enabled && !ap.partners.length) add('warn', '國際航線已啟用，但沒有任何國際夥伴', { section: 'airport' });
    ap.partners.forEach((p, i) => {
      if (!str(p.name).trim()) add('error', `第 ${i + 1} 個國際夥伴沒有名稱`, { section: 'airport', kind: 'field', fk: `air-name-${i}` });
    });

    // 價值面向
    const vIdCount = countBy(d.values.map((v) => v.id));
    const reportedV = new Set();
    d.values.forEach((v, i) => {
      const t = { section: 'values', kind: 'value', index: i };
      if (!str(v.id).trim()) add('error', `第 ${i + 1} 個價值面向沒有代號`, t);
      else if (vIdCount.get(v.id) > 1 && !reportedV.has(v.id)) { reportedV.add(v.id); add('error', `價值面向代號「${v.id}」重複`, t); }
      if (!str(v.name).trim()) add('error', `第 ${i + 1} 個價值面向沒有名稱`, t);
    });

    // 四季
    fixedSeasons(d).forEach((s) => {
      const t = { section: 'seasons', kind: 'season', id: s.id };
      const nm = `季節「${s.title || s.name || s.id}」`;
      if (!str(s.title).trim() && !str(s.name).trim()) add('error', `${s.id} 季節沒有名稱`, t);
      s.focus.forEach((x) => { if (!islandIds.has(x)) add('error', `${nm} 的焦點島「${x}」不存在`, t); });
    });
    const mi = monthIssues(d);
    if (mi.missing.length) add('error', `${mi.missing.join('、')} 月沒有分配給任何季節`, { section: 'seasons', kind: 'season', id: 'spring' });
    mi.dup.forEach((x) => add('error', `${x.m} 月同時屬於 ${x.seasons.map((s) => s.name || s.id).join('、')}`, { section: 'seasons', kind: 'season', id: x.seasons[1].id }));

    // 網站設定
    d.site.tutorial.forEach((tu, i) => {
      if (!str(tu.title).trim()) add('warn', `新手導覽第 ${i + 1} 步沒有標題`, { section: 'site', kind: 'field', fk: `tut-title-${i}` });
    });
    if (!Number.isFinite(d.site.timeSpeed) || d.site.timeSpeed < 0) add('warn', '時間流速應該是 0 以上的數字', { section: 'site', kind: 'field', fk: 'site-speed' });

    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  }

  /* =====================================================================
   * 儲存後端：本機 / GitHub / 離線
   * ===================================================================== */
  async function detectLocal() {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 2500) : null;
    try {
      const r = await fetch('../api/health', { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j && j.ok);
    } catch (e) {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function loadStatic() {
    let r;
    try {
      r = await fetch(`../data/site.json?t=${Date.now()}`, { cache: 'no-store' });
    } catch (e) {
      throw new Error('無法讀取 data/site.json（若是直接用檔案開啟，請改用本機伺服器或匯入 JSON）');
    }
    if (!r.ok) throw new Error(`讀取 data/site.json 失敗（HTTP ${r.status}）`);
    try { return await r.json(); } catch (e) { throw new Error('data/site.json 不是有效的 JSON'); }
  }

  class GhError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  const encSeg = (s) => encodeURIComponent(s);
  const encPath = (p) => str(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const repoPath = () => `/repos/${encSeg(S.gh.owner)}/${encSeg(S.gh.repo)}`;
  const contentsPath = (p) => `${repoPath()}/contents/${encPath(p || S.gh.path)}`;

  function ghHeaders(extra) {
    return Object.assign({
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${S.gh.token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }, extra || {});
  }
  async function gh(method, path, body, accept) {
    let res;
    try {
      const extra = {};
      if (body) extra['Content-Type'] = 'application/json';
      if (accept) extra.Accept = accept;
      res = await fetch(`https://api.github.com${path}`, {
        method, headers: ghHeaders(extra), body: body ? JSON.stringify(body) : undefined, cache: 'no-store'
      });
    } catch (e) {
      throw new GhError(0, 'network');
    }
    if (accept && res.ok) return res.text();
    let json = null;
    try { json = await res.json(); } catch (e) { /* 沒有內容 */ }
    if (!res.ok) throw new GhError(res.status, (json && json.message) || res.statusText || '');
    return json;
  }
  function ghErrorText(e, ctx) {
    if (!(e instanceof GhError)) return (e && e.message) || String(e);
    const m = str(e.message).toLowerCase();
    if (e.status === 0) return '無法連線到 GitHub，請檢查網路連線。';
    if (e.status === 401) return 'Token 無效或已過期，請重新產生後貼上。';
    if (e.status === 403 && m.includes('rate limit')) return 'GitHub API 使用次數暫時達到上限，請稍後再試。';
    if (e.status === 403) return '權限不足：請確認 Token 有授權這個 repo，且 Contents 權限為「Read and write」。';
    if (e.status === 404) {
      if (ctx === 'file') return `在分支「${S.gh.branch}」找不到檔案「${S.gh.path}」。`;
      if (ctx === 'repo') return `找不到 repo「${S.gh.owner}/${S.gh.repo}」，或 Token 沒有授權這個 repo。`;
      return '找不到資源（404）。';
    }
    if (e.status === 409) return '資料版本衝突：雲端檔案已被更新。';
    if (e.status === 422) return `GitHub 拒絕了這次寫入（422）：${e.message}`;
    return `GitHub 回應錯誤（${e.status}）：${e.message}`;
  }
  const isConflict = (e) => e instanceof GhError && (e.status === 409 || (e.status === 422 && /sha/i.test(str(e.message))));

  function b64ToText(b64) {
    return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  }
  function bytesToB64(bytes) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(bin);
  }
  const textToB64 = (text) => bytesToB64(new TextEncoder().encode(text));

  async function ghLoad() {
    const ref = `?ref=${encodeURIComponent(S.gh.branch)}`;
    const f = await gh('GET', contentsPath() + ref);
    if (Array.isArray(f) || !f || f.type !== 'file') throw new Error(`「${S.gh.path}」不是檔案。`);
    let text;
    if (f.content && f.encoding === 'base64') text = b64ToText(f.content.replace(/\s/g, ''));
    else text = await gh('GET', contentsPath() + ref, null, 'application/vnd.github.raw+json'); // 大於 1MB 的檔案
    S.gh.sha = f.sha;
    try { return JSON.parse(text); } catch (e) { throw new Error(`GitHub 上的 ${S.gh.path} 不是有效的 JSON。`); }
  }
  async function ghPutData(payload) {
    const text = JSON.stringify(payload, null, 2) + '\n';
    const body = { message: COMMIT_MESSAGE, content: textToB64(text), branch: S.gh.branch };
    if (S.gh.sha) body.sha = S.gh.sha;
    const res = await gh('PUT', contentsPath(), body);
    if (res && res.content && res.content.sha) S.gh.sha = res.content.sha;
    return res;
  }

  function getStoredToken() {
    const l = store.get('localStorage', TOKEN_KEY);
    if (l) return { token: l, remembered: true };
    const s = store.get('sessionStorage', TOKEN_KEY);
    if (s) return { token: s, remembered: false };
    return { token: '', remembered: false };
  }
  function saveToken(token, remember) {
    if (remember) { store.set('localStorage', TOKEN_KEY, token); store.del('sessionStorage', TOKEN_KEY); }
    else { store.set('sessionStorage', TOKEN_KEY, token); store.del('localStorage', TOKEN_KEY); }
  }
  function clearToken() {
    store.del('localStorage', TOKEN_KEY);
    store.del('sessionStorage', TOKEN_KEY);
  }
  function guessRepo() {
    const m = /^([^.]+)\.github\.io$/i.exec(location.hostname);
    if (!m) return { owner: '', repo: '' };
    const seg = location.pathname.split('/').filter(Boolean)[0];
    return { owner: m[1], repo: seg && seg !== 'admin' ? seg : `${m[1]}.github.io` };
  }

  /* ---------- 圖片上傳 ---------- */
  function safeFileName(file) {
    const name = str(file.name);
    let ext = (/\.[a-z0-9]+$/i.exec(name) || [''])[0].toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) {
      const byType = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' }[file.type];
      ext = byType || '';
    }
    let base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '').slice(0, 50);
    if (!base) base = 'image';
    return base + ext;
  }
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('讀取檔案失敗'));
      fr.readAsDataURL(file);
    });
  }
  async function uploadImage(file) {
    const safe = safeFileName(file);
    const ext = (/\.[a-z0-9]+$/i.exec(safe) || [''])[0];
    if (!IMAGE_EXTS.includes(ext)) throw new Error('只接受 PNG、JPG、GIF、WebP 或 SVG 圖片。');
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`圖片太大（${(file.size / 1048576).toFixed(1)} MB），請壓縮到 8 MB 以下。`);
    let path;
    if (S.mode === 'local') {
      const res = await fetch('../api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: safe, base64: await readAsDataURL(file) })
      });
      let j = null;
      try { j = await res.json(); } catch (e) { /* 忽略 */ }
      if (!res.ok || !j || !j.ok) throw new Error((j && j.error) || `上傳失敗（HTTP ${res.status}）`);
      path = j.path;
    } else if (S.mode === 'github') {
      path = `assets/uploads/${Date.now()}-${safe}`;
      const content = bytesToB64(new Uint8Array(await file.arrayBuffer()));
      try {
        await gh('PUT', contentsPath(path), { message: `上傳圖片 ${safe}（後台）`, content, branch: S.gh.branch });
      } catch (e) {
        throw new Error(ghErrorText(e));
      }
    } else {
      throw new Error('離線模式無法上傳圖片，請直接填入圖片網址。');
    }
    try { S.uploadPreview[path] = URL.createObjectURL(file); } catch (e) { /* 忽略 */ }
    return path;
  }
  function resolveAsset(p) {
    p = str(p).trim();
    if (!p) return '';
    if (S.uploadPreview[p]) return S.uploadPreview[p];
    if (/^(https?:|blob:)/i.test(p) || /^data:image\//i.test(p)) return p;
    if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return '';
    if (p.startsWith('/')) return p;
    return '../' + p.replace(/^\.\//, '');
  }

  /* =====================================================================
   * 草稿、變更追蹤
   * ===================================================================== */
  function isDirty() {
    return !!S.data && JSON.stringify(S.data) !== S.publishedStr;
  }
  function readDraft() {
    const o = readStoredJSON(DRAFT_KEY);
    return o && isObj(o.data) ? o : null;
  }
  function saveDraft() {
    if (!S.data) return false;
    const savedAt = new Date().toISOString();
    const ok = store.set('localStorage', DRAFT_KEY, JSON.stringify({ savedAt, data: S.data }));
    if (ok) S.draftSavedAt = savedAt;
    else if (!S.warnedQuota) {
      S.warnedQuota = true;
      toast('無法把草稿存進這個瀏覽器（空間不足或被封鎖），請盡快發布或匯出 JSON。', 'warn');
    }
    return ok;
  }
  function clearDraft() {
    store.del('localStorage', DRAFT_KEY);
    S.draftSavedAt = null;
  }
  function syncState() {
    if (!S.data) return;
    if (isDirty()) saveDraft();
    else clearDraft();
    updateTopbar();
    updateNavBadges();
  }
  const syncSoon = debounce(syncState, 300);
  /** 任何修改後呼叫：自動存草稿、更新未發布提示與檢查徽章 */
  function changed() { syncSoon(); }
  function flushDraft() { syncSoon.flush(); }

  function withUndo(msg, mutate, focusKeys) {
    const snap = JSON.stringify(S.data);
    mutate(S.data);
    changed();
    rerender(...(focusKeys || []));
    toast(msg, 'ok', { action: { label: '復原', run: () => restoreSnap(snap) } });
  }
  function restoreSnap(snap) {
    closeAllLayers();
    S.data = JSON.parse(snap);
    changed();
    render();
    toast('已復原');
  }

  /* =====================================================================
   * 啟動與連線畫面
   * ===================================================================== */
  function showBoot(msg) {
    $('#boot').hidden = false;
    $('#bootMsg').textContent = msg;
    $('#connect').hidden = true;
    $('#shell').hidden = true;
  }

  async function boot() {
    wireShell();
    showBoot('正在偵測儲存方式…');
    const last = store.get('localStorage', LASTMODE_KEY);
    const tok = getStoredToken();
    const savedConf = readStoredJSON(GHCONF_KEY);
    if (last === 'github' && tok.token && savedConf && savedConf.owner && savedConf.repo) {
      showBoot('正在連線 GitHub…');
      try { await connectGitHub(savedConf, tok.token, tok.remembered); return; } catch (e) { showConnect({ error: '自動連線 GitHub 失敗：' + e.message }); return; }
    }
    const localOk = await detectLocal();
    S.localOk = localOk;
    if (localOk && last !== 'github' && last !== 'offline') {
      showBoot('偵測到本機伺服器，載入資料中…');
      try {
        const data = await loadStatic();
        store.set('localStorage', LASTMODE_KEY, 'local');
        await enterApp('local', data);
        return;
      } catch (e) {
        showConnect({ error: '本機資料載入失敗：' + e.message });
        return;
      }
    }
    showConnect();
  }

  function showConnect(opt) {
    opt = opt || {};
    S.mode = null;
    S.data = null;
    closeAllLayers();
    $('#boot').hidden = true;
    $('#shell').hidden = true;
    const root = $('#connect');
    root.hidden = false;
    root.replaceChildren(buildConnect(opt));
    document.title = '選擇儲存方式｜MAX 教育理念島 後台';
    refreshLocalStatus();
  }

  async function refreshLocalStatus() {
    const pill = $('#localStatus');
    const btn = $('#localBtn');
    if (!pill || !btn) return;
    pill.className = 'pill pill-wait';
    pill.textContent = '偵測中…';
    btn.disabled = true;
    const ok = await detectLocal();
    S.localOk = ok;
    if (!document.contains(pill)) return;
    pill.className = ok ? 'pill pill-ok' : 'pill pill-off';
    pill.textContent = ok ? '✓ 偵測到本機伺服器' : '未偵測到本機伺服器';
    btn.disabled = !ok;
  }

  function buildConnect(opt) {
    const onPages = /\.github\.io$/i.test(location.hostname);
    const errBox = h('div', { class: 'connect-error', role: 'alert', hidden: !opt.error }, opt.error || '');

    /* 本機 */
    const localBtn = h('button', { type: 'button', class: 'btn btn-primary', id: 'localBtn', disabled: true, onclick: () => connectLocal(localBtn) }, '使用本機模式');
    const localCard = h('section', { class: 'connect-card' + (onPages ? '' : ' is-featured'), 'aria-labelledby': 'cc-local' },
      h('div', { class: 'cc-icon', 'aria-hidden': 'true' }, '💻'),
      h('h2', { id: 'cc-local' }, '本機模式'),
      h('p', null, '在自己的電腦執行本機伺服器，按「發布」就直接寫回 data/site.json，並自動備份舊版本。'),
      h('div', { class: 'cc-status' },
        h('span', { class: 'pill pill-wait', id: 'localStatus' }, '偵測中…'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: refreshLocalStatus }, '重新偵測')),
      h('p', { class: 'hint' }, '在專案資料夾執行 ', h('code', null, 'node server.js'), '，再開啟 ', h('code', null, 'http://localhost:5173/admin/'), '。'),
      h('div', { class: 'cc-actions' }, localBtn));

    /* GitHub */
    const saved = readStoredJSON(GHCONF_KEY);
    const guess = guessRepo();
    const conf = saved && saved.owner ? saved : { owner: guess.owner, repo: guess.repo, branch: 'main', path: 'data/site.json' };
    let touched = false;
    const mk = (value, ph, extra) => h('input', Object.assign({ type: 'text', value: value || '', placeholder: ph, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', class: 'mono', oninput: () => { touched = true; } }, extra || {}));
    const fOwner = mk(conf.owner, '例如 maxchin18');
    const fRepo = mk(conf.repo, '例如 max-edu-island');
    const fBranch = mk(conf.branch || 'main', 'main');
    const fPath = mk(conf.path || 'data/site.json', 'data/site.json');
    const stored = getStoredToken();
    const fToken = h('input', { type: 'password', value: stored.token, placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', class: 'mono' });
    const showBtn = h('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', 'aria-pressed': 'false',
      onclick: () => {
        const show = fToken.type === 'password';
        fToken.type = show ? 'text' : 'password';
        showBtn.textContent = show ? '隱藏' : '顯示';
        showBtn.setAttribute('aria-pressed', String(show));
      }
    }, '顯示');
    const fRemember = h('input', { type: 'checkbox', checked: stored.remembered });
    const ghErr = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const ghBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, '連線 GitHub');
    const showErr = (msg) => { ghErr.textContent = msg; ghErr.hidden = false; };

    if (!(saved && saved.owner)) {
      // 從已發布的 site.json 讀 site.adminRepo 來預先帶入
      fetch(`../data/site.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const repo = j && j.site && j.site.adminRepo;
          if (!repo || touched || !document.contains(fOwner)) return;
          if (repo.owner) fOwner.value = repo.owner;
          if (repo.repo) fRepo.value = repo.repo;
          if (repo.branch) fBranch.value = repo.branch;
          if (repo.path) fPath.value = repo.path;
        })
        .catch(() => { /* 忽略 */ });
    }

    const tokenId = elId('tok');
    const form = h('form', {
      class: 'gh-form', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const cfg = {
          owner: fOwner.value.trim(), repo: fRepo.value.trim(),
          branch: fBranch.value.trim() || 'main', path: fPath.value.trim().replace(/^\/+/, '') || 'data/site.json'
        };
        const token = fToken.value.trim();
        ghErr.hidden = true;
        if (!cfg.owner || !cfg.repo) { showErr('請填寫 GitHub 帳號（owner）與 repo 名稱。'); (cfg.owner ? fRepo : fOwner).focus(); return; }
        if (!token) { showErr('請貼上 Fine-grained personal access token。'); fToken.focus(); return; }
        ghBtn.disabled = true;
        ghBtn.textContent = '連線中…';
        try {
          await connectGitHub(cfg, token, fRemember.checked);
        } catch (err) {
          showErr(err.message || String(err));
          ghBtn.disabled = false;
          ghBtn.textContent = '連線 GitHub';
        }
      }
    },
      h('div', { class: 'form-grid' },
        field('帳號（owner）', fOwner),
        field('Repo 名稱', fRepo),
        h('details', { class: 'adv wide' },
          h('summary', null, '分支與資料路徑'),
          h('div', { class: 'form-grid' }, field('分支（branch）', fBranch), field('資料檔路徑', fPath)))),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', for: tokenId }, 'Fine-grained personal access token'),
        h('div', { class: 'token-row' }, Object.assign(fToken, { id: tokenId }), showBtn),
        h('p', { class: 'hint' }, 'GitHub → Settings → Developer settings → Fine-grained tokens → 只選這個 repo → Contents: Read and write')),
      h('details', { class: 'help' },
        h('summary', null, '一步一步取得 Token'),
        h('ol', null,
          h('li', null, '登入 GitHub，點右上角頭像 → Settings → 左側最下方 Developer settings。'),
          h('li', null, 'Personal access tokens → Fine-grained tokens → Generate new token。'),
          h('li', null, 'Repository access 選「Only select repositories」，只勾這個網站的 repo。'),
          h('li', null, 'Permissions → Repository permissions → Contents 設為「Read and write」。'),
          h('li', null, '產生後複製 token，貼到上面的欄位。')),
        h('p', { class: 'hint' }, 'Token 只會存在這台裝置的瀏覽器，不會寫進網站資料。沒有勾「記住此裝置」時，關閉分頁就會清除。')),
      h('label', { class: 'check-line' }, fRemember, h('span', null, '記住此裝置（只在自己的電腦勾選）')),
      ghErr,
      h('div', { class: 'cc-actions' }, ghBtn));

    const ghCard = h('section', { class: 'connect-card cc-github' + (onPages ? ' is-featured' : ''), 'aria-labelledby': 'cc-gh' },
      h('div', { class: 'cc-icon', 'aria-hidden': 'true' }, '🌐'),
      h('h2', { id: 'cc-gh' }, 'GitHub 模式'),
      h('p', null, '直接編輯線上網站：資料會透過 GitHub 寫入 repo，GitHub Pages 約一分鐘後更新。'),
      form);

    /* 離線 */
    const offBtn = h('button', { type: 'button', class: 'btn', onclick: () => connectOffline(offBtn) }, '離線編輯');
    const importPick = filePickButton('匯入 JSON 檔開始', '.json,application/json', async (file) => {
      try {
        const data = await readJSONFile(file);
        checkImport(data);
        store.set('localStorage', LASTMODE_KEY, 'offline');
        await enterApp('offline', data);
        toast(`已載入「${file.name}」，修改後請用「匯出 JSON」下載。`, 'info');
      } catch (e) {
        errBox.textContent = e.message;
        errBox.hidden = false;
      }
    }, 'btn btn-ghost');
    const offCard = h('section', { class: 'connect-card', 'aria-labelledby': 'cc-off' },
      h('div', { class: 'cc-icon', 'aria-hidden': 'true' }, '📴'),
      h('h2', { id: 'cc-off' }, '離線編輯'),
      h('p', null, '不連線任何地方。讀取目前網站的資料來編輯，修改只能「匯出 JSON」下載，再自行上傳。'),
      h('div', { class: 'cc-actions' }, offBtn, importPick));

    return h('div', { class: 'connect-inner' },
      h('header', { class: 'connect-hero' },
        h('span', { class: 'brand-mark brand-mark-lg', 'aria-hidden': 'true' }),
        h('p', { class: 'kicker' }, 'MAX 教育理念島'),
        h('h1', null, '後台管理'),
        h('p', { class: 'lead' }, '先選擇這次的修改要存到哪裡。')),
      errBox,
      h('div', { class: 'connect-grid' }, localCard, ghCard, offCard));
  }

  async function connectLocal(btn) {
    if (btn) { btn.disabled = true; btn.textContent = '載入中…'; }
    try {
      const data = await loadStatic();
      store.set('localStorage', LASTMODE_KEY, 'local');
      await enterApp('local', data);
      toast('已進入本機模式');
    } catch (e) {
      showConnect({ error: '本機模式載入失敗：' + e.message });
    }
  }
  async function connectOffline(btn) {
    if (btn) { btn.disabled = true; btn.textContent = '載入中…'; }
    try {
      const data = await loadStatic();
      store.set('localStorage', LASTMODE_KEY, 'offline');
      await enterApp('offline', data);
      toast('離線編輯：修改完成後請按「匯出 JSON」。', 'info');
    } catch (e) {
      showConnect({ error: e.message + '。也可以用「匯入 JSON 檔開始」。' });
    }
  }
  async function connectGitHub(cfg, token, remember) {
    S.gh = { owner: cfg.owner, repo: cfg.repo, branch: cfg.branch || 'main', path: cfg.path || 'data/site.json', token, sha: null };
    try {
      let info;
      try { info = await gh('GET', repoPath()); } catch (e) { throw new Error(ghErrorText(e, 'repo')); }
      if (!info || !info.permissions || !info.permissions.push) {
        throw new Error('這個 Token 可以讀取 repo，但沒有寫入權限。請把 Contents 權限設為「Read and write」。');
      }
      let data;
      try { data = await ghLoad(); } catch (e) { throw new Error(e instanceof GhError ? ghErrorText(e, 'file') : e.message); }
      saveToken(token, remember);
      store.set('localStorage', GHCONF_KEY, JSON.stringify({ owner: S.gh.owner, repo: S.gh.repo, branch: S.gh.branch, path: S.gh.path }));
      store.set('localStorage', LASTMODE_KEY, 'github');
      await enterApp('github', data);
      toast(`已連線 GitHub：${S.gh.owner}/${S.gh.repo}`);
    } catch (e) {
      S.gh.token = '';
      throw e;
    }
  }

  async function enterApp(mode, raw) {
    S.mode = mode;
    const data = normalize(raw);
    S.data = data;
    S.publishedStr = JSON.stringify(data);
    S.draftSavedAt = null;
    $('#boot').hidden = true;
    $('#connect').hidden = true;
    $('#shell').hidden = false;
    const fromHash = location.hash.slice(1);
    S.section = SECTIONS.some((s) => s.id === fromHash) ? fromHash : 'overview';
    render();
    await offerDraft();
  }
  async function offerDraft() {
    const draft = readDraft();
    if (!draft) return;
    let dd;
    try { dd = normalize(clone(draft.data)); } catch (e) { clearDraft(); return; }
    if (JSON.stringify(dd) === S.publishedStr) return;
    const older = str(draft.data.updatedAt) !== str(S.data.updatedAt);
    const choice = await choose({
      title: '找到上次未發布的草稿',
      message: [
        `這台裝置上有一份 ${fmtTime(draft.savedAt)} 自動儲存的草稿，內容和目前已發布的版本不同。`,
        older ? '注意：草稿是根據比較舊的已發布版本修改的。繼續草稿並發布，會蓋掉之後其他人的更新。' : ''
      ],
      buttons: [
        { label: '捨棄草稿', value: 'discard', kind: 'danger-ghost' },
        { label: '繼續上次的草稿', value: 'continue', kind: 'primary' }
      ],
      dismissable: false,
      focus: 1
    });
    if (choice === 'continue') {
      S.data = dd;
      S.draftSavedAt = draft.savedAt;
      render();
      toast('已載入草稿。記得按「發布」才會正式更新網站。', 'info');
    } else {
      clearDraft();
      toast('已捨棄草稿');
    }
  }

  /* =====================================================================
   * 外框：頂部列、側欄、路由
   * ===================================================================== */
  function wireShell() {
    $('#btnPublish').addEventListener('click', publish);
    $('#btnPreview').addEventListener('click', preview);
    $('#modeBadge').addEventListener('click', openModeMenu);
    $('#navToggle').addEventListener('click', () => toggleMobileNav());
    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('beforeunload', (e) => {
      flushDraft();
      if (S.mode && isDirty()) { e.preventDefault(); e.returnValue = ''; return ''; }
      return undefined;
    });
    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDraft(); });
    document.addEventListener('keydown', onKeydown);
  }
  function onKeydown(e) {
    const top = S.layers[S.layers.length - 1];
    if (!top) {
      if (e.key === 'Escape' && $('#nav').classList.contains('open')) toggleMobileNav(false);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (top.dismissable) top.requestClose();
      return;
    }
    if (e.key === 'Tab') {
      const f = focusables(top.panel);
      if (!f.length) { e.preventDefault(); top.panel.focus(); return; }
      const first = f[0];
      const last = f[f.length - 1];
      const a = document.activeElement;
      if (!top.panel.contains(a) || a === top.panel) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }
  }
  function onRoute() {
    if (!S.mode || !S.data) return;
    const id = location.hash.slice(1);
    if (!SECTIONS.some((s) => s.id === id) || id === S.section) return;
    if (S.layers.length) {
      history.pushState(null, '', '#' + S.section);
      S.layers[S.layers.length - 1].requestClose();
      return;
    }
    go(id, { push: false });
  }
  function go(section, opts) {
    opts = opts || {};
    if (!SECTIONS.some((s) => s.id === section)) section = 'overview';
    S.section = section;
    if (opts.push !== false && location.hash !== '#' + section) history.pushState(null, '', '#' + section);
    toggleMobileNav(false);
    render();
    window.scrollTo(0, 0);
    if (!opts.keepFocus) $('#main').focus({ preventScroll: true });
  }
  function toggleMobileNav(force) {
    const nav = $('#nav');
    const open = typeof force === 'boolean' ? force : !nav.classList.contains('open');
    if (open) {
      // 手機版選單貼在頂部列下方（頂部列可能因換行而變高）
      const bar = document.querySelector('.topbar');
      nav.style.top = bar ? `${Math.round(bar.getBoundingClientRect().bottom) + 8}px` : '';
    }
    nav.classList.toggle('open', open);
    $('#navToggle').setAttribute('aria-expanded', String(open));
  }

  function modeLabel() {
    if (S.mode === 'local') return '本機模式';
    if (S.mode === 'github') return `GitHub · ${S.gh.repo}`;
    if (S.mode === 'offline') return '離線編輯';
    return '';
  }
  function modeDetail() {
    if (S.mode === 'local') return '本機模式：直接寫入 data/site.json';
    if (S.mode === 'github') return `GitHub：${S.gh.owner}/${S.gh.repo}（${S.gh.branch}）`;
    if (S.mode === 'offline') return '離線編輯：只能匯出 JSON';
    return '';
  }
  function updateTopbar() {
    if (!S.mode || !S.data) return;
    const badge = $('#modeBadge');
    badge.className = `mode-badge mode-${S.mode}`;
    badge.replaceChildren(h('span', { class: 'mode-dot', 'aria-hidden': 'true' }), h('span', { class: 'mode-text' }, modeLabel()), h('span', { class: 'mode-caret', 'aria-hidden': 'true' }, '▾'));
    badge.setAttribute('aria-label', `${modeDetail()}。點一下可切換模式或登出`);
    const dirty = isDirty();
    const ds = $('#dirtyState');
    ds.className = 'dirty-state ' + (dirty ? 'is-dirty' : 'is-clean');
    ds.replaceChildren(...[
      h('span', { class: 'ds-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'ds-text' }, dirty ? '有未發布的修改' : '已是最新版本'),
      dirty && S.draftSavedAt ? h('small', { class: 'ds-sub' }, `草稿 ${fmtClock(S.draftSavedAt)} 已自動儲存`) : null
    ].filter(Boolean));
    const pub = $('#btnPublish');
    pub.textContent = S.busy ? '發布中…' : S.mode === 'offline' ? '匯出 JSON' : S.mode === 'github' ? '發布到 GitHub' : '發布';
    pub.disabled = S.busy || (S.mode !== 'offline' && !dirty);
    pub.title = S.mode !== 'offline' && !dirty ? '目前沒有需要發布的修改' : '';
    pub.classList.toggle('is-busy', S.busy);
  }
  function renderNav() {
    const nav = $('#nav');
    const items = SECTIONS.map((sec) => h('li', null,
      h('a', {
        href: '#' + sec.id, class: 'nav-link' + (S.section === sec.id ? ' active' : ''),
        'aria-current': S.section === sec.id ? 'page' : null,
        onclick: (e) => { e.preventDefault(); go(sec.id); }
      },
        h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, sec.icon),
        h('span', { class: 'nav-label' }, sec.label),
        h('span', { class: 'nav-badge', 'data-badge': sec.id }))));
    nav.replaceChildren(
      h('ul', { class: 'nav-list' }, items),
      h('div', { class: 'nav-foot' },
        h('a', { href: '../index.html', target: '_blank', rel: 'noopener', class: 'nav-out' }, '開啟前台網站 ↗'),
        h('p', { class: 'nav-mode' }, modeDetail())));
    updateNavBadges();
  }
  function updateNavBadges() {
    if (!S.data) return;
    const d = S.data;
    const issues = validate(d);
    const errs = issues.filter((i) => i.level === 'error').length;
    const warns = issues.length - errs;
    const set = (id, text, cls, title) => {
      const b = document.querySelector(`[data-badge="${id}"]`);
      if (!b) return;
      b.textContent = text;
      b.className = 'nav-badge' + (cls ? ' ' + cls : '');
      if (title) b.title = title; else b.removeAttribute('title');
    };
    if (errs) set('overview', String(errs), 'is-error', `${errs} 個錯誤`);
    else if (warns) set('overview', String(warns), 'is-warn', `${warns} 個提醒`);
    else set('overview', '✓', 'is-ok', '資料檢查通過');
    set('islands', String(d.islands.length));
    set('links', String(d.links.length));
    set('persons', String(d.personTypes.length));
    set('airport', d.airport.enabled ? '開' : '關', d.airport.enabled ? '' : 'is-muted');
    set('values', String(d.values.length));
  }

  const RENDER = {};
  function render() {
    if (!S.data) return;
    renderNav();
    renderSection();
    updateTopbar();
  }
  function renderSection() {
    const main = $('#main');
    const fn = RENDER[S.section] || RENDER.overview;
    main.replaceChildren();
    addKids(main, [fn()]);
    const sec = SECTIONS.find((s) => s.id === S.section) || SECTIONS[0];
    $('#navToggleLabel').textContent = sec.label;
    document.title = `${sec.label}｜後台｜MAX 教育理念島`;
  }
  function rerender(...fks) {
    renderSection();
    updateNavBadges();
    focusFk($('#main'), ...fks);
  }

  /* =====================================================================
   * 發布、預覽、模式切換
   * ===================================================================== */
  function setBusy(on) {
    S.busy = on;
    $('#btnPublish').setAttribute('aria-busy', String(on));
    updateTopbar();
  }

  async function publish() {
    if (!S.data || S.busy || S.layers.length) return;
    flushDraft();
    const errs = validate(S.data).filter((i) => i.level === 'error');
    if (errs.length) {
      const ok = await ask({
        title: '資料還有錯誤',
        message: [`檢查到 ${errs.length} 個錯誤，例如：${errs[0].msg}`, '這些錯誤可能讓前台顯示不正常，建議先到「總覽」修正。'],
        okText: S.mode === 'offline' ? '仍要匯出' : '仍要發布', cancelText: '先去修正'
      });
      if (!ok) { go('overview'); return; }
    }
    if (S.mode === 'offline') {
      const copy = clone(S.data);
      copy.updatedAt = new Date().toISOString();
      downloadJSON(copy);
      toast('已匯出 JSON。把檔案上傳成網站的 data/site.json 才會生效。', 'info', { ms: 7000 });
      return;
    }
    const payload = clone(S.data);
    payload.updatedAt = new Date().toISOString();
    setBusy(true);
    let conflict = false;
    let ok = false;
    let commitUrl = '';
    try {
      if (S.mode === 'local') {
        const res = await fetch('../api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        let j = null;
        try { j = await res.json(); } catch (e) { /* 忽略 */ }
        if (!res.ok || !j || !j.ok) throw new Error((j && j.error) || `伺服器回應 ${res.status}`);
        if (j.updatedAt) payload.updatedAt = j.updatedAt;
      } else {
        const res = await ghPutData(payload);
        commitUrl = (res && res.commit && res.commit.html_url) || '';
      }
      ok = true;
    } catch (e) {
      if (isConflict(e)) conflict = true;
      else toast('發布失敗：' + (e instanceof GhError ? ghErrorText(e, 'file') : e.message), 'error');
    } finally {
      setBusy(false);
    }
    if (ok) {
      S.data.updatedAt = payload.updatedAt;
      S.publishedStr = JSON.stringify(payload);
      if (isDirty()) saveDraft(); else clearDraft();
      updateTopbar();
      updateNavBadges();
      if (S.section === 'overview' || S.section === 'data') renderSection();
      if (S.mode === 'local') toast('已發布！data/site.json 已更新，舊版本備份在 data/backups/。');
      else showPublishedDialog(commitUrl);
    } else if (conflict) {
      await handleConflict();
    }
  }
  function showPublishedDialog(url) {
    const extra = h('div', { class: 'dlg-links' },
      isHttp(url) ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-ghost btn-sm' }, '查看這次 commit ↗') : null,
      h('a', { href: '../index.html', target: '_blank', rel: 'noopener', class: 'btn btn-ghost btn-sm' }, '開啟前台 ↗'));
    choose({
      title: '已發布到 GitHub 🎉',
      message: ['資料已經寫進 GitHub。', 'GitHub Pages 通常約 1 分鐘後更新；若還看到舊內容，CDN 快取最長可能需要約 10 分鐘，稍後重新整理即可。'],
      extra,
      buttons: [{ label: '好的', value: true, kind: 'primary' }]
    });
  }
  async function handleConflict() {
    const v = await choose({
      title: '雲端資料已經被更新',
      message: [
        '在你編輯的這段時間，GitHub 上的資料被其他人（或另一個分頁）修改過了。',
        '「載入最新版本」：讀取雲端資料，你的修改會保留成草稿，可以選擇要不要繼續。',
        '「用我的版本覆蓋」：直接取代雲端上的那次修改。'
      ],
      buttons: [
        { label: '取消', value: null },
        { label: '用我的版本覆蓋', value: 'overwrite', kind: 'danger-ghost' },
        { label: '載入最新版本', value: 'reload', kind: 'primary' }
      ],
      focus: 2
    });
    if (v === 'reload') {
      saveDraft();
      try {
        const data = await ghLoad();
        const norm = normalize(data);
        S.data = norm;
        S.publishedStr = JSON.stringify(norm);
        render();
        await offerDraft();
      } catch (e) {
        toast('重新載入失敗：' + ghErrorText(e, 'file'), 'error');
      }
    } else if (v === 'overwrite') {
      setBusy(true);
      try {
        const f = await gh('GET', contentsPath() + `?ref=${encodeURIComponent(S.gh.branch)}`);
        S.gh.sha = f.sha;
      } catch (e) {
        setBusy(false);
        toast('讀取最新版本失敗：' + ghErrorText(e, 'file'), 'error');
        return;
      }
      setBusy(false);
      publish();
    }
  }

  function preview() {
    if (!S.data) return;
    flushDraft();
    if (!saveDraft()) { toast('無法寫入預覽草稿（瀏覽器儲存空間被封鎖）。', 'error'); return; }
    const w = window.open('../index.html?preview=1', 'maxisland-preview');
    if (!w) toast('瀏覽器擋住了新分頁，請允許這個網站開啟彈出視窗。', 'warn');
    else toast('已在新分頁開啟預覽（使用目前的草稿，尚未發布）', 'info');
  }

  function openModeMenu() {
    if (!S.mode) return;
    const lines = [];
    if (S.mode === 'local') lines.push('資料直接讀寫這台電腦上的 data/site.json，每次發布前會自動備份到 data/backups/（保留最近 30 份）。');
    if (S.mode === 'github') lines.push(`已連線到 ${S.gh.owner}/${S.gh.repo}（分支 ${S.gh.branch}，檔案 ${S.gh.path}）。每次發布會在 GitHub 建立一筆 commit。`);
    if (S.mode === 'offline') lines.push('離線編輯不會寫入任何地方，修改只能用「匯出 JSON」下載，再自行上傳。');
    if (isDirty()) lines.push('你有尚未發布的修改，切換模式後仍會保留在這台裝置的草稿裡。');
    const buttons = [{ label: '關閉', value: null }];
    if (S.mode === 'github') buttons.push({ label: '登出並清除 Token', value: 'signout', kind: 'danger-ghost' });
    buttons.push({ label: '切換儲存模式', value: 'switch', kind: 'primary' });
    choose({ title: `目前：${modeLabel()}`, message: lines, buttons }).then((v) => {
      if (v === 'switch') switchMode();
      else if (v === 'signout') signOut();
    });
  }
  function leaveApp() {
    flushDraft();
    if (isDirty()) saveDraft();
    store.del('localStorage', LASTMODE_KEY);
  }
  function switchMode() {
    leaveApp();
    showConnect();
  }
  function signOut() {
    leaveApp();
    clearToken();
    S.gh.token = '';
    S.gh.sha = null;
    showConnect();
    toast('已登出 GitHub，並清除這台裝置上的 Token。');
  }

  /* =====================================================================
   * 匯出 / 匯入 / 還原
   * ===================================================================== */
  function downloadJSON(data) {
    const text = JSON.stringify(data, null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const name = `site-${todayStamp()}.json`;
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return name;
  }
  async function readJSONFile(file) {
    const text = await file.text();
    try { return JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error(`「${file.name}」不是有效的 JSON 檔。`); }
  }
  function checkImport(data) {
    if (!isObj(data) || !isObj(data.site) || !Array.isArray(data.islands)) {
      throw new Error('這個檔案缺少 site 或 islands，看起來不是教育理念島的資料。');
    }
  }
  async function importJSON(file) {
    let data;
    try { data = await readJSONFile(file); checkImport(data); } catch (e) { toast(e.message, 'error'); return; }
    const ok = await ask({
      title: '用匯入的資料取代目前內容？',
      message: [
        `「${file.name}」：${data.islands.length} 座島、${arrOf(data.links).length} 條協作連結、${arrOf(data.personTypes).length} 種人物類型。`,
        '目前的工作內容會被取代（可以用通知上的「復原」救回）。匯入後要按「發布」才會正式生效。'
      ],
      okText: '匯入並取代', danger: true
    });
    if (!ok) return;
    const snap = JSON.stringify(S.data);
    S.data = normalize(data);
    changed();
    render();
    toast('已匯入資料（尚未發布）', 'ok', { action: { label: '復原', run: () => restoreSnap(snap) } });
  }
  async function restorePublished() {
    const ok = await ask({
      title: '還原成已發布版本？',
      message: '會重新讀取目前已發布的資料，並捨棄所有尚未發布的修改與這台裝置上的草稿。',
      okText: '捨棄修改並還原', danger: true
    });
    if (!ok) return;
    try {
      const raw = S.mode === 'github' ? await ghLoad() : await loadStatic();
      const norm = normalize(raw);
      S.data = norm;
      S.publishedStr = JSON.stringify(norm);
      clearDraft();
      render();
      toast('已還原成已發布版本');
    } catch (e) {
      toast('還原失敗：' + ghErrorText(e, 'file'), 'error');
    }
  }

  /* =====================================================================
   * 表單小元件
   * ===================================================================== */
  function field(label, control, hint, opts) {
    opts = opts || {};
    const target = /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName) ? control : control.querySelector('input:not([type="color"]),select,textarea') || control.querySelector('input');
    let id = null;
    if (target) { id = target.id || elId('in'); target.id = id; }
    let hintEl = null;
    if (hint) {
      hintEl = hint instanceof Node ? hint : h('p', { class: 'hint' }, hint);
      hintEl.classList.add('hint');
      hintEl.id = hintEl.id || elId('hint');
      if (target) target.setAttribute('aria-describedby', hintEl.id);
    }
    return h('div', { class: 'field' + (opts.wide ? ' wide' : '') },
      h('label', { class: 'field-label', for: id }, label, opts.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
      control, hintEl);
  }
  function fieldGroup(legend, content, hint, opts) {
    opts = opts || {};
    return h('fieldset', { class: 'field fieldset' + (opts.wide ? ' wide' : '') },
      h('legend', { class: 'field-label' }, legend), content, hint ? h('p', { class: 'hint' }, hint) : null);
  }
  function textInput(obj, key, o) {
    o = o || {};
    const props = Object.assign({ value: str(obj[key]), placeholder: o.placeholder }, o.attrs || {});
    const el = o.multiline ? h('textarea', Object.assign({ rows: o.rows || 3 }, props)) : h('input', Object.assign({ type: o.type || 'text' }, props));
    el.addEventListener('input', () => { obj[key] = el.value; if (o.onInput) o.onInput(el.value, el); });
    return el;
  }
  function numberInput(obj, key, o) {
    o = o || {};
    const el = h('input', Object.assign({ type: 'number', min: o.min, max: o.max, step: o.step || 1, value: obj[key] == null ? '' : obj[key], inputmode: o.integer ? 'numeric' : 'decimal', class: 'num-input' }, o.attrs || {}));
    el.addEventListener('input', () => {
      const v = el.value === '' ? NaN : Number(el.value);
      const ok = Number.isFinite(v) && (!o.integer || Number.isInteger(v)) && (o.min == null || v >= o.min) && (o.max == null || v <= o.max);
      el.classList.toggle('invalid', !ok);
      el.setAttribute('aria-invalid', String(!ok));
      if (ok) { obj[key] = v; if (o.onInput) o.onInput(v); }
    });
    return el;
  }
  function selectInput(obj, key, options, onChange, o) {
    o = o || {};
    const cur = str(obj[key]);
    const opts = options.slice();
    if (cur && !opts.some((x) => x[0] === cur)) opts.push([cur, `${cur}（自訂）`]);
    const sel = h('select', Object.assign({ value: cur }, o.attrs || {}),
      o.allowEmpty ? h('option', { value: '' }, o.emptyLabel || '（未指定）') : null,
      opts.map((x) => h('option', { value: x[0] }, x[1])));
    sel.addEventListener('change', () => { obj[key] = sel.value; if (onChange) onChange(sel.value); });
    return sel;
  }
  function colorInput(obj, key, onInput) {
    const picker = h('input', { type: 'color', value: isHex(obj[key]) ? toHex6(obj[key]) : '#2BB59A', 'aria-label': '用調色盤選顏色' });
    const text = h('input', { type: 'text', value: str(obj[key]), maxlength: 7, placeholder: '#2BB59A', spellcheck: 'false', autocapitalize: 'off', class: 'mono hex-text' });
    picker.addEventListener('input', () => {
      obj[key] = picker.value.toUpperCase();
      text.value = obj[key];
      text.classList.remove('invalid');
      if (onInput) onInput();
    });
    text.addEventListener('input', () => {
      let v = text.value.trim();
      if (v && v[0] !== '#') v = '#' + v;
      if (isHex(v)) {
        obj[key] = toHex6(v);
        picker.value = obj[key];
        text.classList.remove('invalid');
        if (onInput) onInput();
      } else text.classList.add('invalid');
    });
    return h('div', { class: 'color-input' }, text, picker);
  }
  function checkGroup(o) {
    const box = h('div', { class: 'check-grid' });
    const draw = () => {
      const cur = o.get();
      const known = new Set(o.options.map((x) => x.value));
      const missing = cur.filter((v) => !known.has(v));
      const all = o.options.concat(missing.map((v) => ({ value: v, label: `${v}（不存在）`, missing: true })));
      if (!all.length) { box.replaceChildren(h('p', { class: 'empty' }, o.emptyText || '目前沒有可選的項目。')); return; }
      box.replaceChildren(...all.map((opt) => {
        const cb = h('input', { type: 'checkbox', checked: cur.includes(opt.value) });
        cb.addEventListener('change', () => {
          const now = o.get();
          const next = cb.checked ? (now.includes(opt.value) ? now : now.concat([opt.value])) : now.filter((v) => v !== opt.value);
          o.set(next);
          if (o.onChange) o.onChange(next);
          if (opt.missing && !cb.checked) draw();
        });
        return h('label', { class: 'check' + (opt.missing ? ' missing' : ''), style: opt.color ? { '--c': safeColor(opt.color) } : null },
          cb,
          opt.icon ? h('span', { class: 'check-icon', 'aria-hidden': 'true' }, opt.icon) : (opt.color ? h('span', { class: 'check-dot', 'aria-hidden': 'true' }) : null),
          h('span', { class: 'check-label' }, opt.label));
      }));
    };
    draw();
    return box;
  }
  function emojiPicks(list, onPick, label) {
    return h('div', { class: 'emoji-picks', role: 'group', 'aria-label': label || '快速選擇圖示' },
      list.map((e) => h('button', { type: 'button', class: 'emoji-pick', 'aria-label': `使用 ${e}`, title: e, onclick: () => onPick(e) }, e)));
  }
  function filePickButton(label, accept, onFile, cls) {
    const input = h('input', { type: 'file', accept, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (f) onFile(f);
    });
    const btn = h('button', { type: 'button', class: cls || 'btn', onclick: () => input.click() }, label);
    return h('span', { class: 'file-pick' }, btn, input);
  }
  function rowActions(o) {
    const lbl = o.name ? `「${o.name}」` : `第 ${o.i + 1} 筆`;
    return h('div', { class: 'row-actions' },
      o.onMove ? h('button', { type: 'button', class: 'icon-btn', 'data-fk': `${o.prefix}-up-${o.i}`, 'aria-label': `把${lbl}往上移`, title: '往上移', disabled: o.i === 0, onclick: () => o.onMove(o.i, o.i - 1, 'up') }, '↑') : null,
      o.onMove ? h('button', { type: 'button', class: 'icon-btn', 'data-fk': `${o.prefix}-down-${o.i}`, 'aria-label': `把${lbl}往下移`, title: '往下移', disabled: o.i === o.n - 1, onclick: () => o.onMove(o.i, o.i + 1, 'down') }, '↓') : null,
      o.onEdit ? h('button', { type: 'button', class: 'btn btn-sm btn-soft', 'data-fk': `${o.prefix}-edit-${o.i}`, 'aria-label': `編輯${lbl}`, onclick: () => o.onEdit(o.i) }, '編輯') : null,
      o.onDelete ? h('button', { type: 'button', class: 'btn btn-sm btn-danger-ghost', 'data-fk': `${o.prefix}-del-${o.i}`, 'aria-label': `刪除${lbl}`, onclick: () => o.onDelete(o.i) }, '刪除') : null);
  }
  function footerButtons(onCancel, onSave, saveLabel) {
    return [
      h('button', { type: 'button', class: 'btn', onclick: onCancel }, '取消'),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: onSave }, saveLabel || '儲存')
    ];
  }
  function sectionHead(title, desc, actions) {
    return h('div', { class: 'section-head' },
      h('div', { class: 'section-titles' }, h('h1', null, title), desc ? h('p', { class: 'section-desc' }, desc) : null),
      actions ? h('div', { class: 'section-actions' }, actions) : null);
  }
  function cardEl(title, ...kids) {
    return h('section', { class: 'card' }, title ? h('h2', { class: 'card-title' }, title) : null, kids);
  }
  function emptyState(icon, text, action) {
    return h('div', { class: 'empty-state' }, h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, icon), h('p', null, text), action || null);
  }
  function islandChip(id) {
    const isl = islandById(id);
    if (!isl) return h('span', { class: 'chip chip-missing', title: '這座島不存在' }, `⚠ ${id || '（空白）'}`);
    return h('span', { class: 'chip', style: { '--c': safeColor(isl.color) } }, h('span', { 'aria-hidden': 'true' }, isl.icon), ' ', isl.name || isl.id);
  }
  function valueTags(ids) {
    if (!ids.length) return h('span', { class: 'muted' }, '—');
    return h('span', { class: 'tags' }, ids.map((id) => {
      const v = valueById(id);
      return v
        ? h('span', { class: 'tag', style: { '--c': safeColor(v.color) }, title: v.desc || v.name }, h('b', null, v.id), ' ', v.name)
        : h('span', { class: 'tag tag-missing' }, `⚠ ${id}`);
    }));
  }
  function swatch(color) {
    return h('span', { class: 'swatch-wrap' }, h('span', { class: 'swatch', style: { '--c': safeColor(color) }, 'aria-hidden': 'true' }), h('code', { class: 'mono sub' }, str(color)));
  }
  function idHint(prefix) {
    return `英數字、- 或 _，例如 ${prefix}。改了之後，所有引用會自動更新。`;
  }
  function uniqueId(prefix, used) {
    const set = new Set(used);
    let id;
    do { id = `${prefix}-${randId(4)}`; } while (set.has(id));
    return id;
  }

  /* =====================================================================
   * 區塊：總覽
   * ===================================================================== */
  RENDER.overview = function renderOverview() {
    const d = S.data;
    const items = sum(d.islands, (i) => i.items.length);
    const walkers = totalWalkers(d);
    const month = new Date().getMonth() + 1;
    const today = todaySeason(d);
    const fixed = d.seasons.mode !== 'auto' ? d.seasons.list.find((s) => s.id === d.seasons.mode) : null;
    const issues = validate(d);
    const errs = issues.filter((i) => i.level === 'error');
    const warns = issues.filter((i) => i.level !== 'error');

    const stat = (label, value, section, icon) => h('a', {
      href: '#' + section, class: 'stat',
      onclick: (e) => { e.preventDefault(); go(section); }
    }, h('span', { class: 'stat-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'stat-num' }, String(value)), h('span', { class: 'stat-label' }, label));

    const issueList = (list, level) => h('ul', { class: 'issue-list' }, list.map((it) => h('li', null,
      h('button', { type: 'button', class: `issue issue-${level}`, onclick: () => jump(it.target) },
        h('span', { class: 'issue-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'issue-msg' }, it.msg),
        h('span', { class: 'issue-go', 'aria-hidden': 'true' }, '前往 →')))));

    const checkCard = cardEl('資料檢查',
      !issues.length
        ? h('div', { class: 'all-good' }, h('span', { class: 'all-good-icon', 'aria-hidden': 'true' }, '✓'), h('div', null, h('strong', null, '一切正常'), h('p', { class: 'muted' }, '沒有重複的 ID、重疊的位置或遺失的引用。')))
        : [
          errs.length ? h('h3', { class: 'issue-head is-error' }, `需要修正（${errs.length}）`) : null,
          errs.length ? issueList(errs, 'error') : null,
          warns.length ? h('h3', { class: 'issue-head is-warn' }, `提醒（${warns.length}）`) : null,
          warns.length ? issueList(warns, 'warn') : null
        ]);

    const info = (k, v) => h('div', { class: 'info-row' }, h('dt', null, k), h('dd', null, v));
    const timeMode = TIME_MODES.find((t) => t[0] === d.site.timeMode);
    const infoCard = cardEl('目前狀態', h('dl', { class: 'info-list' },
      info('最後發布', fmtTime(d.updatedAt)),
      info('儲存位置', modeDetail()),
      info('未發布修改', isDirty() ? '有，草稿已自動存在這台裝置' : '沒有'),
      info('今天的季節', today ? `${today.emoji} ${today.title || today.name}（自動模式在 ${month} 月會顯示這一季）` : `⚠ ${month} 月沒有分配給任何季節`),
      info('季節模式', fixed ? `固定顯示 ${fixed.emoji} ${fixed.title || fixed.name}` : '自動依月份輪替'),
      info('時間模式', `${timeMode ? timeMode[1] : d.site.timeMode}・流速 ${d.site.timeSpeed}`),
      info('國際航線', d.airport.enabled ? `開啟・${d.airport.planes} 架飛機降落在 ${islandById(d.airport.island) ? islandById(d.airport.island).name : '（未選擇）'}` : '關閉')));

    return [
      sectionHead('總覽', '教育理念島的資料一覽。修改會自動存成草稿，按右上角「發布」才會更新網站。',
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: preview }, '👀 預覽前台')),
      h('div', { class: 'stats' },
        stat('理念島嶼', d.islands.length, 'islands', '🗺️'),
        stat('理念項目', items, 'islands', '📌'),
        stat('協作連結', d.links.length, 'links', '🔗'),
        stat('人物類型', d.personTypes.length, 'persons', '🚶'),
        stat('島上小人', walkers, 'persons', '👣')),
      h('div', { class: 'two-col' }, checkCard, infoCard)
    ];
  };

  function jump(t) {
    if (!t) return;
    go(t.section, { keepFocus: true });
    requestAnimationFrame(() => {
      const d = S.data;
      if (t.kind === 'island' && d.islands[t.index]) openIslandEditor(t.index);
      else if (t.kind === 'item' && d.islands[t.index]) openIslandEditor(t.index, { item: t.item });
      else if (t.kind === 'link' && d.links[t.index]) openLinkEditor(t.index);
      else if (t.kind === 'person' && d.personTypes[t.index]) openPersonEditor(t.index);
      else if (t.kind === 'value' && d.values[t.index]) openValueEditor(t.index);
      else if (t.kind === 'season') {
        const el = document.getElementById('season-' + t.id);
        if (el) { el.scrollIntoView({ block: 'start' }); flash(el); const f = el.querySelector('input,button'); if (f) f.focus({ preventScroll: true }); }
      } else if (t.kind === 'field') {
        const el = document.querySelector(`[data-fk="${cssEsc(t.fk)}"]`);
        if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); flash(el.closest('.card') || el); }
      } else $('#main').focus();
    });
  }

  /* =====================================================================
   * 區塊：網站設定
   * ===================================================================== */
  RENDER.site = function renderSite() {
    const s = S.data.site;
    const groups = SITE_GROUPS.map((g) => cardEl(g.title,
      g.desc ? h('p', { class: 'card-desc' }, g.desc) : null,
      h('div', { class: 'form-grid' }, g.fields.map((f) => field(f.label,
        textInput(s, f.key, { onInput: changed, multiline: f.multiline, rows: 3, attrs: { 'data-fk': `site-${f.key}` } }),
        f.hint, { wide: f.wide })))));

    const dayLen = h('p', { class: 'hint' });
    const updDay = () => {
      const v = Number(s.timeSpeed);
      dayLen.textContent = v > 0 ? `現實 1 秒 = 島上 ${v} 分鐘；島上一天約等於現實 ${fmtDur(1440 / v)}。` : '設為 0 時，島上的時鐘不會前進。';
    };
    updDay();
    const timeCard = cardEl('一天的時間',
      h('p', { class: 'card-desc' }, '前台的光線會依清晨、白天、黃昏、夜晚變化。'),
      h('div', { class: 'form-grid' },
        field('時間模式', selectInput(s, 'timeMode', TIME_MODES, changed, { attrs: { 'data-fk': 'site-timeMode' } }), '「自動流動」會依島上時鐘輪替；其他選項會固定在那個時段。'),
        field('時間流速（模擬分鐘／每秒）', numberInput(s, 'timeSpeed', { min: 0, max: 1440, step: 0.5, onInput: () => { changed(); updDay(); }, attrs: { 'data-fk': 'site-speed' } }), dayLen)));

    const repo = s.adminRepo;
    const repoIn = (key, ph) => textInput(repo, key, { onInput: changed, placeholder: ph, attrs: { class: 'mono', spellcheck: 'false', autocapitalize: 'off' } });
    const repoCard = cardEl('GitHub 後台設定',
      h('p', { class: 'card-desc' }, 'GitHub 模式的登入畫面會預先帶入這些值（不含 Token）。'),
      h('div', { class: 'form-grid' },
        field('帳號（owner）', repoIn('owner', 'maxchin18')),
        field('Repo 名稱', repoIn('repo', 'max-edu-island')),
        field('分支（branch）', repoIn('branch', 'main')),
        field('資料檔路徑', repoIn('path', 'data/site.json'), '通常是 data/site.json')));

    return [
      sectionHead('網站設定', '網站的標題、文案、導覽與時間設定。'),
      groups,
      cardEl('新手導覽', h('p', { class: 'card-desc' }, '第一次進入網站時出現的導覽步驟，依序顯示。'), tutorialEditor()),
      timeCard,
      repoCard
    ];
  };
  function tutorialEditor() {
    const box = h('div', { class: 'steps' });
    const draw = (...fks) => {
      const list = S.data.site.tutorial;
      box.replaceChildren(
        list.length
          ? h('ol', { class: 'step-list' }, list.map((t, i) => h('li', { class: 'step' },
            h('div', { class: 'step-head' },
              h('span', { class: 'step-num' }, `步驟 ${i + 1}`),
              rowActions({
                i, n: list.length, prefix: 'tut', name: t.title || `步驟 ${i + 1}`,
                onMove: (a, b, dir) => { moveInArray(list, a, b); changed(); draw(...mvKeys('tut', b, dir)); },
                onDelete: (k) => withUndo(`已刪除步驟 ${k + 1}`, (d) => { d.site.tutorial.splice(k, 1); })
              })),
            h('div', { class: 'form-grid' },
              field('標題', textInput(t, 'title', { onInput: changed, attrs: { 'data-fk': `tut-title-${i}` } }), null, { wide: true }),
              field('內容', textInput(t, 'body', { onInput: changed, multiline: true, rows: 3 }), null, { wide: true })))))
          : h('p', { class: 'empty' }, '目前沒有導覽步驟。'),
        h('button', {
          type: 'button', class: 'btn btn-soft', 'data-fk': 'tut-add',
          onclick: () => { list.push({ title: '', body: '' }); changed(); draw(`tut-title-${list.length - 1}`); }
        }, '＋ 新增步驟'));
      focusFk(box, ...fks);
    };
    draw();
    return box;
  }

  /* =====================================================================
   * 區塊：理念島嶼
   * ===================================================================== */
  RENDER.islands = function renderIslands() {
    const d = S.data;
    const n = d.islands.length;
    const addBtn = h('button', { type: 'button', class: 'btn btn-primary', 'data-fk': 'isl-add', onclick: () => openIslandEditor(-1) }, '＋ 新增島嶼');
    const td = (label, ...kids) => h('td', { 'data-label': label }, kids);
    const rows = d.islands.map((isl, i) => h('tr', null,
      td('編號', h('span', { class: 'num' }, pad2(i + 1))),
      td('圖示', h('span', { class: 'tile', style: { '--c': safeColor(isl.color) }, 'aria-hidden': 'true' }, isl.icon || '⬢')),
      td('名稱', h('button', { type: 'button', class: 'link-btn', onclick: () => openIslandEditor(i) }, isl.name || '（未命名）'), h('div', { class: 'sub mono' }, isl.id)),
      td('顏色', swatch(isl.color)),
      td('地標', landmarkLabel(isl.landmark)),
      td('價值面向', valueTags(isl.values)),
      td('項目', h('span', { class: 'count-pill' }, `${isl.items.length} 項`)),
      td('位置', h('span', { class: 'mono' }, `${isl.q}, ${isl.r}`)),
      td('', rowActions({
        i, n, prefix: 'isl', name: isl.name,
        onMove: (a, b, dir) => { moveInArray(S.data.islands, a, b); changed(); rerender(...mvKeys('isl', b, dir)); },
        onEdit: (k) => openIslandEditor(k),
        onDelete: (k) => deleteIsland(k)
      }))));
    const table = h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('caption', { class: 'sr-only' }, '理念島嶼列表'),
      h('thead', null, h('tr', null, ['編號', '圖示', '名稱', '顏色', '地標', '價值面向', '項目', '位置 q, r', h('span', { class: 'sr-only' }, '操作')].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows)));
    const hover = h('p', { class: 'hint map-hover' }, '把滑鼠移到格子上可以看座標；點島嶼可以直接編輯。');
    return [
      sectionHead('理念島嶼', '每座島是一個教育主題。列表順序就是前台顯示的編號（01、02…）。', addBtn),
      cardEl(null, n ? table : emptyState('🏝️', '還沒有任何島嶼。', h('button', { type: 'button', class: 'btn btn-primary', onclick: () => openIslandEditor(-1) }, '＋ 新增第一座島'))),
      n ? cardEl('島嶼地圖', hexGridSVG({ islands: d.islands, onIslandClick: (i) => openIslandEditor(i), onHover: (t) => { hover.textContent = t; }, label: '島嶼地圖，點島嶼可以編輯' }), hover) : null
    ];
  };

  async function deleteIsland(i) {
    const isl = S.data.islands[i];
    if (!isl) return;
    const refs = islandRefs(S.data, isl.id);
    const unique = S.data.islands.filter((x) => x.id === isl.id).length === 1;
    const cb = h('input', { type: 'checkbox', checked: true });
    const extra = refs.total && unique
      ? h('label', { class: 'check-line boxed' }, cb, h('span', null, `同時移除其他地方對這座島的引用（${refs.desc}）`))
      : null;
    const ok = await ask({
      title: `刪除島嶼「${isl.name || isl.id}」？`,
      message: [`島上的 ${isl.items.length} 個理念項目也會一起刪除。`, refs.total && unique ? '若不移除引用，資料檢查會列出遺失的島嶼。' : ''],
      extra, okText: '刪除島嶼', danger: true
    });
    if (!ok) return;
    const removeRefs = !!extra && cb.checked;
    withUndo(`已刪除「${isl.name || isl.id}」`, (d) => {
      d.islands.splice(i, 1);
      if (removeRefs) removeIslandRefs(d, isl.id);
    }, ['isl-add']);
  }

  function newIsland() {
    const pos = firstFreeCell(S.data.islands);
    return {
      id: uniqueId('isl', S.data.islands.map((i) => i.id)), name: '', icon: '🌱', color: '#2BB59A', landmark: 'school',
      q: pos.q, r: pos.r, tagline: '', quote: '', values: [], source: { label: '', url: '' }, items: []
    };
  }

  function openIslandEditor(index, opts) {
    opts = opts || {};
    const isNew = index < 0;
    if (!isNew && !S.data.islands[index]) return;
    const isl = isNew ? newIsland() : clone(S.data.islands[index]);
    const oldId = isNew ? null : isl.id;
    let layer = null;
    const mark = () => { if (layer) layer.dirty = true; };
    const others = () => S.data.islands.filter((_, i) => i !== index);
    const otherIndexes = () => S.data.islands.map((_, i) => i).filter((i) => i !== index);

    // 預覽
    const pvTile = h('span', { class: 'tile tile-lg', 'aria-hidden': 'true' });
    const pvName = h('strong', { class: 'pv-name' });
    const pvSub = h('span', { class: 'sub' });
    const updatePreview = () => {
      pvTile.textContent = isl.icon || '⬢';
      pvTile.style.setProperty('--c', safeColor(isl.color));
      pvName.textContent = isl.name || '（未命名島嶼）';
      pvSub.textContent = `${landmarkLabel(isl.landmark)}・位置 q ${isl.q}, r ${isl.r}・${isl.items.length} 個項目`;
    };
    const onBasic = () => { mark(); updatePreview(); };

    const nameIn = textInput(isl, 'name', { onInput: onBasic, attrs: { maxlength: 40, required: true } });
    const idIn = textInput(isl, 'id', { onInput: mark, attrs: { class: 'mono', spellcheck: 'false', autocapitalize: 'off', maxlength: 40 } });
    const iconIn = textInput(isl, 'icon', { onInput: () => { onBasic(); drawPicker(); }, attrs: { class: 'emoji-input', maxlength: 16 } });
    const iconPicks = emojiPicks(ISLAND_EMOJIS, (e) => { isl.icon = e; iconIn.value = e; onBasic(); drawPicker(); }, '快速選擇島嶼圖示');
    const colorIn = colorInput(isl, 'color', () => { onBasic(); drawPicker(); });
    const landIn = selectInput(isl, 'landmark', LANDMARKS.map((l) => [l[0], `${l[1]}（${l[0]}）`]), onBasic);
    const tagIn = textInput(isl, 'tagline', { onInput: mark });
    const quoteIn = textInput(isl, 'quote', { onInput: mark, multiline: true, rows: 2 });
    const valuesBox = checkGroup({
      get: () => isl.values, set: (v) => { isl.values = v; }, onChange: mark,
      options: S.data.values.map((v) => ({ value: v.id, label: `${v.id}・${v.name}`, color: v.color })),
      emptyText: '還沒有價值面向，可以到「價值面向」新增。'
    });
    const srcLabel = textInput(isl.source, 'label', { onInput: mark, placeholder: '例如：教育部新聞稿' });
    const srcUrl = textInput(isl.source, 'url', { onInput: mark, type: 'url', placeholder: 'https://' });

    // 位置
    const pickerBox = h('div', { class: 'picker-box' });
    const posMsg = h('p', { class: 'hint', 'aria-live': 'polite' }, '點選空白格子即可移動這座島；有顏色的格子已經被其他島使用。');
    const qIn = h('input', { type: 'number', step: 1, class: 'num-input', value: isl.q });
    const rIn = h('input', { type: 'number', step: 1, class: 'num-input', value: isl.r });
    const setPos = (q, r) => {
      isl.q = q; isl.r = r;
      qIn.value = q; rIn.value = r;
      posMsg.textContent = `已移到 q ${q}, r ${r}。`;
      posMsg.classList.remove('error-text');
      mark(); updatePreview(); drawPicker();
    };
    const onPosInput = () => {
      const q = Number(qIn.value);
      const r = Number(rIn.value);
      if (!Number.isInteger(q) || !Number.isInteger(r)) { posMsg.textContent = '座標必須是整數。'; posMsg.classList.add('error-text'); return; }
      const taken = others().find((x) => x.q === q && x.r === r);
      if (taken) {
        posMsg.textContent = `q ${q}, r ${r} 已經是「${taken.name || taken.id}」的位置，請換一格。`;
        posMsg.classList.add('error-text');
        qIn.value = isl.q; rIn.value = isl.r;
        return;
      }
      setPos(q, r);
    };
    qIn.addEventListener('change', onPosInput);
    rIn.addEventListener('change', onPosInput);
    function drawPicker() {
      pickerBox.replaceChildren(hexGridSVG({
        islands: others(), indexMap: otherIndexes(), editing: isl, onPick: setPos,
        onHover: (t) => { posMsg.textContent = t; posMsg.classList.remove('error-text'); },
        label: '島嶼位置選擇器，點空白格子設定位置'
      }));
    }

    // 理念項目
    const itemsBox = h('div', { class: 'items-box' });
    const itemsTitle = h('span');
    function drawItems(...fks) {
      itemsTitle.textContent = `理念項目（${isl.items.length}）`;
      const list = isl.items;
      itemsBox.replaceChildren(
        list.length
          ? h('ol', { class: 'item-list' }, list.map((it, j) => h('li', { class: 'item-row' },
            h('span', { class: 'num' }, pad2(j + 1)),
            h('div', { class: 'item-main' },
              h('button', { type: 'button', class: 'link-btn', onclick: () => editItem(j) }, it.name || '（未命名項目）'),
              h('div', { class: 'sub' }, [it.phase, it.target].filter(Boolean).join('・') || '—', it.image ? '・🖼️' : '', it.link ? '・🔗' : '')),
            rowActions({
              i: j, n: list.length, prefix: 'item', name: it.name,
              onMove: (a, b, dir) => { moveInArray(list, a, b); mark(); drawItems(...mvKeys('item', b, dir)); },
              onEdit: (k) => editItem(k),
              onDelete: (k) => deleteItem(k)
            }))))
          : h('p', { class: 'empty' }, '還沒有理念項目。'),
        h('button', { type: 'button', class: 'btn btn-soft', 'data-fk': 'item-add', onclick: () => editItem(-1) }, '＋ 新增項目'));
      updatePreview();
      focusFk(itemsBox, ...fks);
    }
    async function deleteItem(k) {
      const it = isl.items[k];
      const ok = await ask({ title: `刪除項目「${it.name || '未命名'}」？`, message: '按下「儲存島嶼」後才會正式生效。', okText: '刪除', danger: true });
      if (!ok) return;
      isl.items.splice(k, 1);
      mark();
      drawItems(`item-del-${Math.min(k, isl.items.length - 1)}`, 'item-add');
    }
    function editItem(j) {
      const isNewItem = j < 0;
      const it = isNewItem ? newItemFor(isl, index) : clone(isl.items[j]);
      openItemEditor(it, isNewItem, (saved) => {
        if (isNewItem) isl.items.push(saved); else isl.items[j] = saved;
        mark();
        drawItems(`item-edit-${isNewItem ? isl.items.length - 1 : j}`);
      });
    }

    const section = (title, ...kids) => h('section', { class: 'form-section' }, h('h3', { class: 'form-section-title' }, title), kids);
    const body = [
      h('div', { class: 'drawer-preview' }, pvTile, h('div', { class: 'pv-text' }, pvName, pvSub)),
      section('基本資料', h('div', { class: 'form-grid' },
        field('島嶼名稱', nameIn, null, { required: true }),
        field('ID（代號）', idIn, idHint('food、ocean')),
        field('圖示', h('div', { class: 'emoji-field' }, iconIn, iconPicks), '可以貼上任何 emoji，或從下方挑選。', { wide: true }),
        field('主題色', colorIn),
        field('地標造型', landIn, '島上會出現的代表建築。'))),
      section('文案', h('div', { class: 'form-grid' },
        field('一句話標語', tagIn, null, { wide: true }),
        field('理念引言', quoteIn, null, { wide: true }))),
      section('價值面向', valuesBox),
      section('資料來源', h('div', { class: 'form-grid' }, field('來源名稱', srcLabel), field('來源網址', srcUrl))),
      section('地圖位置',
        h('div', { class: 'pos-inputs' },
          h('label', null, h('span', null, 'q'), qIn),
          h('label', null, h('span', null, 'r'), rIn),
          h('span', { class: 'hint' }, '六角格座標（axial）。')),
        pickerBox, posMsg),
      h('section', { class: 'form-section' }, h('h3', { class: 'form-section-title' }, itemsTitle), itemsBox)
    ];

    const save = () => {
      const D = S.data;
      if (!str(isl.name).trim()) { toast('請填寫島嶼名稱', 'error'); nameIn.focus(); return; }
      isl.name = isl.name.trim();
      const id = str(isl.id).trim();
      if (!ID_RE.test(id)) { toast('ID 只能用英文、數字、- 或 _，而且不能空白', 'error'); idIn.focus(); return; }
      if (D.islands.some((x, i) => i !== index && x.id === id)) { toast(`ID「${id}」已經被其他島使用`, 'error'); idIn.focus(); return; }
      isl.id = id;
      const taken = others().find((x) => x.q === isl.q && x.r === isl.r);
      if (taken) { toast(`位置和「${taken.name || taken.id}」重疊，請換一格`, 'error'); qIn.focus(); return; }
      if (isNew) D.islands.push(isl); else D.islands[index] = isl;
      if (!isNew && oldId !== id && oldId) renameIslandRefs(D, oldId, id);
      layer.close();
      changed();
      rerender(isNew ? `isl-edit-${D.islands.length - 1}` : `isl-edit-${index}`);
      toast(isNew ? `已新增島嶼「${isl.name}」` : (oldId !== id ? `已儲存，並把所有「${oldId}」的引用改成「${id}」` : `已儲存「${isl.name}」`));
    };

    layer = openLayer({
      kind: 'drawer', title: isNew ? '新增島嶼' : `編輯島嶼：${isl.name || isl.id}`,
      body, footer: footerButtons(() => layer.requestClose(), save, isNew ? '新增島嶼' : '儲存島嶼'),
      onRequestClose: confirmDiscard,
      initialFocus: () => (opts.item != null ? null : nameIn)
    });
    updatePreview();
    drawPicker();
    drawItems();
    if (opts.item != null && isl.items[opts.item]) setTimeout(() => editItem(opts.item), 30);
  }

  function newItemFor(isl, islandIndex) {
    const used = new Set();
    S.data.islands.forEach((x, i) => { if (i !== islandIndex) x.items.forEach((it) => used.add(it.id)); });
    isl.items.forEach((it) => used.add(it.id));
    const base = str(isl.id).trim() || 'item';
    let n = isl.items.length + 1;
    while (used.has(`${base}-${n}`)) n++;
    return { id: `${base}-${n}`, name: '', phase: '', target: '', summary: '', points: [], schedule: '', image: '', link: '' };
  }

  function openItemEditor(it, isNewItem, onSave) {
    let layer = null;
    const mark = () => { if (layer) layer.dirty = true; };
    const nameIn = textInput(it, 'name', { onInput: mark, attrs: { maxlength: 60 } });
    const dlId = elId('phases');
    const phaseIn = textInput(it, 'phase', { onInput: mark, attrs: { list: dlId, autocomplete: 'off' } });
    const phaseChips = h('div', { class: 'quick-chips', role: 'group', 'aria-label': '常用時程' },
      S.data.phases.map((p) => h('button', { type: 'button', class: 'chip-btn', onclick: () => { it.phase = p; phaseIn.value = p; mark(); } }, p)));
    const targetIn = textInput(it, 'target', { onInput: mark, placeholder: '例如：全校學生' });
    const summaryIn = textInput(it, 'summary', { onInput: mark, multiline: true, rows: 3 });
    const pointsIn = h('textarea', { rows: 4, value: it.points.join('\n'), placeholder: '一行一個重點' });
    pointsIn.addEventListener('input', () => { it.points = pointsIn.value.split('\n').map((x) => x.trim()).filter(Boolean); mark(); });
    const schedIn = textInput(it, 'schedule', { onInput: mark, placeholder: '例如：每學期期末更新' });
    const linkIn = textInput(it, 'link', { onInput: mark, type: 'url', placeholder: 'https://' });

    const thumb = h('img', { class: 'thumb', alt: '圖片預覽', hidden: true });
    const thumbMsg = h('span', { class: 'hint' });
    const updThumb = () => {
      const src = resolveAsset(it.image);
      thumb.classList.remove('broken');
      if (src) { thumb.src = src; thumb.hidden = false; thumbMsg.textContent = ''; } else { thumb.hidden = true; thumb.removeAttribute('src'); thumbMsg.textContent = it.image ? '無法預覽這個網址' : ''; }
    };
    thumb.addEventListener('error', () => { thumb.hidden = true; thumbMsg.textContent = '圖片暫時無法顯示（GitHub Pages 部署後才看得到，或網址有誤）'; });
    const imgIn = textInput(it, 'image', { onInput: () => { mark(); updThumb(); }, placeholder: 'assets/uploads/… 或 https://…' });
    const canUpload = S.mode === 'local' || S.mode === 'github';
    const upload = canUpload ? filePickButton('上傳圖片', 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml', async (file) => {
      const btn = upload.querySelector('button');
      btn.disabled = true;
      btn.textContent = '上傳中…';
      try {
        const path = await uploadImage(file);
        it.image = path;
        imgIn.value = path;
        mark();
        updThumb();
        toast(S.mode === 'github' ? '圖片已上傳到 GitHub（Pages 部署後前台才看得到）' : '圖片已上傳');
      } catch (e) {
        toast('上傳失敗：' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '上傳圖片';
      }
    }, 'btn btn-soft') : null;
    const imgHint = canUpload ? '可以上傳圖片（8 MB 以內），或貼上圖片網址。' : '離線模式無法上傳，請貼上圖片網址。';

    const body = [
      h('p', { class: 'sub mono item-id' }, `ID：${it.id}`),
      h('div', { class: 'form-grid' },
        field('項目名稱', nameIn, null, { required: true, wide: true }),
        field('時程', h('div', null, phaseIn, h('datalist', { id: dlId }, S.data.phases.map((p) => h('option', { value: p }))), phaseChips), '可從清單挑選，也可以自己輸入。'),
        field('對象', targetIn),
        field('說明', summaryIn, null, { wide: true }),
        field('重點（一行一個）', pointsIn, null, { wide: true }),
        field('執行方式／時間', schedIn),
        field('相關連結', linkIn),
        field('圖片', h('div', { class: 'image-field' }, h('div', { class: 'image-row' }, imgIn, upload), h('div', { class: 'thumb-row' }, thumb, thumbMsg)), imgHint, { wide: true }))
    ];
    const done = () => {
      if (!str(it.name).trim()) { toast('請填寫項目名稱', 'error'); nameIn.focus(); return; }
      it.name = it.name.trim();
      layer.close();
      onSave(it);
    };
    layer = openLayer({
      kind: 'modal', wide: true, title: isNewItem ? '新增理念項目' : `編輯項目：${it.name || '未命名'}`,
      body, footer: footerButtons(() => layer.requestClose(), done, isNewItem ? '加入項目' : '完成'),
      onRequestClose: confirmDiscard, initialFocus: () => nameIn
    });
    updThumb();
  }

  /* =====================================================================
   * 區塊：協作連結
   * ===================================================================== */
  function nextLinkId() {
    let max = 0;
    S.data.links.forEach((l) => { const m = /^C(\d+)$/i.exec(str(l.id).trim()); if (m) max = Math.max(max, Number(m[1])); });
    let n = max + 1;
    while (S.data.links.some((l) => l.id === `C${n}`)) n++;
    return `C${n}`;
  }
  RENDER.links = function renderLinks() {
    const d = S.data;
    if (S.linkFilter && !islandById(S.linkFilter)) S.linkFilter = '';
    const add = h('button', { type: 'button', class: 'btn btn-primary', 'data-fk': 'link-add', disabled: d.islands.length < 2, onclick: () => openLinkEditor(-1) }, '＋ 新增協作連結');
    const filter = h('select', { 'data-fk': 'link-filter', 'aria-label': '依島嶼篩選協作連結', value: S.linkFilter },
      h('option', { value: '' }, '全部島嶼'), d.islands.map((i) => h('option', { value: i.id }, `${i.icon} ${i.name || i.id}`)));
    filter.addEventListener('change', () => { S.linkFilter = filter.value; rerender('link-filter'); });
    const shown = d.links.map((l, i) => ({ l, i })).filter(({ l }) => !S.linkFilter || l.from === S.linkFilter || l.to.includes(S.linkFilter));
    const list = shown.map(({ l, i }) => h('li', { class: 'link-card' },
      h('span', { class: 'code' }, l.id || '?'),
      h('div', { class: 'link-body' },
        h('div', { class: 'link-route' }, islandChip(l.from), h('span', { class: 'arrow' }, h('span', { 'aria-hidden': 'true' }, '→'), h('span', { class: 'sr-only' }, '連到')), l.to.length ? l.to.map(islandChip) : h('span', { class: 'chip chip-missing' }, '⚠ 沒有目標')),
        h('p', { class: 'link-title' }, l.title || '（未填寫說明）'),
        l.basis ? h('span', { class: 'tag tag-soft' }, l.basis) : null),
      rowActions({ i, n: d.links.length, prefix: 'link', name: l.id, onEdit: openLinkEditor, onDelete: deleteLink })));
    return [
      sectionHead('協作連結', '島與島之間的合作關係（一對多）。前台的小人會沿著這些連結搬運東西。', add),
      cardEl(null,
        h('div', { class: 'toolbar' }, h('label', { class: 'toolbar-label' }, '篩選', filter), h('span', { class: 'muted' }, `共 ${d.links.length} 條${S.linkFilter ? `，顯示 ${shown.length} 條` : ''}`)),
        d.islands.length < 2 ? h('p', { class: 'hint' }, '至少要有兩座島才能建立協作連結。') : null,
        list.length ? h('ul', { class: 'link-list' }, list) : emptyState('🔗', S.linkFilter ? '這座島沒有相關的協作連結。' : '還沒有協作連結。'))
    ];
  };
  function deleteLink(i) {
    const l = S.data.links[i];
    ask({ title: `刪除協作連結 ${l.id}？`, message: l.title || '', okText: '刪除', danger: true }).then((ok) => {
      if (!ok) return;
      withUndo(`已刪除協作連結 ${l.id}`, (d) => { d.links.splice(i, 1); }, [`link-del-${i}`, `link-del-${i - 1}`, 'link-add']);
    });
  }
  function openLinkEditor(index) {
    const D = S.data;
    const isNew = index < 0;
    if (!isNew && !D.links[index]) return;
    const defaultFrom = S.linkFilter && islandById(S.linkFilter) ? S.linkFilter : (D.islands[0] ? D.islands[0].id : '');
    const l = isNew ? { id: nextLinkId(), from: defaultFrom, to: [], title: '', basis: D.linkBasis[0] || '' } : clone(D.links[index]);
    let layer = null;
    const mark = () => { if (layer) layer.dirty = true; };
    const idIn = textInput(l, 'id', { onInput: mark, attrs: { class: 'mono', spellcheck: 'false', maxlength: 16 } });
    const fromSel = h('select', { value: l.from },
      !islandById(l.from) ? h('option', { value: l.from }, `⚠ ${l.from || '（請選擇）'}`) : null,
      D.islands.map((i) => h('option', { value: i.id }, `${i.icon} ${i.name || i.id}`)));
    const toBox = h('div');
    const drawTo = () => {
      toBox.replaceChildren(checkGroup({ get: () => l.to, set: (v) => { l.to = v; }, onChange: mark, options: islandOptions(l.from) }));
    };
    fromSel.addEventListener('change', () => { l.from = fromSel.value; l.to = l.to.filter((x) => x !== l.from); mark(); drawTo(); });
    drawTo();
    const titleIn = textInput(l, 'title', { onInput: mark, multiline: true, rows: 2, placeholder: '一句話說明這些島怎麼合作' });
    const basisSel = selectInput(l, 'basis', D.linkBasis.map((b) => [b, b]), mark, { allowEmpty: true, emptyLabel: '（不指定）' });
    const body = h('div', { class: 'form-grid' },
      field('代碼', idIn, '例如 C1、C2，不能重複。'),
      field('連結依據', basisSel, '選項可以在「選項清單」管理。'),
      field('起點島', fromSel, null, { wide: true }),
      fieldGroup('連到哪些島（可複選）', toBox, '至少選一座。', { wide: true }),
      field('連結說明', titleIn, null, { wide: true }));
    const save = () => {
      const DD = S.data;
      l.id = str(l.id).trim();
      if (!l.id) { toast('請填寫代碼', 'error'); idIn.focus(); return; }
      if (DD.links.some((x, j) => j !== index && x.id === l.id)) { toast(`代碼「${l.id}」已經被使用`, 'error'); idIn.focus(); return; }
      if (!islandById(l.from)) { toast('請選擇起點島', 'error'); fromSel.focus(); return; }
      if (!l.to.length) { toast('請至少選一座要連到的島', 'error'); const f = toBox.querySelector('input'); if (f) f.focus(); return; }
      if (isNew) DD.links.push(l); else DD.links[index] = l;
      layer.close();
      changed();
      rerender(isNew ? `link-edit-${DD.links.length - 1}` : `link-edit-${index}`, 'link-add');
      toast(isNew ? `已新增協作連結 ${l.id}` : `已儲存協作連結 ${l.id}`);
    };
    layer = openLayer({
      kind: 'drawer', title: isNew ? '新增協作連結' : `編輯協作連結 ${l.id}`, body,
      footer: footerButtons(() => layer.requestClose(), save, isNew ? '新增連結' : '儲存連結'),
      onRequestClose: confirmDiscard, initialFocus: () => fromSel
    });
  }

  /* =====================================================================
   * 區塊：人物類型
   * ===================================================================== */
  RENDER.persons = function renderPersons() {
    const d = S.data;
    const total = totalWalkers(d);
    const over = total > WALKER_WARN;
    const add = h('button', { type: 'button', class: 'btn btn-primary btn-lg', 'data-fk': 'person-add', onclick: () => openPersonEditor(-1) }, '＋ 新增人物類型');
    const meter = cardEl(null, h('div', { class: 'walker-meter' + (over ? ' is-over' : '') },
      h('div', { class: 'walker-num' }, h('span', { class: 'big-num' }, String(total)), h('span', null, ' 位小人在島上走動')),
      h('div', { class: 'meter', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '150', 'aria-valuenow': String(total), 'aria-label': '島上小人總數' },
        h('span', { class: 'meter-fill', style: { width: `${Math.min(100, (total / 150) * 100)}%` } }),
        h('span', { class: 'meter-mark', style: { left: `${(WALKER_WARN / 150) * 100}%` }, title: `建議上限 ${WALKER_WARN}` })),
      h('p', { class: over ? 'warn-text' : 'hint' }, over ? `超過 ${WALKER_WARN} 位，手機或舊電腦可能會變慢，建議降低部分人物的人數。` : `建議總數在 ${WALKER_WARN} 位以內，前台會比較順暢。`)));
    const cards = d.personTypes.map((p, i) => h('li', { class: 'person-card', style: { '--c': safeColor(p.color) } },
      h('div', { class: 'person-top' },
        h('span', { class: 'person-emoji', 'aria-hidden': 'true' }, p.emoji || '🙂'),
        h('div', { class: 'person-head' }, h('h3', null, p.name || '（未命名）'), h('span', { class: 'sub mono' }, p.id)),
        h('span', { class: 'person-count', title: '島上人數' }, `× ${p.count}`)),
      p.desc ? h('p', { class: 'person-desc' }, p.desc) : null,
      h('div', { class: 'person-meta' },
        h('span', { class: 'meta-label' }, '常去'),
        p.homes.length ? h('span', { class: 'chips' }, p.homes.map(islandChip)) : h('span', { class: 'muted' }, '全島都會去')),
      h('div', { class: 'person-meta' },
        h('span', { class: 'meta-label' }, '搬運'),
        p.carry.length ? h('span', { class: 'carry-row' }, p.carry.map((c) => h('span', { class: 'carry', title: c.name }, h('span', { 'aria-hidden': 'true' }, c.emoji), h('span', { class: 'carry-name' }, c.name)))) : h('span', { class: 'warn-text' }, '⚠ 沒有物品')),
      rowActions({
        i, n: d.personTypes.length, prefix: 'person', name: p.name,
        onMove: (a, b, dir) => { moveInArray(S.data.personTypes, a, b); changed(); rerender(...mvKeys('person', b, dir)); },
        onEdit: openPersonEditor, onDelete: deletePerson
      })));
    cards.push(h('li', { class: 'person-card person-add' },
      h('button', { type: 'button', class: 'add-tile', onclick: () => openPersonEditor(-1) }, h('span', { class: 'add-plus', 'aria-hidden': 'true' }, '＋'), h('span', null, '新增人物類型'))));
    return [
      sectionHead('人物類型', '在島與島之間走動、搬運東西的小人。可以自由新增新的角色。', add),
      meter,
      h('ul', { class: 'person-grid' }, cards)
    ];
  };
  function deletePerson(i) {
    const p = S.data.personTypes[i];
    ask({ title: `刪除人物類型「${p.name || p.id}」？`, message: `島上的 ${p.count} 位「${p.name}」會一起消失。`, okText: '刪除', danger: true }).then((ok) => {
      if (!ok) return;
      withUndo(`已刪除人物類型「${p.name || p.id}」`, (d) => { d.personTypes.splice(i, 1); }, ['person-add']);
    });
  }
  function newPerson() {
    return { id: uniqueId('p', S.data.personTypes.map((p) => p.id)), name: '', emoji: '🧑', color: '#2BB59A', count: 3, desc: '', homes: [], carry: [{ emoji: '📦', name: '' }] };
  }
  function openPersonEditor(index) {
    const isNew = index < 0;
    if (!isNew && !S.data.personTypes[index]) return;
    const p = isNew ? newPerson() : clone(S.data.personTypes[index]);
    p.count = clampInt(p.count, 0, 30);
    let layer = null;
    const mark = () => { if (layer) layer.dirty = true; };

    const pvEmoji = h('span', { class: 'person-emoji', 'aria-hidden': 'true' });
    const pvName = h('strong', { class: 'pv-name' });
    const pvSub = h('span', { class: 'sub' });
    const pvBox = h('div', { class: 'drawer-preview person-preview' }, pvEmoji, h('div', { class: 'pv-text' }, pvName, pvSub));
    const upd = () => {
      pvEmoji.textContent = p.emoji || '🙂';
      pvBox.style.setProperty('--c', safeColor(p.color));
      pvName.textContent = p.name || '（未命名人物）';
      pvSub.textContent = `${p.count} 位・${p.homes.length ? `常去 ${p.homes.length} 座島` : '全島都會去'}・搬運 ${p.carry.length} 種物品`;
    };
    const onBasic = () => { mark(); upd(); };

    const nameIn = textInput(p, 'name', { onInput: onBasic, attrs: { maxlength: 20 } });
    const idIn = textInput(p, 'id', { onInput: mark, attrs: { class: 'mono', spellcheck: 'false', autocapitalize: 'off', maxlength: 40 } });
    const emojiIn = textInput(p, 'emoji', { onInput: onBasic, attrs: { class: 'emoji-input', maxlength: 16 } });
    const picks = emojiPicks(PERSON_EMOJIS, (e) => { p.emoji = e; emojiIn.value = e; onBasic(); }, '快速選擇人物圖示');
    const colorIn = colorInput(p, 'color', onBasic);

    const othersTotal = sum(S.data.personTypes.filter((_, j) => j !== index), (x) => Math.max(0, Number(x.count) || 0));
    const totalEl = h('p', { class: 'hint', 'aria-live': 'polite' });
    const updTotal = () => {
      const t = othersTotal + p.count;
      totalEl.textContent = `加上這個類型，島上共 ${t} 位小人。` + (t > WALKER_WARN ? `超過 ${WALKER_WARN} 位，前台可能會變慢。` : '');
      totalEl.classList.toggle('warn-text', t > WALKER_WARN);
    };
    const countNum = h('input', { type: 'number', min: 0, max: 30, step: 1, value: p.count, class: 'num-input', inputmode: 'numeric', 'aria-label': '人數（數字）' });
    const countRange = h('input', { type: 'range', min: 0, max: 30, step: 1, value: p.count, 'aria-label': '人數（滑桿）' });
    const syncCount = (v) => {
      p.count = clampInt(v, 0, 30);
      countNum.value = p.count;
      countRange.value = p.count;
      mark(); upd(); updTotal();
    };
    countRange.addEventListener('input', () => syncCount(countRange.value));
    countNum.addEventListener('change', () => syncCount(countNum.value));
    updTotal();

    const descIn = textInput(p, 'desc', { onInput: mark, multiline: true, rows: 2 });
    const homesBox = checkGroup({ get: () => p.homes, set: (v) => { p.homes = v; }, onChange: onBasic, options: islandOptions() });

    const carryBox = h('div', { class: 'carry-editor' });
    function drawCarry(...fks) {
      carryBox.replaceChildren(
        h('ul', { class: 'carry-list' }, p.carry.map((c, k) => {
          const e = h('input', { type: 'text', class: 'emoji-input', value: c.emoji, maxlength: 16, 'aria-label': `物品 ${k + 1} 的圖示`, 'data-fk': `carry-emoji-${k}` });
          e.addEventListener('input', () => { c.emoji = e.value; mark(); });
          const n = h('input', { type: 'text', value: c.name, maxlength: 20, placeholder: '物品名稱', 'aria-label': `物品 ${k + 1} 的名稱`, 'data-fk': `carry-name-${k}` });
          n.addEventListener('input', () => { c.name = n.value; mark(); });
          return h('li', { class: 'carry-edit-row' }, e, n,
            h('button', {
              type: 'button', class: 'icon-btn danger', 'aria-label': `移除物品 ${k + 1}`, title: '移除', disabled: p.carry.length <= 1,
              'data-fk': `carry-del-${k}`,
              onclick: () => { p.carry.splice(k, 1); onBasic(); drawCarry(`carry-del-${Math.min(k, p.carry.length - 1)}`); }
            }, '✕'));
        })),
        h('div', { class: 'carry-add' },
          h('button', { type: 'button', class: 'btn btn-soft btn-sm', 'data-fk': 'carry-add', onclick: () => { p.carry.push({ emoji: '📦', name: '' }); onBasic(); drawCarry(`carry-name-${p.carry.length - 1}`); } }, '＋ 新增物品'),
          h('span', { class: 'hint' }, '或點圖示快速加入：')),
        emojiPicks(CARRY_EMOJIS, (em) => { p.carry.push({ emoji: em, name: '' }); onBasic(); drawCarry(`carry-name-${p.carry.length - 1}`); }, '快速加入物品'));
      focusFk(carryBox, ...fks);
    }
    drawCarry();

    const section = (title, ...kids) => h('section', { class: 'form-section' }, h('h3', { class: 'form-section-title' }, title), kids);
    const body = [
      pvBox,
      section('基本資料', h('div', { class: 'form-grid' },
        field('名稱', nameIn, null, { required: true }),
        field('ID（代號）', idIn, '英數字、- 或 _，例如 student。'),
        field('圖示', h('div', { class: 'emoji-field' }, emojiIn, picks), null, { wide: true }),
        field('代表色', colorIn),
        field('島上人數（0–30）', h('div', { class: 'count-field' }, countRange, countNum), totalEl),
        field('介紹', descIn, '前台點小人時會顯示。', { wide: true }))),
      section('常去的島', homesBox, h('p', { class: 'hint' }, '不勾 = 全島都會去。')),
      section('搬運的物品（至少一個）', carryBox)
    ];
    const save = () => {
      const D = S.data;
      if (!str(p.name).trim()) { toast('請填寫人物名稱', 'error'); nameIn.focus(); return; }
      p.name = p.name.trim();
      p.id = str(p.id).trim();
      if (!ID_RE.test(p.id)) { toast('ID 只能用英文、數字、- 或 _，而且不能空白', 'error'); idIn.focus(); return; }
      if (D.personTypes.some((x, j) => j !== index && x.id === p.id)) { toast(`ID「${p.id}」已經被其他人物類型使用`, 'error'); idIn.focus(); return; }
      const carry = p.carry.filter((c) => str(c.emoji).trim() || str(c.name).trim());
      if (!carry.some((c) => str(c.emoji).trim())) {
        toast('請至少設定一個要搬運的物品（需要圖示）', 'error');
        if (!p.carry.length) { p.carry.push({ emoji: '', name: '' }); drawCarry(); }
        focusFk(carryBox, 'carry-emoji-0');
        return;
      }
      p.carry = carry;
      if (isNew) D.personTypes.push(p); else D.personTypes[index] = p;
      layer.close();
      changed();
      rerender(isNew ? `person-edit-${D.personTypes.length - 1}` : `person-edit-${index}`);
      toast(isNew ? `已新增人物類型「${p.name}」` : `已儲存「${p.name}」`);
    };
    layer = openLayer({
      kind: 'drawer', title: isNew ? '新增人物類型' : `編輯人物類型：${p.name || p.id}`, body,
      footer: footerButtons(() => layer.requestClose(), save, isNew ? '新增人物類型' : '儲存'),
      onRequestClose: confirmDiscard, initialFocus: () => nameIn
    });
    upd();
  }

  /* =====================================================================
   * 區塊：國際航線
   * ===================================================================== */
  RENDER.airport = function renderAirport() {
    const d = S.data;
    const ap = d.airport;
    const statusEl = h('span');
    const updStatus = () => {
      statusEl.className = 'pill ' + (ap.enabled ? 'pill-ok' : 'pill-off');
      statusEl.textContent = ap.enabled ? '航線開啟中' : '航線關閉';
    };
    updStatus();
    const toggle = h('input', { type: 'checkbox', class: 'switch-input', checked: ap.enabled, role: 'switch', 'data-fk': 'air-enabled' });
    toggle.addEventListener('change', () => { ap.enabled = toggle.checked; toggle.setAttribute('aria-checked', String(ap.enabled)); updStatus(); changed(); });
    toggle.setAttribute('aria-checked', String(ap.enabled));

    const islandSel = h('select', { 'data-fk': 'air-island', value: ap.island },
      h('option', { value: '' }, '（請選擇降落的島）'),
      ap.island && !islandById(ap.island) ? h('option', { value: ap.island }, `⚠ ${ap.island}（不存在）`) : null,
      d.islands.map((i) => h('option', { value: i.id }, `${i.icon} ${i.name || i.id}`)));
    islandSel.addEventListener('change', () => { ap.island = islandSel.value; changed(); });

    const planes = numberInput(ap, 'planes', { min: 0, max: 4, step: 1, integer: true, onInput: changed, attrs: { 'data-fk': 'air-planes' } });

    const settings = cardEl('航線設定',
      h('div', { class: 'switch-row' },
        h('label', { class: 'switch' }, toggle, h('span', { class: 'switch-track', 'aria-hidden': 'true' }, h('span', { class: 'switch-thumb' })), h('span', { class: 'switch-label' }, '開啟國際航線')),
        statusEl),
      h('div', { class: 'form-grid' },
        field('飛機降落的島', islandSel, '飛機會把國際夥伴送到這座島。'),
        field('同時飛行的飛機（0–4 架）', planes, '數量越多，畫面越熱鬧。')));

    const partners = ap.partners;
    const rows = partners.map((p, i) => {
      const flag = h('input', { type: 'text', class: 'emoji-input', value: p.flag, maxlength: 16, 'aria-label': `夥伴 ${i + 1} 的國旗`, 'data-fk': `air-flag-${i}` });
      flag.addEventListener('input', () => { p.flag = flag.value; changed(); });
      const name = h('input', { type: 'text', value: p.name, maxlength: 40, placeholder: '例如：日本・姊妹校', 'aria-label': `夥伴 ${i + 1} 的名稱`, 'data-fk': `air-name-${i}` });
      name.addEventListener('input', () => { p.name = name.value; changed(); });
      const carry = h('input', { type: 'text', value: p.carry, maxlength: 40, placeholder: '例如：視訊交流邀請', 'aria-label': `夥伴 ${i + 1} 帶來的東西`, 'data-fk': `air-carry-${i}` });
      carry.addEventListener('input', () => { p.carry = carry.value; changed(); });
      return h('li', { class: 'partner-row' },
        h('span', { class: 'num' }, pad2(i + 1)),
        h('div', { class: 'partner-fields' },
          h('label', { class: 'mini-field mf-flag' }, h('span', null, '國旗'), flag),
          h('label', { class: 'mini-field mf-name' }, h('span', null, '夥伴名稱'), name),
          h('label', { class: 'mini-field mf-carry' }, h('span', null, '帶來的東西'), carry)),
        rowActions({
          i, n: partners.length, prefix: 'air', name: p.name,
          onMove: (a, b, dir) => { moveInArray(partners, a, b); changed(); rerender(...mvKeys('air', b, dir)); },
          onDelete: (k) => withUndo(`已刪除國際夥伴「${partners[k].name || k + 1}」`, (dd) => { dd.airport.partners.splice(k, 1); }, [`air-del-${Math.max(0, k - 1)}`, 'air-add'])
        }));
    });
    const addPartner = (flagEmoji) => {
      partners.push({ flag: flagEmoji || '🏳️', name: '', carry: '' });
      changed();
      rerender(`air-name-${partners.length - 1}`);
    };
    const partnerCard = cardEl(`國際夥伴（${partners.length}）`,
      h('p', { class: 'card-desc' }, '搭飛機來的夥伴與他們帶來的東西，前台會輪流顯示。'),
      partners.length ? h('ol', { class: 'partner-list' }, rows) : emptyState('🌏', '還沒有國際夥伴。'),
      h('div', { class: 'carry-add' },
        h('button', { type: 'button', class: 'btn btn-soft', 'data-fk': 'air-add', onclick: () => addPartner() }, '＋ 新增夥伴'),
        h('span', { class: 'hint' }, '或點國旗快速加入：')),
      emojiPicks(FLAG_EMOJIS, (f) => addPartner(f), '用國旗快速新增夥伴'));

    return [
      sectionHead('國際航線', '飛機會載著國際夥伴降落在指定的島，把世界帶進校園。'),
      settings,
      partnerCard
    ];
  };

  /* =====================================================================
   * 區塊：價值面向
   * ===================================================================== */
  RENDER.values = function renderValues() {
    const d = S.data;
    const add = h('button', { type: 'button', class: 'btn btn-primary', 'data-fk': 'val-add', onclick: () => openValueEditor(-1) }, '＋ 新增價值面向');
    const rows = d.values.map((v, i) => {
      const used = d.islands.filter((isl) => isl.values.includes(v.id)).length;
      return h('li', { class: 'value-row', style: { '--c': safeColor(v.color) } },
        h('span', { class: 'value-id', 'aria-hidden': 'true' }, v.id || '?'),
        h('div', { class: 'value-main' },
          h('div', { class: 'value-name' }, h('strong', null, v.name || '（未命名）'), v.en ? h('span', { class: 'value-en' }, v.en) : null, h('span', { class: 'sr-only' }, `代號 ${v.id}`)),
          v.desc ? h('p', { class: 'sub' }, v.desc) : null,
          h('span', { class: 'sub' }, used ? `${used} 座島使用` : '還沒有島使用')),
        rowActions({
          i, n: d.values.length, prefix: 'val', name: v.name,
          onMove: (a, b, dir) => { moveInArray(S.data.values, a, b); changed(); rerender(...mvKeys('val', b, dir)); },
          onEdit: openValueEditor, onDelete: deleteValue
        }));
    });
    return [
      sectionHead('價值面向', '每座島可以標示一到多個價值面向，前台會用顏色標籤呈現。', add),
      cardEl(null, rows.length ? h('ul', { class: 'value-list' }, rows) : emptyState('💎', '還沒有價值面向。'))
    ];
  };
  async function deleteValue(i) {
    const v = S.data.values[i];
    const used = S.data.islands.filter((isl) => isl.values.includes(v.id)).length;
    const ok = await ask({
      title: `刪除價值面向「${v.name || v.id}」？`,
      message: used ? `有 ${used} 座島使用這個價值面向，刪除後會一併從這些島移除。` : '目前沒有島使用這個價值面向。',
      okText: '刪除', danger: true
    });
    if (!ok) return;
    withUndo(`已刪除價值面向「${v.name || v.id}」`, (d) => {
      d.values.splice(i, 1);
      if (!d.values.some((x) => x.id === v.id)) d.islands.forEach((isl) => { isl.values = isl.values.filter((x) => x !== v.id); });
    }, ['val-add']);
  }
  function openValueEditor(index) {
    const isNew = index < 0;
    if (!isNew && !S.data.values[index]) return;
    const used = new Set(S.data.values.map((v) => v.id));
    const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !used.has(c)) || `V${S.data.values.length + 1}`;
    const v = isNew ? { id: letter, name: '', en: '', color: '#2BB59A', desc: '' } : clone(S.data.values[index]);
    const oldId = isNew ? null : v.id;
    let layer = null;
    const mark = () => { if (layer) layer.dirty = true; };
    const idIn = textInput(v, 'id', { onInput: mark, attrs: { class: 'mono', maxlength: 4, spellcheck: 'false', autocapitalize: 'characters' } });
    const nameIn = textInput(v, 'name', { onInput: mark, attrs: { maxlength: 20 } });
    const body = h('div', { class: 'form-grid' },
      field('代號', idIn, '建議用一個英文字母，例如 M。改代號會同步更新所有島。'),
      field('名稱', nameIn, null, { required: true }),
      field('英文', textInput(v, 'en', { onInput: mark, placeholder: '例如 Meaningful' })),
      field('顏色', colorInput(v, 'color', mark)),
      field('說明', textInput(v, 'desc', { onInput: mark, multiline: true, rows: 2 }), null, { wide: true }));
    const save = () => {
      const D = S.data;
      v.id = str(v.id).trim();
      if (!v.id) { toast('請填寫代號', 'error'); idIn.focus(); return; }
      if (D.values.some((x, j) => j !== index && x.id === v.id)) { toast(`代號「${v.id}」已經被使用`, 'error'); idIn.focus(); return; }
      if (!str(v.name).trim()) { toast('請填寫名稱', 'error'); nameIn.focus(); return; }
      v.name = v.name.trim();
      if (isNew) D.values.push(v); else D.values[index] = v;
      if (oldId && oldId !== v.id) D.islands.forEach((isl) => { isl.values = isl.values.map((x) => (x === oldId ? v.id : x)); });
      layer.close();
      changed();
      rerender(isNew ? `val-edit-${D.values.length - 1}` : `val-edit-${index}`);
      toast(isNew ? `已新增價值面向「${v.name}」` : `已儲存「${v.name}」`);
    };
    layer = openLayer({
      kind: 'drawer', title: isNew ? '新增價值面向' : `編輯價值面向：${v.name || v.id}`, body,
      footer: footerButtons(() => layer.requestClose(), save, isNew ? '新增' : '儲存'),
      onRequestClose: confirmDiscard, initialFocus: () => (isNew ? nameIn : null)
    });
  }

  /* =====================================================================
   * 區塊：四季設定
   * ===================================================================== */
  RENDER.seasons = function renderSeasons() {
    const d = S.data;
    const ss = d.seasons;
    const month = new Date().getMonth() + 1;
    const today = todaySeason(d);
    const modeSel = selectInput(ss, 'mode', SEASON_MODES, () => { changed(); rerender('season-mode'); }, { attrs: { 'data-fk': 'season-mode' } });
    const fixed = ss.mode !== 'auto' ? ss.list.find((s) => s.id === ss.mode) : null;
    const mi = monthIssues(d);
    const monthOk = !mi.missing.length && !mi.dup.length;

    const top = cardEl('季節模式',
      h('div', { class: 'form-grid' },
        field('前台要顯示哪一季', modeSel, '「自動依月份」會依今天的月份換季；選固定季節則一整年都顯示那一季。'),
        h('div', { class: 'today-box' },
          h('span', { class: 'today-emoji', 'aria-hidden': 'true' }, today ? today.emoji : '❔'),
          h('div', null,
            h('strong', null, today ? `今天是 ${month} 月，自動模式會顯示「${today.title || today.name}」` : `今天是 ${month} 月，但沒有季節包含這個月份`),
            h('p', { class: 'sub' }, fixed ? `目前固定顯示：${fixed.emoji} ${fixed.title || fixed.name}（前台不會隨月份切換）` : '目前為自動模式。')))),
      h('div', { class: 'month-check ' + (monthOk ? 'is-ok' : 'is-error'), role: 'status' },
        monthOk
          ? '✓ 1–12 月都剛好分配給一個季節。'
          : [
            h('strong', null, '月份分配有問題：'),
            mi.missing.length ? h('span', null, ` ${mi.missing.join('、')} 月沒有季節。`) : null,
            mi.dup.map((x) => h('span', null, ` ${x.m} 月同時屬於 ${x.seasons.map((s) => s.name || s.id).join('、')}。`))
          ]));

    const cards = fixedSeasons(d).map((s) => seasonCard(s, today, ss));
    return [
      sectionHead('四季設定', '春、夏、秋、冬四季固定存在，可以調整每一季的月份、文字、顏色與焦點島嶼。'),
      top,
      h('div', { class: 'season-grid' }, cards)
    ];
  };
  function seasonCard(s, today, ss) {
    const titleEl = h('h2', { class: 'season-title' }, s.title || s.name || s.id);
    const emojiEl = h('span', { class: 'season-emoji', 'aria-hidden': 'true' }, s.emoji || '');
    const onTxt = () => { titleEl.textContent = s.title || s.name || s.id; emojiEl.textContent = s.emoji || ''; changed(); };
    const others = fixedSeasons(S.data).filter((x) => x !== s);
    const chips = h('div', { class: 'month-chips' }, range(1, 12).map((m) => {
      const on = s.months.includes(m);
      const other = others.find((x) => x.months.includes(m));
      return h('button', {
        type: 'button', class: 'month-chip' + (on ? ' on' : '') + (on && other ? ' dup' : '') + (!on && other ? ' taken' : ''),
        'aria-pressed': on ? 'true' : 'false', 'data-fk': `m-${s.id}-${m}`,
        title: other ? `${other.name || other.id}也有 ${m} 月` : `${m} 月`,
        'aria-label': `${m} 月${other && !on ? `（目前屬於${other.name || other.id}）` : ''}`,
        onclick: () => toggleMonth(s, m)
      }, `${m}月`);
    }));
    const el = h('section', { class: 'card season-card', id: `season-${s.id}` });
    el.style.setProperty('--c', safeColor(s.accent));
    addKids(el, [
      h('header', { class: 'season-head' },
        emojiEl,
        h('div', { class: 'season-head-text' }, titleEl, h('p', { class: 'sub' }, s.months.length ? `${s.months.join('、')} 月` : '尚未指定月份')),
        h('div', { class: 'season-badges' },
          today && today.id === s.id ? h('span', { class: 'pill pill-ok' }, '今天') : null,
          ss.mode === s.id ? h('span', { class: 'pill pill-accent' }, '固定顯示中') : null)),
      h('div', { class: 'form-grid' },
        field('標題', textInput(s, 'title', { onInput: onTxt }), '例如「春・萌芽」'),
        field('簡稱', textInput(s, 'name', { onInput: onTxt, attrs: { maxlength: 4 } }), '一個字，例如「春」'),
        field('圖示', textInput(s, 'emoji', { onInput: onTxt, attrs: { class: 'emoji-input', maxlength: 16 } })),
        field('飄落粒子', selectInput(s, 'particle', PARTICLES, changed)),
        field('主題色', colorInput(s, 'accent', () => { el.style.setProperty('--c', safeColor(s.accent)); changed(); })),
        field('一句話', textInput(s, 'tagline', { onInput: changed }), null, { wide: true }),
        fieldGroup('月份', chips, '點月份加入這一季；已屬於其他季的月份會自動移過來。', { wide: true }),
        fieldGroup('這一季的焦點島嶼', checkGroup({ get: () => s.focus, set: (v) => { s.focus = v; }, onChange: changed, options: islandOptions() }), '前台在這一季會特別標示這些島。', { wide: true }))
    ]);
    return el;
  }
  function toggleMonth(s, m) {
    if (s.months.includes(m)) {
      s.months = s.months.filter((x) => x !== m);
    } else {
      const from = fixedSeasons(S.data).filter((x) => x !== s && x.months.includes(m));
      from.forEach((x) => { x.months = x.months.filter((y) => y !== m); });
      s.months = sortMonths(s.months.concat([m]));
      if (from.length) toast(`${m} 月已從「${from.map((x) => x.name || x.id).join('、')}」移到「${s.name || s.id}」`, 'info');
    }
    changed();
    rerender(`m-${s.id}-${m}`);
  }

  /* =====================================================================
   * 區塊：選項清單
   * ===================================================================== */
  RENDER.options = function renderOptions() {
    return [
      sectionHead('選項清單', '協作連結的「連結依據」與理念項目的「時程」下拉選項。'),
      h('div', { class: 'two-col' },
        optionCard({
          key: 'linkBasis', title: '連結依據', prefix: 'lb', unit: '條連結',
          desc: '協作連結表單裡的「連結依據」選項。改名會同步更新使用它的連結。',
          usage: (name) => S.data.links.filter((l) => l.basis === name).length,
          rename: (a, b) => { let n = 0; S.data.links.forEach((l) => { if (l.basis === a) { l.basis = b; n++; } }); return n; }
        }),
        optionCard({
          key: 'phases', title: '時程', prefix: 'ph', unit: '個項目',
          desc: '理念項目「時程」的建議選項（項目也可以自由輸入其他文字）。改名會同步更新使用它的項目。',
          usage: (name) => sum(S.data.islands, (isl) => isl.items.filter((it) => it.phase === name).length),
          rename: (a, b) => { let n = 0; S.data.islands.forEach((isl) => isl.items.forEach((it) => { if (it.phase === a) { it.phase = b; n++; } })); return n; }
        }))
    ];
  };
  function optionCard(o) {
    const list = S.data[o.key];
    const rows = list.map((name, k) => {
      let current = name;
      const uses = o.usage(name);
      const useEl = h('span', { class: 'sub opt-use' }, uses ? `${uses} ${o.unit}` : '未使用');
      const input = h('input', { type: 'text', value: name, maxlength: 30, 'aria-label': `${o.title}選項 ${k + 1}`, 'data-fk': `${o.prefix}-in-${k}` });
      input.addEventListener('change', () => {
        const next = input.value.trim();
        if (next === current) { input.value = current; return; }
        if (!next) { toast('選項不能是空白', 'error'); input.value = current; return; }
        if (S.data[o.key].some((x, j) => j !== k && x === next)) { toast(`「${next}」已經在清單中`, 'error'); input.value = current; return; }
        S.data[o.key][k] = next;
        const n = o.rename(current, next);
        current = next;
        input.value = next;
        changed();
        toast(n ? `已改名，並同步更新 ${n} ${o.unit}` : '已改名');
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); input.focus(); } });
      return h('li', { class: 'opt-row' }, input, useEl, rowActions({
        i: k, n: list.length, prefix: o.prefix, name,
        onMove: (a, b, dir) => { moveInArray(S.data[o.key], a, b); changed(); rerender(...mvKeys(o.prefix, b, dir)); },
        onDelete: (i) => deleteOption(o, i)
      }));
    });
    const addIn = h('input', { type: 'text', maxlength: 30, placeholder: `新增${o.title}…`, 'aria-label': `新增${o.title}`, 'data-fk': `${o.prefix}-add` });
    const add = () => {
      const v = addIn.value.trim();
      if (!v) { addIn.focus(); return; }
      if (S.data[o.key].includes(v)) { toast(`「${v}」已經在清單中`, 'error'); return; }
      S.data[o.key].push(v);
      changed();
      rerender(`${o.prefix}-add`);
      toast(`已新增「${v}」`);
    };
    addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    return cardEl(o.title,
      h('p', { class: 'card-desc' }, o.desc),
      list.length ? h('ul', { class: 'opt-list' }, rows) : h('p', { class: 'empty' }, '清單是空的。'),
      h('div', { class: 'opt-add' }, addIn, h('button', { type: 'button', class: 'btn btn-soft', onclick: add }, '新增')));
  }
  async function deleteOption(o, k) {
    const name = S.data[o.key][k];
    const uses = o.usage(name);
    if (uses) {
      const ok = await ask({ title: `刪除「${name}」？`, message: `有 ${uses} ${o.unit}正在使用它。刪除後它們仍會保留「${name}」這段文字，但不再出現在選單中。`, okText: '刪除', danger: true });
      if (!ok) return;
    }
    withUndo(`已刪除「${name}」`, (d) => { d[o.key].splice(k, 1); }, [`${o.prefix}-del-${Math.max(0, k - 1)}`, `${o.prefix}-add`]);
  }

  /* =====================================================================
   * 區塊：資料
   * ===================================================================== */
  RENDER.data = function renderData() {
    const d = S.data;
    const draft = readDraft();
    const exportCard = cardEl('匯出 JSON',
      h('p', { class: 'card-desc' }, '把目前的工作內容（含未發布的修改）下載成 JSON 檔，可以當作備份。'),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { const n = downloadJSON(S.data); toast(`已下載 ${n}`); } }, `下載 site-${todayStamp()}.json`));
    const importCard = cardEl('匯入 JSON',
      h('p', { class: 'card-desc' }, '用 JSON 檔取代目前的工作內容。檔案必須包含 site 與 islands。匯入後要按「發布」才會生效。'),
      filePickButton('選擇 JSON 檔…', '.json,application/json', importJSON, 'btn btn-soft'));
    const restoreCard = cardEl('還原成已發布版本',
      h('p', { class: 'card-desc' }, '重新讀取已發布的資料，捨棄所有未發布的修改與草稿。'),
      h('dl', { class: 'info-list compact' },
        h('div', { class: 'info-row' }, h('dt', null, '已發布版本'), h('dd', null, fmtTime(JSON.parse(S.publishedStr).updatedAt))),
        h('div', { class: 'info-row' }, h('dt', null, '本機草稿'), h('dd', null, draft && isDirty() ? `${fmtTime(draft.savedAt)} 自動儲存` : '沒有未發布的草稿'))),
      h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: restorePublished }, isDirty() ? '捨棄修改並還原' : '重新載入已發布版本'));
    const cards = [exportCard, importCard, restoreCard];

    if (S.mode === 'local') {
      cards.push(cardEl('本機備份', h('p', { class: 'card-desc' }, '每次在本機模式發布前，伺服器都會把舊的 site.json 複製到 data/backups/（保留最近 30 份）。需要時可以從那裡手動還原。')));
    }
    if (S.mode === 'offline') {
      cards.push(cardEl('離線編輯說明', h('p', { class: 'card-desc' }, '離線模式不會寫入任何地方。完成後按右上角「匯出 JSON」，再把檔案上傳成網站的 data/site.json。')));
    }
    if (S.mode === 'github') {
      const box = h('div', { class: 'commits' }, h('p', { class: 'muted' }, '讀取中…'));
      const refresh = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => loadCommits(box) }, '重新整理');
      loadCommits(box);
      cards.push(h('section', { class: 'card card-wide' },
        h('div', { class: 'card-title-row' }, h('h2', { class: 'card-title' }, '最近 10 次更新紀錄'), refresh),
        h('p', { class: 'card-desc' }, `${S.gh.owner}/${S.gh.repo} 中 ${S.gh.path} 的 commit 紀錄（分支 ${S.gh.branch}）。`),
        box));
    }
    return [
      sectionHead('資料', `匯出、匯入與還原。目前共 ${d.islands.length} 座島、${sum(d.islands, (i) => i.items.length)} 個項目。`),
      h('div', { class: 'card-grid' }, cards)
    ];
  };
  async function loadCommits(box) {
    box.replaceChildren(h('p', { class: 'muted' }, '讀取中…'));
    try {
      const list = await gh('GET', `${repoPath()}/commits?path=${encodeURIComponent(S.gh.path)}&sha=${encodeURIComponent(S.gh.branch)}&per_page=10`);
      if (!document.contains(box)) return;
      if (!Array.isArray(list) || !list.length) { box.replaceChildren(h('p', { class: 'muted' }, '還沒有任何紀錄。')); return; }
      box.replaceChildren(h('ol', { class: 'commit-list' }, list.map((c) => {
        const cm = c.commit || {};
        const date = (cm.author && cm.author.date) || (cm.committer && cm.committer.date) || '';
        const who = (c.author && c.author.login) || (cm.author && cm.author.name) || '';
        return h('li', { class: 'commit' },
          h('time', { datetime: date, class: 'commit-time' }, fmtTime(date)),
          h('span', { class: 'commit-msg' }, str(cm.message).split('\n')[0]),
          who ? h('span', { class: 'sub' }, who) : null,
          isHttp(c.html_url) ? h('a', { href: c.html_url, target: '_blank', rel: 'noopener noreferrer', class: 'commit-link' }, '查看 ↗') : null);
      })));
    } catch (e) {
      if (document.contains(box)) box.replaceChildren(h('p', { class: 'error-text' }, '無法讀取紀錄：' + ghErrorText(e)));
    }
  }

  /* =====================================================================
   * 開始
   * ===================================================================== */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
