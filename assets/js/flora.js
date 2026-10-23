import * as THREE from 'three';
import { M, mat } from './util.js';
import { G, MAT } from './kit.js';

// 樹、花、燈、長椅與四季小物（全部進合併批次）
// ctx.batch：主批次；ctx.seasonal[季節]：只在該季顯示；ctx.S：隨季節變色的材質

const palmMat = mat('#5DB86A', { roughness: 0.8 });
const palmTrunk = mat('#B48A62', { roughness: 0.9 });
const coconut = mat('#8C6A44', { roughness: 0.8 });
const umbrellaMats = ['#FF8A80', '#4FC3F7', '#FFD54F', '#81C784'].map((c) => mat(c, { roughness: 0.6 }));
const carrot = mat('#F08A3C', { roughness: 0.6 });
const scarf = mat('#E25D6B', { roughness: 0.7 });

export function tree(ctx, x, y, z, s = 1, rnd = Math.random, kind = 'round') {
  const b = ctx.batch;
  if (kind === 'cone') {
    const h = 0.55 * s;
    b.add(G.cyl(0.08, 0.11, h, 8), MAT.trunk, M(x, y + h / 2, z));
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const r = (0.78 - i * 0.18) * s;
      const th = (0.95 - i * 0.12) * s;
      const ty = y + h + i * 0.5 * s + th / 2 - 0.1 * s;
      const rot = rnd() * Math.PI;
      b.add(G.cone(1, 1, 9), ctx.S.conifer, M(x, ty, z, 0, rot, 0, r, th, r));
      ctx.seasonal.winter.add(G.cone(1, 1, 9), MAT.snow, M(x, ty + th * 0.28, z, 0, rot, 0, r * 0.62, th * 0.45, r * 0.62));
    }
    return;
  }
  if (kind === 'palm') {
    palm(ctx, x, y, z, s, rnd);
    return;
  }
  // 圓冠樹：冬天落葉，只剩枝幹
  const h = (0.9 + rnd() * 0.3) * s;
  b.add(G.cyl(0.08, 0.13, h, 8), MAT.trunk, M(x, y + h / 2, z, 0, 0, 0, s, 1, s));
  const lean = rnd() * Math.PI * 2;
  for (let k = 0; k < 3; k++) {
    const a = lean + k * 2.1;
    b.add(G.cyl(0.025, 0.045, 0.55, 6), MAT.trunk, M(x + Math.cos(a) * 0.14 * s, y + h + 0.12 * s, z + Math.sin(a) * 0.14 * s, 0.75, -a + Math.PI / 2, 0, s, s, s));
  }
  const pickLeaf = () => {
    const v = rnd();
    return v < 0.45 ? ctx.S.leafA : v < 0.75 ? ctx.S.leafB : ctx.S.leafC;
  };
  const leaf = pickLeaf();
  const blobs = 3 + Math.floor(rnd() * 2);
  for (let k = 0; k < blobs; k++) {
    const a = (k / blobs) * Math.PI * 2 + rnd();
    const rr = k === 0 ? 0 : 0.32 * s;
    const br = (k === 0 ? 0.62 : 0.42 + rnd() * 0.12) * s;
    b.add(G.sph(1, 14, 10), leaf, M(x + Math.cos(a) * rr, y + h + (k === 0 ? 0.42 : 0.22 + rnd() * 0.3) * s, z + Math.sin(a) * rr, 0, 0, 0, br, br * 0.88, br));
  }
}

export function palm(ctx, x, y, z, s = 1, rnd = Math.random) {
  const b = ctx.batch;
  const lean = rnd() * Math.PI * 2;
  const segs = 6;
  let px = x, py = y, pz = z;
  const segH = 0.36 * s;
  for (let i = 0; i < segs; i++) {
    const tilt = 0.05 + i * 0.045;
    const dx = Math.cos(lean) * Math.sin(tilt) * segH;
    const dz = Math.sin(lean) * Math.sin(tilt) * segH;
    const dy = Math.cos(tilt) * segH;
    const r = (0.1 - i * 0.008) * s;
    b.add(G.cyl(r * 0.9, r, segH * 1.08, 8), palmTrunk, M(px + dx / 2, py + dy / 2, pz + dz / 2, Math.sin(lean) * tilt, 0, -Math.cos(lean) * tilt));
    px += dx; py += dy; pz += dz;
  }
  const fronds = 7;
  for (let k = 0; k < fronds; k++) {
    const a = (k / fronds) * Math.PI * 2 + rnd() * 0.4;
    const len = (0.95 + rnd() * 0.25) * s;
    const cx = px + Math.cos(a) * len * 0.45;
    const cz = pz + Math.sin(a) * len * 0.45;
    b.add(G.sph(1, 10, 6), palmMat, M(cx, py - 0.12 * s, cz, 0.42, -a + Math.PI / 2, 0, 0.17 * s, 0.035 * s, len * 0.55));
  }
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1;
    b.add(G.sph(0.075 * s, 8, 6), coconut, M(px + Math.cos(a) * 0.1 * s, py - 0.12 * s, pz + Math.sin(a) * 0.1 * s));
  }
}

