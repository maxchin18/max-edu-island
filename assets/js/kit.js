import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, mat } from './util.js';

// ---------- 幾何快取：同尺寸只建一次 ----------
const cache = new Map();
const get = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

export const G = {
  /** 圓角方塊（中心在原點） */
  box(w, h, d, r = 0.06) {
    return get(`box${w},${h},${d},${r}`, () => {
      const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
      return rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
    });
  },
  cyl(rt, rb, h, s = 18, open = false) { return get(`cyl${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open)); },
  cone(r, h, s = 18) { return get(`cone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)); },
  sph(r, ws = 20, hs = 14) { return get(`sph${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)); },
  hemi(r, ws = 24, hs = 10) { return get(`hemi${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2)); },
  ico(r, d = 1) { return get(`ico${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)); },
  torus(R, t, rs = 10, ts = 32, arc = Math.PI * 2) { return get(`tor${R},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, t, rs, ts, arc)); },
  knot(R, t) { return get(`knot${R},${t}`, () => new THREE.TorusKnotGeometry(R, t, 120, 14)); },
  /** 山牆屋頂：寬 w、高 h、長 L（屋脊沿 z 軸，底面在 y = 0） */
  gable(w, h, L, overhang = 0.12) {
    return get(`gable${w},${h},${L},${overhang}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2 - overhang, 0);
      s.lineTo(w / 2 + overhang, 0);
      s.lineTo(0, h);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2 });
      g.translate(0, 0, -L / 2);
      return g;
    });
  },
  /** 跑道形（膠囊形）環，平躺，厚 t */
  stadium(len, wid, band, t = 0.06) {
    return get(`stad${len},${wid},${band},${t}`, () => {
      const cap = (L, W) => {
        const s = new THREE.Shape();
        const r = W / 2;
        const hl = L / 2 - r;
        s.moveTo(-hl, -r);
        s.lineTo(hl, -r);
        s.absarc(hl, 0, r, -Math.PI / 2, Math.PI / 2, false);
        s.lineTo(-hl, r);
        s.absarc(-hl, 0, r, Math.PI / 2, Math.PI * 1.5, false);
        return s;
      };
      const outer = cap(len, wid);
      if (band > 0) {
        const inner = cap(len - band * 2, wid - band * 2);
        outer.holes.push(new THREE.Path(inner.getPoints(48).reverse()));
      }
      const g = new THREE.ExtrudeGeometry(outer, { depth: t, bevelEnabled: false, curveSegments: 24 });
      g.rotateX(-Math.PI / 2);
      return g;
    });
  },
  /** 平面形狀（翅膀、葉子） */
  shape(key, fn) { return get('shape' + key, fn); }
};

// ---------- 共用材質 ----------
export const MAT = {
  wall: mat('#FBF8F2', { roughness: 0.9 }),
  cream: mat('#F3EADB', { roughness: 0.9 }),
  stone: mat('#E8E2D6', { roughness: 0.95 }),
  path: mat('#F3EEE4', { roughness: 0.95 }),
  wood: mat('#CFA172', { roughness: 0.85 }),
  woodDark: mat('#8F6A4C', { roughness: 0.85 }),
  trunk: mat('#9C7656', { roughness: 0.9 }),
  roofRed: mat('#E8896A', { roughness: 0.75 }),
  roofBlue: mat('#7F9DBA', { roughness: 0.75 }),
  roofGrey: mat('#9AA6B2', { roughness: 0.75 }),
  red: mat('#E8665A', { roughness: 0.6 }),
  yellow: mat('#F7CF55', { roughness: 0.6 }),
  white: mat('#FFFFFF', { roughness: 0.7 }),
  metal: mat('#C8CED6', { roughness: 0.35, metalness: 0.6 }),
  dark: mat('#3B4652', { roughness: 0.6 }),
  rock: mat('#B8B3A7', { roughness: 0.95, flatShading: true }),
  rockDark: mat('#9C978C', { roughness: 0.95, flatShading: true }),
  asphalt: mat('#7C858E', { roughness: 0.95 }),
  solar: mat('#2E4E7E', { roughness: 0.25, metalness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: '#CDEBF5', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.5 }),
  soil: mat('#B88A63', { roughness: 1 }),
  skin: mat('#F4D3B8', { roughness: 0.8 }),
  pond: mat('#86D6D3', { roughness: 0.12, metalness: 0.05 }),
  snow: mat('#FFFFFF', { roughness: 0.9 }),
  pumpkin: mat('#F29A45', { roughness: 0.7 }),
  hay: mat('#E9CC7A', { roughness: 1 }),
  // 夜裡會亮的
  window: new THREE.MeshStandardMaterial({ color: '#BFD8E6', roughness: 0.2, metalness: 0.1, emissive: '#FFC977', emissiveIntensity: 0 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#FFF6DE', roughness: 0.4, emissive: '#FFD27A', emissiveIntensity: 0.2 }),
  lantern: new THREE.MeshStandardMaterial({ color: '#EE5D4F', roughness: 0.5, emissive: '#FF5A3C', emissiveIntensity: 0.1 }),
  beacon: new THREE.MeshStandardMaterial({ color: '#FFF4C2', roughness: 0.3, emissive: '#FFE08A', emissiveIntensity: 0.6 })
};

export function themeMats(color) {
  const c = new THREE.Color(color);
  const soft = c.clone().lerp(new THREE.Color('#ffffff'), 0.62);
  const deep = c.clone().multiplyScalar(0.82);
  return {
    main: mat('#' + c.getHexString(), { roughness: 0.6 }),
    soft: mat('#' + soft.getHexString(), { roughness: 0.92 }),
    deep: mat('#' + deep.getHexString(), { roughness: 0.65 }),
    gloss: mat('#' + c.getHexString(), { roughness: 0.25, metalness: 0.15 })
  };
}

/** 以 (x, y, z) 為原點、繞 y 旋轉 rot 的放置器 */
export class Placer {
  constructor(batch, x, y, z, rot = 0) {
    Object.assign(this, { batch, x, y, z, rot });
    this.c = Math.cos(rot);
    this.s = Math.sin(rot);
  }
  world(lx, lz) {
    return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c];
  }
  add(geom, material, lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, opts) {
    const [wx, wz] = this.world(lx, lz);
    this.batch.add(geom, material, M(wx, this.y + ly, wz, rx, ry + this.rot, rz, sx, sy, sz), opts);
    return this;
  }
  /** 方塊：底面放在 ly */
  box(w, h, d, material, lx, ly, lz, ry = 0, r = 0.06, opts) {
    return this.add(G.box(w, h, d, r), material, lx, ly + h / 2, lz, 0, ry, 0, 1, 1, 1, opts);
  }
  /** 圓柱：底面放在 ly */
  cyl(rt, rb, h, material, lx, ly, lz, seg = 18, opts) {
    return this.add(G.cyl(rt, rb, h, seg), material, lx, ly + h / 2, lz, 0, 0, 0, 1, 1, 1, opts);
  }
  /** 兩點之間的細桿 */
  rod(a, b, radius, material, seg = 8) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rot);
    q.premultiply(yaw);
    const [wx, wz] = this.world(mid[0], mid[2]);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(wx, this.y + mid[1], wz), q, new THREE.Vector3(1, 1, 1));
    this.batch.add(G.cyl(radius, radius, len, seg), material, m);
    return this;
  }
}
