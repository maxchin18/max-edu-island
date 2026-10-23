import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Batch, clamp, easeInOut, lerp } from './util.js';
import { MAT, themeMats } from './kit.js';
import { lightAt, TIME_PRESETS, SEASON_LOOK, phaseOf } from './palette.js';
import { buildIslands, ISLAND_R, TOP } from './terrain.js';
import { buildCoast } from './coast.js';
import { buildShoreTexture, createWater } from './water.js';
import { Walkers, Birds, Clouds, SeasonFx, Traffic, makeBeam } from './life.js';

export const QUALITY = {
  high: { dpr: 2, shadow: 4096, bloom: true, msaa: 4 },
  standard: { dpr: 1.5, shadow: 2048, bloom: true, msaa: 2 },
  low: { dpr: 1, shadow: 0, bloom: false, msaa: 0 }
};

const DEFAULT_TARGET = new THREE.Vector3(0, 0, -7);
const DEFAULT_OFFSET = new THREE.Vector3(0, 58, 84);

export class World {
  constructor(container, data, { quality = 'high' } = {}) {
    this.container = container;
    this.data = data;
    this.handlers = {};
    this.quality = quality;
    this.paused = false;
    this.timeMode = data.site?.timeMode || 'auto';
    this.timeSpeed = Number(data.site?.timeSpeed) || 2;
    const now = new Date();
    this.clockHour = now.getHours() + now.getMinutes() / 60;
    this.lightHour = this.timeMode === 'auto' ? this.clockHour : TIME_PRESETS[this.timeMode] ?? 12;
    this.season = 'spring';
    this.selected = null;
    this.tween = null;
    this.frameTimes = [];
    this.elapsed = 0;

    this.initRenderer();
    this.initScene();
    this.buildWorld();
    this.initControls();
    this.initPicking();
    this.applyQuality(quality);
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); }
  emit(evt, payload) { (this.handlers[evt] || []).forEach((fn) => fn(payload)); }

  // ---------------- 基礎 ----------------
  initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(r.domElement);
    r.domElement.classList.add('world-canvas');
    this.renderer = r;
  }

  initScene() {
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 2600);
    this.camera.position.copy(DEFAULT_TARGET).add(DEFAULT_OFFSET).multiplyScalar(1.55);
    this.camera.lookAt(DEFAULT_TARGET);
    scene.fog = new THREE.Fog('#E4F6FB', 220, 900);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.4;

    this.hemi = new THREE.HemisphereLight('#EEF8FF', '#96B28E', 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -135; sc.right = 135; sc.top = 135; sc.bottom = -135; sc.near = 20; sc.far = 520;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight('#BFD9FF', 0.35);
    this.fill.position.set(-80, 60, -120);
    scene.add(this.fill);

    // 天空：漸層球 + 太陽／月亮光暈
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uNight: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uNight; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 col = mix(uBot, uTop, pow(smoothstep(-0.02, 0.6, h), 0.8));
        float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += uSun * (pow(sd, 900.0) * 2.2 + pow(sd, 18.0) * 0.16) * mix(1.0, 0.55, uNight);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // 星星
    const N = 1400;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.08 + Math.random() * 0.92;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 1700, y * 1700, Math.sin(a) * r * 1700], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);
  }

  buildWorld() {
    const root = new THREE.Group();
    root.name = 'world';
    this.root = root;
    this.scene.add(root);

    const mk = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...extra });
    const S = {
      grass: mk('#A8DB82'), grass2: mk('#B5E08E'), meadow: mk('#B5E08E'),
      leafA: mk('#F7B3C8', { roughness: 0.85 }), leafB: mk('#FFD3E0', { roughness: 0.85 }), leafC: mk('#9BD877', { roughness: 0.85 }), conifer: mk('#6DB57A', { roughness: 0.85 }),
      sand: mk('#F4E5C6', { roughness: 0.95 }), far: mk('#A6D59A', { roughness: 1 }), mountain: mk('#8CC79A', { roughness: 1, flatShading: true }),
      flowers: ['#FF9EBB', '#FFE38A', '#FFFFFF', '#C9A8FF'].map((c) => mk(c, { roughness: 0.7 }))
    };
    this.S = S;
    const ctx = {
      root, batch: new Batch(), S,
      seasonal: { spring: new Batch(), summer: new Batch(), autumn: new Batch(), winter: new Batch() },
      beacons: [], turbines: [], aerators: [], roads: [], birdSpots: [], lights: []
    };
    this.ctx = ctx;

    const T = performance.now();
    const mark = (k) => console.info(`[教育理念島] ${k} ${Math.round(performance.now() - T)} ms`);
    const { info, hit } = buildIslands(this.data, ctx);
    mark('islands');
    this.islandInfo = info;
    this.islandHit = hit;
    const { shapes } = buildCoast(ctx);
    mark('coast');

    ctx.batch.build(root);
    this.seasonGroups = {};
    for (const [id, b] of Object.entries(ctx.seasonal)) {
      const g = new THREE.Group();
      g.name = 'season-' + id;
      b.build(g);
      root.add(g);
      this.seasonGroups[id] = g;
    }
    mark('merge');
    this.deciduous = ctx.batch.meshes.filter((m) => m.material === S.leafA || m.material === S.leafB);

    // 海
    for (const it of info.values()) shapes.push({ type: 'poly', pts: hexPts(it.x, it.z, ISLAND_R) });
    this.shoreTex = buildShoreTexture(shapes);
    this.water = createWater(this.shoreTex);
    mark('water');
    this.scene.add(this.water);

    // 生命
    this.walkers = new Walkers(this);
    this.walkers.build(this.data, info);
    this.birds = new Birds(this);
    this.birds.build(ctx.birdSpots);
    this.clouds = new Clouds(this);
    this.clouds.build();
    this.fx = new SeasonFx(this);
    this.fx.build();
    const globalId = this.data.airport?.island;
    const accent = themeMats(info.get(globalId)?.color || '#3CC1C7').main;
    this.traffic = new Traffic(this);
    this.traffic.build(ctx, this.data, accent);
    if (ctx.lighthouse) {
      this.beam = makeBeam();
      this.beam.position.copy(ctx.lighthouse);
      this.scene.add(this.beam);
    }

    this.buildLinks();
    this.buildSelection();
    mark('life');
  }

  // ---------------- 協作連結線 ----------------
  buildLinks() {
    this.linkGroup = new THREE.Group();
    this.linkGroup.visible = false;
    this.linkMeshes = [];
    const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
    const frag = `uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uLen; varying vec2 vUv;
      void main(){ float d = fract(vUv.x * uLen / 2.6 - uTime * 0.9); float dash = smoothstep(0.0, 0.15, d) * (1.0 - smoothstep(0.45, 0.6, d));
      float a = (0.32 + dash * 0.68) * uOpacity; gl_FragColor = vec4(uColor * (0.85 + dash * 0.35), a); }`;
    for (const link of this.data.links || []) {
      const A = this.islandInfo.get(link.from);
      if (!A) continue;
      for (const toId of link.to || []) {
        const B = this.islandInfo.get(toId);
        if (!B) continue;
        const a = new THREE.Vector3(A.x, TOP + 4.6, A.z), b = new THREE.Vector3(B.x, TOP + 4.6, B.z);
        const dist = a.distanceTo(b);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y += 4 + dist * 0.22;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geo = new THREE.TubeGeometry(curve, 64, 0.16, 8, false);
        const m = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, vertexShader: vert, fragmentShader: frag,
          uniforms: { uColor: { value: new THREE.Color(A.color) }, uTime: { value: 0 }, uOpacity: { value: 0.9 }, uLen: { value: curve.getLength() } }
        });
        const mesh = new THREE.Mesh(geo, m);
        mesh.userData = { link, from: link.from, to: toId };
        this.linkGroup.add(mesh);
        this.linkMeshes.push(mesh);
      }
    }
    this.root.add(this.linkGroup);
  }

  setLinksVisible(on) { this.linkGroup.visible = on; }

  highlightLinks({ islandId = null, linkId = null } = {}) {
    for (const m of this.linkMeshes) {
      const { link, from, to } = m.userData;
      let on = true;
      if (linkId) on = link.id === linkId;
      else if (islandId) on = from === islandId || to === islandId;
      m.material.uniforms.uOpacity.value = on ? 0.95 : 0.08;
    }
  }

  // ---------------- 選取外框 ----------------
  buildSelection() {
    const g = new THREE.RingGeometry(ISLAND_R + 0.35, ISLAND_R + 0.95, 6, 1, Math.PI / 6);
    g.rotateX(-Math.PI / 2);
    this.selRing = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    this.selRing.position.y = 0.18;
    this.selRing.visible = false;
    this.scene.add(this.selRing);
    this.focusMarks = new THREE.Group();
    this.scene.add(this.focusMarks);
  }

  select(islandId) {
    this.selected = islandId;
    const it = islandId && this.islandInfo.get(islandId);
    this.selRing.visible = !!it;
    if (it) {
      this.selRing.position.x = it.x;
      this.selRing.position.z = it.z;
      this.selRing.material.color.set(it.color);
    }
    this.highlightLinks({ islandId });
  }

  // ---------------- 相機 ----------------
  initControls() {
    const c = new OrbitControls(this.camera, this.renderer.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 18;
    c.maxDistance = 330;
    c.minPolarAngle = 0.12;
    c.maxPolarAngle = 1.28;
    c.screenSpacePanning = false;
    c.rotateSpeed = 0.6;
    c.zoomSpeed = 0.9;
    c.target.copy(DEFAULT_TARGET);
    c.addEventListener('start', () => { this.tween = null; this.emit('userCamera'); });
    this.controls = c;
    this.flyHome(2.6);
  }

  homeOffset() {
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    const k = clamp(1.6 / Math.pow(aspect, 0.9), 1.3, 3.8);
    return DEFAULT_OFFSET.clone().multiplyScalar(k);
  }

  flyTo(target, offset, duration = 1.2) {
    this.tween = {
      t: 0, duration,
      fromT: this.controls.target.clone(), toT: target.clone(),
      fromP: this.camera.position.clone(), toP: target.clone().add(offset)
    };
  }

  homeTarget() {
    // 手機版下方有清單抽屜，把島群往畫面上方推
    return this.container.clientWidth < 820 ? DEFAULT_TARGET.clone().add(new THREE.Vector3(0, 0, 26)) : DEFAULT_TARGET.clone();
  }

  flyHome(duration = 1.3) { this.birdEye = false; this.flyTo(this.homeTarget(), this.homeOffset(), duration); }

  setBirdEye(on) {
    this.birdEye = on;
    if (on) this.flyTo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 190 * (this.homeOffset().length() / DEFAULT_OFFSET.length()), 0.01), 1.4);
    else this.flyHome();
  }

  focusIsland(id) {
    const it = this.islandInfo.get(id);
    if (!it) return;
    const dir = this.camera.position.clone().sub(this.controls.target);
    dir.y = 0;
    if (dir.lengthSq() < 1) dir.set(0, 0, 1);
    dir.normalize();
    const narrow = this.container.clientWidth < 700;
    const dist = narrow ? 62 : 48;
    const offset = dir.multiplyScalar(dist * 0.72).add(new THREE.Vector3(0, dist * 0.7, 0));
    const target = new THREE.Vector3(it.x, TOP, it.z);
    // 桌面版：左側詳情卡會蓋住畫面，把島往右推一點
    if (!narrow && this.container.clientWidth > 900) {
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), offset).normalize();
      target.addScaledVector(right, -30 * clamp(360 / this.container.clientWidth, 0.25, 0.5));
    }
    this.flyTo(target, offset, 1.3);
  }

  // ---------------- 點選 ----------------
  initPicking() {
    const el = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const w = ray.intersectObjects(this.walkers.hits, false)[0];
      if (w && w.object.parent.visible) return { walker: w.object.userData.walker };
      const i = ray.intersectObjects(this.islandHit.children, false)[0];
      if (i) return { island: i.object.userData.islandId };
      return {};
    };
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 7 || !quick) return;
      const hit = pick(e);
      if (hit.walker) this.emit('pickWalker', { walker: hit.walker, x: e.clientX, y: e.clientY });
      else if (hit.island) this.emit('pickIsland', hit.island);
      else this.emit('pickNone');
    });
    let last = 0;
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || down) return;
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      const hit = pick(e);
      el.style.cursor = hit.walker || hit.island ? 'pointer' : 'grab';
      this.emit('hover', hit.island || null);
    });
  }

  project(v) {
    const p = v.clone().project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && p.z > -1 };
  }

  setLabelElements(map) { this.labelEls = map; }

  // ---------------- 季節、時間、畫質 ----------------
  setSeason(id) {
    this.season = SEASON_LOOK[id] ? id : 'spring';
    const L = SEASON_LOOK[this.season];
    const S = this.S;
    for (const k of ['grass', 'grass2', 'meadow', 'leafA', 'leafB', 'leafC', 'conifer', 'sand', 'far', 'mountain']) S[k].color.set(L[k]);
    S.flowers.forEach((m, i) => m.color.set(L.flowers[i % L.flowers.length]));
    for (const [sid, g] of Object.entries(this.seasonGroups)) g.visible = sid === this.season;
    this.deciduous.forEach((m) => (m.visible = !L.bareTrees));
    this.waterLook = { deep: new THREE.Color(L.deep), shallow: new THREE.Color(L.shallow), foam: new THREE.Color(L.foam) };
    this.skyTint = new THREE.Color(L.skyTint);
    const seasonDef = (this.data.seasons?.list || []).find((s) => s.id === this.season);
    this.fx.setMode(seasonDef?.particle || { spring: 'petal', summer: 'firefly', autumn: 'leaf', winter: 'snow' }[this.season], this.season);
    this.birds.setSeason(this.season);
  }

  setTimeMode(mode) {
    this.timeMode = mode;
    if (mode === 'auto') this.lightTarget = null;
    else this.lightTarget = TIME_PRESETS[mode];
  }

  setPaused(p) { this.paused = p; }

  applyQuality(q) {
    this.quality = QUALITY[q] ? q : 'high';
    const Q = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
    this.renderer.shadowMap.enabled = Q.shadow > 0;
    this.sun.castShadow = Q.shadow > 0;
    if (Q.shadow > 0) {
      this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.scene.traverse((o) => { if (o.material && o.isMesh) o.material.needsUpdate = true; });
    if (this.composer) { this.composer.dispose(); this.composer = null; }
    if (Q.bloom) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Q.msaa });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.6, 0.95);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resize();
    this.emit('quality', this.quality);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  }

  applyLight(hour) {
    const L = lightAt(hour);
    const night = L.night;
    this.night = night;
    const skyBot = L.skyBot.clone().lerp(this.skyTint || L.skyBot, 0.22 * (1 - night));
    this.skyMat.uniforms.uTop.value.copy(L.skyTop);
    this.skyMat.uniforms.uBot.value.copy(skyBot);
    this.skyMat.uniforms.uSun.value.copy(L.sun);
    this.skyMat.uniforms.uSunDir.value.copy(L.sunDir);
    this.skyMat.uniforms.uNight.value = night;
    this.scene.fog.color.copy(skyBot);
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGnd);
    this.hemi.intensity = L.hemiI;
    this.sun.color.copy(L.sun);
    this.sun.intensity = L.sunI;
    this.sun.position.copy(this.controls ? this.controls.target : DEFAULT_TARGET).addScaledVector(L.sunDir, 260);
    this.sun.target.position.copy(this.controls ? this.controls.target : DEFAULT_TARGET);
    this.fill.intensity = 0.35 * (1 - night) + 0.12;
    this.scene.environmentIntensity = L.env;
    this.renderer.toneMappingExposure = L.exposure;
    this.stars.material.opacity = clamp((night - 0.35) / 0.65, 0, 1) * 0.95;
    MAT.window.emissiveIntensity = night * 2.6;
    MAT.lamp.emissiveIntensity = 0.25 + night * 3.4;
    MAT.lantern.emissiveIntensity = 0.15 + night * 2.6;
    MAT.beacon.emissiveIntensity = 0.6 + night * 3.5;
    if (this.bloom) this.bloom.strength = 0.18 + night * 0.65;
    const wl = this.waterLook;
    if (wl) {
      const u = this.water.material.uniforms;
      const nightBlue = new THREE.Color('#0E2A4A');
      u.uDeep.value.copy(wl.deep).lerp(nightBlue, night * 0.75);
      u.uShallow.value.copy(wl.shallow).lerp(new THREE.Color('#1F5C78'), night * 0.7);
      u.uFoam.value.copy(wl.foam).lerp(new THREE.Color('#9FB6D0'), night * 0.5);
      u.uSky.value.copy(skyBot);
      u.uSunColor.value.copy(L.sun).multiplyScalar(Math.min(1.4, L.sunI / 2.2));
      u.uSunDir.value.copy(L.sunDir);
      u.uNight.value = night;
    }
    this.clouds.setTint(L.cloud, L.skyTop, night);
    if (this.beam) this.beam.userData.mat.uniforms.uOpacity.value = clamp((night - 0.3) / 0.7, 0, 1) * 0.55;
  }

  get phase() { return phaseOf(this.lightHour); }

  // ---------------- 迴圈 ----------------
  loop() {
    requestAnimationFrame(this.loop);
    if (document.hidden) { this.clock.getDelta(); return; }
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    const t = this.elapsed;

    // 時間流動
    if (!this.paused) this.clockHour = (this.clockHour + (dt * this.timeSpeed) / 60) % 24;
    if (this.timeMode === 'auto') {
      let d = this.clockHour - this.lightHour;
      if (d > 12) d -= 24; if (d < -12) d += 24;
      this.lightHour = (this.lightHour + d * Math.min(1, dt * 2) + 24) % 24;
    } else if (this.lightTarget != null) {
      let d = this.lightTarget - this.lightHour;
      if (d > 12) d -= 24; if (d < -12) d += 24;
      this.lightHour = (this.lightHour + d * Math.min(1, dt * 2.2) + 24) % 24;
    }
    this.applyLight(this.lightHour);

    // 相機補間
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const k = easeInOut(tw.t);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, k);
      this.camera.position.lerpVectors(tw.fromP, tw.toP, k);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update();
    const tg = this.controls.target;
    tg.x = clamp(tg.x, -160, 160);
    tg.z = clamp(tg.z, -140, 150);
    tg.y = clamp(tg.y, 0, 10);

    // 世界更新
    this.water.material.uniforms.uTime.value = t;
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.clouds.update(dt, this.camera.position);
    this.fx.update(dt, t, this.night);
    if (!this.paused) {
      this.walkers.update(dt, t);
      this.birds.update(dt, t, this.night);
      this.traffic.update(dt, t, this.night);
    }
    if (this.beam) this.beam.rotation.y += dt * 0.6;
    for (const m of this.linkMeshes) m.material.uniforms.uTime.value = t;
    if (this.selRing.visible) {
      const s = 1 + Math.sin(t * 3) * 0.015;
      this.selRing.scale.set(s, 1, s);
      this.selRing.material.opacity = 0.65 + Math.sin(t * 3) * 0.25;
    }

    // 島名標籤跟著畫面
    if (this.labelEls) {
      const v = new THREE.Vector3();
      const w = this.container.clientWidth, h = this.container.clientHeight;
      const dist = this.camera.position.distanceTo(this.controls.target);
      const scale = clamp(150 / dist, 0.62, 1);
      this.labelWrap ||= this.container.querySelector('.labels');
      this.labelWrap?.classList.toggle('compact', dist > this.homeOffset().length() * 1.3);
      for (const [id, el] of this.labelEls) {
        const it = this.islandInfo.get(id);
        if (!it) continue;
        v.set(it.x, it.labelY, it.z).project(this.camera);
        const visible = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
        el.style.opacity = visible ? '' : '0';
        el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      }
    }

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    this.emit('tick', { hour: this.clockHour, lightHour: this.lightHour, dt });
    this.watchPerformance(dt);
  }

  watchPerformance(dt) {
    if (this.perfDone || this.elapsed < 3) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 150) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    const fps = 1 / avg;
    if (fps < 26 && this.quality !== 'low') {
      const next = this.quality === 'high' ? 'standard' : 'low';
      this.applyQuality(next);
      this.emit('autoQuality', next);
      this.perfChecks = (this.perfChecks || 0) + 1;
      if (this.perfChecks >= 2) this.perfDone = true;
    } else this.perfDone = true;
  }
}

function hexPts(x, z, R) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push([x + R * Math.sin(a), z - R * Math.cos(a)]);
  }
  return pts;
}

export { lerp };
