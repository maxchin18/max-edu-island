// 前台自動化測試：在已開啟的網站頁面執行，逐項操作並檢查結果
// 用法（瀏覽器主控台，在網站首頁）：await (await import('./tests/ui-test.js')).run()
// 約 40 秒跑完；分頁在背景時會改成手動推進畫格，一樣能跑。
export async function run() {
  const R = [];
  const ok = (n, c, d = '') => R.push({ n, ok: !!c, d: String(d) });
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const S = window.maxIsland.state;
  const W = S.world;
  const D = S.data;
  // 分頁在背景時瀏覽器會暫停動畫：改成手動推進畫格（每格 50ms），讓測試在哪裡都能跑
  const step = (n) => {
    const raf = window.requestAnimationFrame;
    const gd = W.clock.getDelta;
    window.requestAnimationFrame = () => 0;
    W.clock.getDelta = () => 0.05;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    try { for (let i = 0; i < n; i++) W.loop(); } finally {
      window.requestAnimationFrame = raf;
      W.clock.getDelta = gd;
      delete document.hidden;
    }
  };
  const yieldTask = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const e0 = W.elapsed;
  await new Promise((r) => setTimeout(r, 400));
  const manual = W.elapsed === e0; // 畫面沒有在更新（分頁不在前景）
  const wait = async (ms) => {
    if (manual) { step(Math.ceil(ms / 50)); await yieldTask(); await yieldTask(); }
    else await new Promise((r) => setTimeout(r, ms));
  };
  const click = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) throw new Error('找不到 ' + sel);
    el.click();
  };
  const type = async (v) => {
    const inp = $('#search');
    inp.value = v;
    inp.dispatchEvent(new Event('input'));
    // 搜尋有 120ms 防抖；背景分頁的計時器會被延到約 1 秒
    await new Promise((r) => setTimeout(r, manual ? 1300 : 300));
  };

  try {
    // 首次造訪會自動跳出導覽，先關掉
    await new Promise((r) => setTimeout(r, 1800));
    if (!$('#tour').hidden) click('#tourSkip');
    ok('島名標籤數量', $$('.isl-label').length === D.islands.length, $$('.isl-label').length);
    ok('清單列數', $$('#listBody .row[data-island]').length === D.islands.length);
    ok('小人數量', W.walkers.list.length === D.personTypes.reduce((a, t) => a + (+t.count || 0), 0), W.walkers.list.length);

    // ---------- 季節 ----------
    for (const s of ['spring', 'summer', 'autumn', 'winter']) {
      click(`[data-season="${s}"]`);
      ok(`季節：${s}`, S.seasonMode === s && W.season === s && $(`[data-season="${s}"]`).classList.contains('on'));
    }
    ok('冬：落葉樹光禿、冬季小物', W.deciduous.every((m) => !m.visible) && W.seasonGroups.winter.visible && !W.seasonGroups.spring.visible);
    ok('冬：下雪', W.fx.snow.visible && !W.fx.petals.mesh.visible);
    ok('冬：黑面琵鷺', W.birds.standing.length > 0 && W.birds.standing.every((b) => b.mesh.userData.spoon.visible));
    click('[data-season="spring"]');
    ok('春：花瓣、樹葉回來', W.fx.petals.mesh.visible && W.deciduous.every((m) => m.visible) && !W.birds.standing[0].mesh.userData.spoon.visible);
    click('[data-season="summer"]');
    ok('夏：螢火蟲', W.fx.fire.visible);
    click('[data-season="autumn"]');
    ok('秋：落葉', W.fx.leaves.mesh.visible);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase();
    ok('秋：介面主色', accent === D.seasons.list.find((x) => x.id === 'autumn').accent.toLowerCase(), accent);
    click('[data-season="auto"]');
    const month = new Date().getMonth() + 1;
    const expect = D.seasons.list.find((x) => x.months.includes(month)).id;
    ok('自動季節依月份', W.season === expect && localStorage.getItem('maxisland.season') === 'auto', `${month} 月 → ${W.season}`);
    const focus = D.seasons.list.find((x) => x.id === W.season).focus;
    ok('本季焦點標籤', $$('.isl-label.is-focus').length === focus.length, $$('.isl-label.is-focus').length);

    // ---------- 時段 ----------
    for (const t of ['dawn', 'day', 'dusk', 'night']) {
      click(`[data-time="${t}"]`);
      await wait(1800);
      ok(`時段：${t}`, W.phase === t, W.lightHour.toFixed(2));
    }
    ok('夜晚亮燈', W.night > 0.8, W.night.toFixed(2));
    click('[data-time="auto"]');
    const h0 = W.clockHour;
    await wait(1200);
    ok('時間會流動', W.clockHour !== h0, `${h0.toFixed(3)} → ${W.clockHour.toFixed(3)}`);
    ok('時鐘顯示', /^\d\d:\d\d$/.test($('#clock').textContent), $('#clock').textContent);

    // ---------- 工具列 ----------
    click('[data-tool="tags"]');
    ok('名牌開', W.walkers.list.every((w) => w.tag.visible));
    click('[data-tool="tags"]');
    ok('名牌關', W.walkers.list.every((w) => !w.tag.visible));
    click('[data-tool="items"]');
    ok('搬運物關', W.walkers.list.every((w) => !w.item.visible));
    click('[data-tool="items"]');
    ok('搬運物開', W.walkers.list.every((w) => w.item.visible));
    click('[data-tool="links"]');
    ok('連結線開', W.linkGroup.visible && W.linkMeshes.length === D.links.reduce((a, l) => a + l.to.length, 0), W.linkMeshes.length);
    click('[data-tool="links"]');
    ok('連結線關', !W.linkGroup.visible);
    click('[data-tool="pause"]');
    const p0 = W.walkers.list.map((w) => w.group.position.clone());
    const c0 = W.clockHour;
    await wait(700);
    ok('暫停：小人與時鐘停住', W.walkers.list.every((w, i) => w.group.position.equals(p0[i])) && W.clockHour === c0);
    click('[data-tool="pause"]');
    await wait(900);
    ok('繼續：小人會動', W.walkers.list.some((w, i) => !w.group.position.equals(p0[i])));
    click('[data-tool="bird"]');
    await wait(1800);
    ok('鳥瞰', W.camera.position.y > 150, W.camera.position.y.toFixed(0));
    click('[data-tool="bird"]');
    await wait(1600);
    ok('鳥瞰關回全景', $('[data-tool="bird"]').getAttribute('aria-pressed') === 'false' && W.camera.position.y < 190, W.camera.position.y.toFixed(0));

    // ---------- 日誌 ----------
    click('[data-tool="log"]');
    ok('日誌打開', !$('#logView').hidden && $('#indexView').hidden);
    await wait(2500);
    ok('日誌有紀錄', $$('#logList li:not(.empty)').length > 0, $$('#logList li').length);
    click('[data-ltab="overview"]');
    ok('概況：四個數字＋價值長條', $$('#overviewBody .ov-tile').length === 4 && $$('#overviewBody .bar-row').length === D.values.length);
    ok('概況：各島細項', $$('#overviewBody [data-isl]').length === D.islands.length);
    click('[data-ltab="log"]');
    $('#logType').value = 'student';
    $('#logType').dispatchEvent(new Event('change'));
    await wait(3500);
    const rows = $$('#logList li:not(.empty)');
    ok('日誌依人物篩選', rows.every((li) => li.textContent.includes('學生') || li.textContent.includes('班機')), rows.length);
    $('#logType').value = '';
    $('#logType').dispatchEvent(new Event('change'));
    click('#logClose');
    ok('日誌關閉', $('#logView').hidden && !$('#indexView').hidden && $('[data-tool="log"]').getAttribute('aria-pressed') === 'false');

    // ---------- 清單 → 詳情 ----------
    const isl = D.islands[1];
    click($$('#listBody .row[data-island]')[1]);
    ok('展開島嶼清單', $$('#listBody .sub .item').length === isl.items.length);
    click('#listBody [data-go]');
    await wait(80);
    ok('島嶼詳情', !$('#detail').hidden && $('#detail .d-title').textContent === isl.name && location.hash === '#island=' + isl.id);
    ok('選取外框', W.selRing.visible);
    click($$('#detail .item-btn')[1]);
    ok('細項詳情', $('#detail .d-title').textContent === isl.items[1].name && location.hash.includes('item=' + isl.items[1].id));
    click('#backIsland');
    ok('返回島嶼', $('#detail .d-title').textContent === isl.name);
    click($$('#detail .collab')[0]);
    ok('協作連結詳情', location.hash.startsWith('#link=') && W.linkGroup.visible);
    click($$('#detail [data-isl]')[0]);
    ok('從連結回到島', location.hash.startsWith('#island='));
    click('#detailClose');
    ok('關閉詳情', $('#detail').hidden && location.hash === '' && !W.selRing.visible && !W.linkGroup.visible);

    // ---------- 搜尋 ----------
    await type('蛤蜊');
    ok('搜尋命中', $$('#listBody .row[data-island]').length >= 1 && $$('#listBody mark').length > 0, $$('#listBody .row[data-island]').length);
    await type('zzz不存在');
    ok('搜尋沒結果', !!$('#listBody .empty'));
    await type('');
    ok('清除搜尋', $$('#listBody .row[data-island]').length === D.islands.length);

    // ---------- 分頁 ----------
    click('[data-tab="links"]');
    ok('協作連結分頁', $$('#listBody .link-row').length === D.links.length);
    await type('繪本');
    ok('連結分頁搜尋', $$('#listBody .link-row').length >= 1 && $$('#listBody .link-row').length < D.links.length, $$('#listBody .link-row').length);
    await type('');
    click($$('#listBody .link-row')[1]);
    ok('連結詳情', $('#detail .d-kicker').textContent.includes(D.links[1].id));
    click('[data-tab="people"]');
    ok('人物分頁', $$('#listBody .person').length === D.personTypes.length);
    const pt = D.personTypes[3];
    click($$('#listBody .person')[3]);
    ok('聚焦人物', S.focusType === pt.id && W.walkers.list.filter((w) => w.type.id === pt.id).every((w) => w.ring.visible && w.tag.visible));
    ok('其他人物變淡', [...W.walkers.typeMats].filter(([id]) => id !== pt.id).every(([, mm]) => mm.opacity < 0.5));
    click('#unfocus');
    ok('取消聚焦', !S.focusType && [...W.walkers.typeMats.values()].every((mm) => mm.opacity === 1));
    click('[data-tab="islands"]');

    // ---------- 網址 ----------
    location.hash = '#island=ocean&item=ocean-1';
    await wait(250);
    ok('網址→細項', $('#detail .d-title')?.textContent === D.islands.find((i) => i.id === 'ocean').items[0].name);
    location.hash = '#person=fisher';
    await wait(250);
    ok('網址→人物', S.focusType === 'fisher');
    click('#unfocus');
    location.hash = '#link=C5';
    await wait(250);
    ok('網址→連結', $('#detail .d-kicker')?.textContent.includes('C5'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ok('Esc 關閉詳情', $('#detail').hidden);
    location.hash = '#island=nope';
    await wait(250);
    ok('錯誤網址不出錯', $('#detail').hidden);
    history.replaceState(null, '', location.pathname + location.search);

    // ---------- 導覽 ----------
    click('#btnHelp');
    ok('導覽打開', !$('#tour').hidden && $('#tourTitle').textContent === D.site.tutorial[0].title);
    for (let i = 0; i < D.site.tutorial.length; i++) click('#tourNext');
    ok('導覽走完關閉', $('#tour').hidden && localStorage.getItem('maxisland.toured') === '1');
    click('#btnHelp');
    click('#tourSkip');
    ok('導覽略過', $('#tour').hidden);

    // ---------- 畫質、清單 ----------
    const q0 = W.quality;
    click('#btnQuality');
    await wait(300);
    ok('切換畫質', W.quality !== q0 && localStorage.getItem('maxisland.quality') === W.quality, W.quality);
    click('#btnQuality');
    await wait(300);
    click('#btnQuality');
    await wait(300);
    ok('畫質循環回來', W.quality === q0, W.quality);
    localStorage.removeItem('maxisland.quality');
    click('#btnList');
    ok('隱藏清單', $('#app').classList.contains('panel-hidden'));
    click('#btnList');
    ok('顯示清單', !$('#app').classList.contains('panel-hidden'));

    // ---------- 世界 ----------
    const planes = D.airport?.enabled === false ? 0 : (D.airport?.planes ?? 2);
    ok('飛機數量', W.traffic.planes.length === planes, W.traffic.planes.length);
    ok('船、雲、鳥、車、風機', W.traffic.boats.length && W.clouds.list.length && W.birds.flocks.length && W.birds.standing.length && W.traffic.cars.length && W.traffic.spinners.length);
    ok('海面近岸貼圖', !!W.water.material.uniforms.uShore.value);
  } catch (e) {
    ok('測試中斷', false, e.message);
  }
  const fails = R.filter((r) => !r.ok);
  return { total: R.length, passed: R.length - fails.length, fails: fails.map((r) => `${r.n}（${r.d}）`), all: R.map((r) => `${r.ok ? '✅' : '❌'} ${r.n}${r.d ? '（' + r.d + '）' : ''}`) };
}
