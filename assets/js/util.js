import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- 亂數：同一個 seed 每次都長出同樣的島 ----------
export function hashStr(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(seed);
  const next = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(next.range(lo, hi + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

// ---------- 小工具 ----------
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** 組出變換矩陣：位置、旋轉（弧度，先 z 再 x 最後 y）、縮放 */
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// ---------- 材質快取 ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...opts });
  matCache.set(key, m);
  return m;
}

// ---------- 靜態幾何合併：同材質的物件合成一個 Mesh，大幅減少 draw call ----------
export class Batch {
  constructor() { this.groups = new Map(); this.meshes = []; }

  add(geom, material, matrix, { cast = true, receive = true } = {}) {
    const key = `${material.uuid}|${cast}|${receive}`;
    let g = this.groups.get(key);
    if (!g) { g = { material, cast, receive, list: [] }; this.groups.set(key, g); }
    let geo = geom.index ? geom.toNonIndexed() : geom.clone();
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (matrix) geo.applyMatrix4(matrix);
    g.list.push(geo);
    return this;
  }

  build(parent) {
    for (const g of this.groups.values()) {
      if (!g.list.length) continue;
      const merged = mergeGeometries(g.list, false);
      g.list.forEach((x) => x.dispose());
      g.list = [];
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, g.material);
      mesh.castShadow = g.cast;
      mesh.receiveShadow = g.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      this.meshes.push(mesh);
    }
    return this.meshes;
  }
}

// ---------- Emoji / 文字貼圖 ----------
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif';
const texCache = new Map();

export function emojiTexture(emoji, { bubble = true } = {}) {
  const key = 'e:' + emoji + bubble;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (bubble) {
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(64, 60, 50, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(52, 104); ctx.lineTo(64, 122); ctx.lineTo(76, 104); ctx.fill();
  }
  ctx.font = `${bubble ? 62 : 96}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, bubble ? 64 : 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

export function labelTexture(text, color = '#1F2D2B') {
  const key = 'l:' + text + color;
  if (texCache.has(key)) return { tex: texCache.get(key), aspect: texCache.get(key).userData.aspect };
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = '600 44px "Noto Sans TC","Nunito",sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 56;
  c.width = w; c.height = 76;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, 2, 2, w - 4, 72, 36); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(30, 38, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1F2D2B';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 46, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.aspect = w / 76;
  texCache.set(key, tex);
  return { tex, aspect: w / 76 };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 柔邊圓點貼圖（雪花、螢火蟲、星星用） */
export function softDotTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = 'd:' + inner + outer;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

// ---------- 六角格 ----------
export const HEX_SPACING = 10; // 相鄰島中心距離 = √3 × HEX_SPACING
export function axialToWorld(q, r, size = HEX_SPACING) {
  return { x: size * Math.sqrt(3) * (q + r / 2), z: size * 1.5 * r };
}
export const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** 尖頂六角形（在 xz 平面，尖角朝 ±z）的 Shape；shape 的 y 對應世界的 -z */
export function hexShape(radius) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i; // 0 度 → 尖角在 +y
    const x = radius * Math.sin(a);
    const y = radius * Math.cos(a);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** 有圓角斜邊的六角台座，頂面在 y = top */
export function bevelHex(radius, depth, bevel = 0.3, segments = 3) {
  const g = new THREE.ExtrudeGeometry(hexShape(radius - bevel), {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: 1
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0); // 底面在 y = 0
  return g;
}