export function bush(ctx, x, y, z, s = 1, rnd = Math.random) {
  const m = rnd() < 0.5 ? ctx.S.leafC : ctx.S.conifer;
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + rnd();
    const r = (0.26 + rnd() * 0.12) * s;
    ctx.batch.add(G.sph(1, 12, 9), m, M(x + Math.cos(a) * 0.2 * s, y + r * 0.7, z + Math.sin(a) * 0.2 * s, 0, 0, 0, r, r * 0.85, r));
  }
}

export function flowers(ctx, x, y, z, s = 1, rnd = Math.random, batch = ctx.batch) {
  batch.add(G.sph(1, 10, 6), ctx.S.leafC, M(x, y + 0.04, z, 0, 0, 0, 0.42 * s, 0.1 * s, 0.42 * s));
  const n = 6 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.36 * s;
    batch.add(G.sph(0.075 * s, 8, 6), ctx.S.flowers[Math.floor(rnd() * ctx.S.flowers.length)], M(x + Math.cos(a) * r, y + 0.13 * s, z + Math.sin(a) * r));
  }
}

export function lampPost(ctx, x, y, z, s = 1) {
  const b = ctx.batch;
  b.add(G.cyl(0.035, 0.05, 1.5 * s, 8), MAT.dark, M(x, y + 0.75 * s, z));
  b.add(G.sph(0.13 * s, 12, 10), MAT.lamp, M(x, y + 1.58 * s, z), { cast: false });
  b.add(G.cone(0.17 * s, 0.14 * s, 10), MAT.dark, M(x, y + 1.73 * s, z));
  ctx.lights?.push(new THREE.Vector3(x, y + 1.58 * s, z));
}

export function bench(ctx, x, y, z, yaw = 0) {
  const b = ctx.batch;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  let p = P(0, 0.28, 0); b.add(G.box(0.9, 0.06, 0.3, 0.02), MAT.wood, M(p[0], p[1], p[2], 0, yaw, 0));
  p = P(0, 0.48, -0.14); b.add(G.box(0.9, 0.22, 0.05, 0.02), MAT.wood, M(p[0], p[1], p[2], 0, yaw, 0));
  for (const lx of [-0.36, 0.36]) { p = P(lx, 0.13, 0); b.add(G.box(0.05, 0.26, 0.28, 0.01), MAT.dark, M(p[0], p[1], p[2], 0, yaw, 0)); }
}

// ---------- 四季小物 ----------
export function seasonalProps(ctx, x, y, z, rnd = Math.random) {
  const sp = ctx.seasonal;
  // 春：額外的花叢
  flowers(ctx, x, y, z, 1.1, rnd, sp.spring);
  flowers(ctx, x + 0.7, y, z + 0.4, 0.8, rnd, sp.spring);
  // 夏：海灘傘
  const um = umbrellaMats[Math.floor(rnd() * umbrellaMats.length)];
  sp.summer.add(G.cyl(0.025, 0.025, 1.3, 6), MAT.white, M(x, y + 0.65, z, 0.12, 0, 0));
  sp.summer.add(G.cone(0.62, 0.32, 12), um, M(x, y + 1.38, z + 0.07, 0.12, 0, 0));
  sp.summer.add(G.box(0.45, 0.03, 0.9, 0.01), umbrellaMats[(umbrellaMats.indexOf(um) + 1) % 4], M(x + 0.45, y + 0.02, z + 0.3, 0, 0.3, 0));
  // 秋：南瓜與乾草捆
  for (let k = 0; k < 3; k++) {
    const a = k * 2.2 + rnd();
    const px = x + Math.cos(a) * 0.35, pz = z + Math.sin(a) * 0.35;
    const r = 0.17 + rnd() * 0.08;
    sp.autumn.add(G.sph(1, 14, 10), MAT.pumpkin, M(px, y + r * 0.7, pz, 0, 0, 0, r, r * 0.75, r));
    sp.autumn.add(G.cyl(0.02, 0.03, 0.12, 5), MAT.woodDark, M(px, y + r * 1.35, pz));
  }
  sp.autumn.add(G.cyl(0.32, 0.32, 0.6, 14), MAT.hay, M(x + 0.9, y + 0.32, z - 0.3, 0, 0.4, Math.PI / 2));
  // 冬：雪人
  const sx = x + 0.2, sz = z - 0.2;
  sp.winter.add(G.sph(0.32, 16, 12), MAT.snow, M(sx, y + 0.3, sz));
  sp.winter.add(G.sph(0.23, 16, 12), MAT.snow, M(sx, y + 0.72, sz));
  sp.winter.add(G.sph(0.16, 14, 10), MAT.snow, M(sx, y + 1.02, sz));
  sp.winter.add(G.cone(0.035, 0.18, 6), carrot, M(sx, y + 1.02, sz + 0.2, Math.PI / 2, 0, 0));
  sp.winter.add(G.torus(0.19, 0.045, 6, 16), scarf, M(sx, y + 0.86, sz, Math.PI / 2, 0, 0));
  sp.winter.add(G.sph(1, 10, 6), MAT.snow, M(x - 0.6, y + 0.03, z + 0.4, 0, 0, 0, 0.5, 0.12, 0.38));
}
