import * as THREE from 'three';
import { M, mat, rng, axialToWorld, HEX_DIRS, bevelHex } from './util.js';
import { G, MAT, Placer, themeMats } from './kit.js';
import { tree, bush, flowers, lampPost, bench, seasonalProps } from './flora.js';
import { addBoat } from './vehicles.js';

// 理念島：六角台座 + 草地 + 主題廣場 + 地標建築 + 步道與橋

export const ISLAND_R = 8.7; // 沙岸外緣（外接圓半徑）
export const GRASS_R = 8.0;
export const TOP = 1.45; // 草地頂面
export const PLAZA_Y = TOP + 0.1;
export const WALK_Y = TOP + 0.08;

const gold = mat('#E3B54A', { roughness: 0.35, metalness: 0.5 });
const teal = mat('#4CC3A0', { roughness: 0.6 });
const pink = mat('#F49AB8', { roughness: 0.6 });
const blue = mat('#6FA8F0', { roughness: 0.6 });
const green = mat('#8BD26E', { roughness: 0.6 });
const turf = mat('#86CF70', { roughness: 0.95 });
const track = mat('#EE9C7C', { roughness: 0.9 });
const ocean = mat('#63B8E8', { roughness: 0.3, metalness: 0.1 });
const land = mat('#8FD07A', { roughness: 0.7 });
const peach = mat('#FFE3D2', { roughness: 0.9 });
const mint = mat('#DFF4EA', { roughness: 0.9 });
const butter = mat('#FFF1C9', { roughness: 0.9 });

export function buildIslands(data, ctx) {
  const info = new Map();
  const byKey = new Map();
  data.islands.forEach((isl, i) => {
    const q = Number.isFinite(+isl.q) ? +isl.q : 0;
    const r = Number.isFinite(+isl.r) ? +isl.r : 0;
    const { x, z } = axialToWorld(q, r);
    info.set(isl.id, { id: isl.id, index: i, data: isl, q, r, x, z, neighbors: [], freeDirs: [], color: isl.color || '#7CC6A8', labelY: TOP + 4.2 });
    byKey.set(`${q},${r}`, isl.id);
  });

  for (const it of info.values()) {
    for (const [dq, dr] of HEX_DIRS) {
      const nb = byKey.get(`${it.q + dq},${it.r + dr}`);
      const p = axialToWorld(it.q + dq, it.r + dr);
      const u = new THREE.Vector2(p.x - it.x, p.z - it.z).normalize();
      if (nb) it.neighbors.push({ id: nb, u });
      else it.freeDirs.push(u);
    }
  }

  const hit = new THREE.Group();
  hit.name = 'island-hit';
  const hitGeo = new THREE.CylinderGeometry(ISLAND_R, ISLAND_R, 4, 6);

  for (const it of info.values()) {
    const rnd = rng(it.id);
    const T = themeMats(it.color);
    it.mats = T;
    const b = ctx.batch;

    // 台座：沙岸 → 草地 → 廣場
    b.add(bevelHex(ISLAND_R, 3.6, 0.5, 4), ctx.S.sand, M(it.x, -2.5, it.z));
    b.add(bevelHex(GRASS_R, 0.62, 0.26, 3), ctx.S.grass, M(it.x, TOP - 0.62, it.z));
    b.add(bevelHex(3.35, 0.16, 0.06, 2), T.soft, M(it.x, TOP - 0.06, it.z));

    // 步道：往每個相鄰島的方向
    for (const nb of it.neighbors) {
      const yaw = Math.atan2(nb.u.x, nb.u.y);
      const mid = 5.0;
      b.add(G.box(1.35, 0.12, 4.6, 0.05), MAT.path, M(it.x + nb.u.x * mid, TOP + 0.01, it.z + nb.u.y * mid, 0, yaw, 0));
    }

    // 地標
    const p = new Placer(b, it.x, PLAZA_Y, it.z, 0);
    const build = LANDMARKS[it.data.landmark] || LANDMARKS.school;
    build(p, T, ctx, rnd, it);

    decorate(ctx, it, rnd);

    const h = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    h.position.set(it.x, 0.5, it.z);
    h.userData.islandId = it.id;
    hit.add(h);
  }

  // 橋：每對相鄰島蓋一座
  const done = new Set();
  for (const it of info.values()) {
    for (const nb of it.neighbors) {
      const key = [it.id, nb.id].sort().join('|');
      if (done.has(key)) continue;
      done.add(key);
      const o = info.get(nb.id);
      bridge(ctx, (it.x + o.x) / 2, (it.z + o.z) / 2, Math.atan2(nb.u.x, nb.u.y));
    }
  }

  ctx.root.add(hit);
  return { info, hit };
}

function bridge(ctx, x, z, yaw) {
  const p = new Placer(ctx.batch, x, TOP, z, yaw);
  const L = 4.9;
  // 橋面頂端比步道高 0.09，避免兩個面重疊閃爍
  p.box(1.7, 0.16, L, MAT.wood, 0, 0, 0, 0, 0.04);
  for (const side of [-0.82, 0.82]) {
    p.box(0.07, 0.07, L, MAT.wood, side, 0.6, 0, 0, 0.02);
    for (let k = -2; k <= 2; k++) p.box(0.08, 0.5, 0.08, MAT.woodDark, side, 0.13, k * 1.1, 0, 0.02);
  }
  // 橋墩
  for (const side of [-0.6, 0.6]) p.add(G.cyl(0.12, 0.14, 1.8, 10), MAT.woodDark, side, -0.95, 0);
}

// 裝飾：樹、花、燈、長椅、四季小物
function decorate(ctx, it, rnd) {
  const placed = [];
  const exclusion = it.exclude || [];
  const nearPath = (x, z) => it.neighbors.some((nb) => {
    const t = x * nb.u.x + z * nb.u.y;
    if (t < 2.2) return false;
    const d = Math.abs(-x * nb.u.y + z * nb.u.x);
    return d < 1.15;
  });
  const free = (x, z, rad) => {
    if (nearPath(x, z)) return false;
    if (exclusion.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + rad)) return false;
    return placed.every((q) => Math.hypot(x - q.x, z - q.z) > q.r + rad);
  };
  const tryPlace = (rMin, rMax, rad, fn, tries = 30) => {
    for (let t = 0; t < tries; t++) {
      const a = rnd() * Math.PI * 2;
      const r = rMin + rnd() * (rMax - rMin);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!insideHex(x, z, GRASS_R - 0.7) || !free(x, z, rad)) continue;
      placed.push({ x, z, r: rad });
      fn(it.x + x, it.z + z, a, r);
      return true;
    }
    return false;
  };

  // 燈柱沿著步道
  for (const nb of it.neighbors.slice(0, 3)) {
    const x = nb.u.x * 3.8 - nb.u.y * 0.95;
    const z = nb.u.y * 3.8 + nb.u.x * 0.95;
    lampPost(ctx, it.x + x, TOP, it.z + z);
    placed.push({ x, z, r: 0.3 });
  }
  const nTrees = 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < nTrees; i++) {
    const kind = rnd() < 0.58 ? 'round' : rnd() < 0.6 ? 'cone' : 'palm';
    const s = 0.85 + rnd() * 0.45;
    tryPlace(3.9, 6.9, 0.75 * s, (x, z) => tree(ctx, x, TOP, z, s, rnd, kind));
  }
  for (let i = 0; i < 5; i++) tryPlace(5.2, 7.0, 0.45, (x, z) => bush(ctx, x, TOP, z, 0.9 + rnd() * 0.5, rnd));
  for (let i = 0; i < 3; i++) tryPlace(3.7, 6.4, 0.45, (x, z) => flowers(ctx, x, TOP, z, 1, rnd));
  tryPlace(3.6, 4.6, 0.6, (x, z, a) => bench(ctx, x, TOP, z, -a - Math.PI / 2));
  // 面海的一側放四季小物
  const dir = it.freeDirs[0] || new THREE.Vector2(0, 1);
  const sx = dir.x * 5.6 + dir.y * 1.2, sz = dir.y * 5.6 - dir.x * 1.2;
  if (free(sx, sz, 0.9)) {
    placed.push({ x: sx, z: sz, r: 0.9 });
    seasonalProps(ctx, it.x + sx, TOP, it.z + sz, rnd);
  } else {
    tryPlace(4.5, 6.2, 0.9, (x, z) => seasonalProps(ctx, x, TOP, z, rnd));
  }
}

function insideHex(x, z, R) {
  // 尖頂六角形（尖角朝 ±z）
  const ax = Math.abs(x), az = Math.abs(z);
  const inr = R * Math.sqrt(3) / 2;
  return ax <= inr && ax * 0.5 + az * (Math.sqrt(3) / 2) <= inr;
}

// ---------- 地標 ----------
const LANDMARKS = {
  school(p, T, ctx) {
    p.box(4.6, 2.1, 1.7, MAT.wall, 0, 0, -0.75, 0, 0.08);
    p.box(4.62, 0.1, 1.72, T.soft, 0, 1.0, -0.75, 0, 0.03);
    p.box(4.9, 0.26, 2.0, T.main, 0, 2.1, -0.75, 0, 0.08);
    for (const fy of [0.32, 1.25]) {
      for (let i = -2; i <= 2; i++) {
        if (fy < 1 && i === 0) continue;
        p.box(0.56, 0.5, 0.06, MAT.window, i * 0.88, fy, 0.11, 0, 0.02);
      }
    }
    p.box(0.72, 0.88, 0.08, MAT.woodDark, 0, 0, 0.12, 0, 0.02);
    p.box(1.3, 0.08, 0.55, T.main, 0, 0.98, 0.33, 0, 0.03);
    p.box(1.3, 0.1, 0.55, MAT.stone, 0, 0, 0.45, 0, 0.02);
    p.box(1.1, 1.3, 1.1, MAT.wall, 0, 2.36, -0.75, 0, 0.06);
    p.add(G.cone(0.92, 0.85, 4), T.main, 0, 2.36 + 1.3 + 0.42, -0.75, 0, Math.PI / 4, 0);
    p.add(G.cyl(0.32, 0.32, 0.06, 28), MAT.white, 0, 3.0, -0.18, Math.PI / 2, 0, 0);
    p.box(0.04, 0.22, 0.03, MAT.dark, 0, 2.98, -0.14, 0, 0);
    p.box(0.17, 0.04, 0.03, MAT.dark, 0.07, 2.98, -0.14, 0, 0);
    p.cyl(0.035, 0.045, 2.9, MAT.metal, 2.05, 0, 1.45, 8);
    p.box(0.78, 0.48, 0.03, T.main, 2.45, 2.3, 1.45, 0, 0.01);
    for (const x of [-1.9, -0.9]) {
      p.box(0.85, 0.32, 0.5, MAT.wood, x, 0, 1.3, 0, 0.04);
      p.add(G.sph(1, 12, 9), ctx.S.leafC, x, 0.42, 1.3, 0, 0, 0, 0.36, 0.22, 0.24);
    }
  },

  farm(p, T, ctx) {
    p.box(2.1, 1.35, 1.7, MAT.red, -0.95, 0, -1.0, 0, 0.06);
    p.add(G.gable(2.1, 0.95, 1.85, 0.14), T.main, -0.95, 1.35, -1.0);
    p.box(0.85, 0.95, 0.06, MAT.wall, -0.95, 0, -0.13, 0, 0.02);
    p.add(G.box(1.2, 0.07, 0.03, 0.01), MAT.red, -0.95, 0.47, -0.09, 0, 0, 0.83);
    p.add(G.box(1.2, 0.07, 0.03, 0.01), MAT.red, -0.95, 0.47, -0.09, 0, 0, -0.83);
    p.box(0.5, 0.4, 0.05, MAT.window, -0.95, 1.55, -0.1, 0, 0.02);
    p.cyl(0.5, 0.5, 2.5, MAT.wall, 0.75, 0, -1.35, 22);
    p.add(G.hemi(0.5), T.main, 0.75, 2.5, -1.35);
    p.cyl(0.52, 0.52, 0.08, MAT.metal, 0.75, 0.8, -1.35, 22);
    p.cyl(0.52, 0.52, 0.08, MAT.metal, 0.75, 1.6, -1.35, 22);
    for (let i = 0; i < 4; i++) {
      const zz = 0.45 + i * 0.6;
      p.box(3.6, 0.1, 0.36, MAT.soil, 0.1, 0, zz, 0, 0.04);
      for (let j = -5; j <= 5; j++) {
        const s = 0.13 + ((i + j) % 3) * 0.02;
        p.add(G.sph(1, 10, 8), ctx.S.leafC, 0.1 + j * 0.31, 0.16, zz, 0, 0, 0, s, s * 0.8, s);
      }
    }
    // 稻草人
    p.cyl(0.03, 0.03, 1.3, MAT.woodDark, 2.0, 0, 1.6, 6);
    p.add(G.box(0.9, 0.05, 0.05, 0.01), MAT.woodDark, 2.0, 1.0, 1.6);
    p.add(G.sph(0.14, 12, 10), MAT.hay, 2.0, 1.38, 1.6);
    p.add(G.cone(0.24, 0.18, 12), MAT.hay, 2.0, 1.52, 1.6);
    p.add(G.box(0.36, 0.42, 0.14, 0.03), T.main, 2.0, 0.92, 1.6);
  },

  harbor(p, T, ctx, rnd, it) {
    const lx = -1.2, lz = -1.0;
    p.cyl(0.78, 0.88, 0.35, MAT.stone, lx, 0, lz, 22);
    p.cyl(0.43, 0.6, 3.0, MAT.white, lx, 0.35, lz, 22);
    p.cyl(0.575, 0.6, 0.42, T.main, lx, 0.9, lz, 22);
    p.cyl(0.52, 0.545, 0.42, T.main, lx, 2.0, lz, 22);
    p.cyl(0.62, 0.62, 0.08, MAT.dark, lx, 3.35, lz, 22);
    p.add(G.torus(0.6, 0.025, 6, 28), MAT.dark, lx, 3.62, lz, Math.PI / 2, 0, 0);
    p.cyl(0.34, 0.34, 0.5, MAT.beacon, lx, 3.43, lz, 18, { cast: false });
    p.add(G.cone(0.46, 0.5, 18), T.main, lx, 4.18, lz);
    p.add(G.sph(0.07, 8, 6), MAT.dark, lx, 4.47, lz);
    ctx.beacons.push(new THREE.Vector3(p.x + lx, p.y + 3.68, p.z + lz));
    // 守燈人小屋
    p.box(1.5, 0.95, 1.05, MAT.wall, 0.95, 0, -1.15, 0, 0.06);
    p.add(G.gable(1.05, 0.5, 1.5, 0.1), T.main, 0.95, 0.95, -1.15, 0, Math.PI / 2, 0);
    p.box(0.42, 0.36, 0.05, MAT.window, 0.6, 0.38, -0.6, 0, 0.02);
    p.box(0.36, 0.66, 0.05, MAT.woodDark, 1.25, 0, -0.6, 0, 0.02);
    // 漁貨箱與浮球
    for (let k = 0; k < 3; k++) p.box(0.45, 0.3, 0.32, k % 2 ? MAT.wood : blue, 1.4 + (k % 2) * 0.25, 0, 0.8 + k * 0.36, k * 0.3, 0.04);
    for (let k = 0; k < 4; k++) p.add(G.sph(0.13, 12, 10), k % 2 ? MAT.red : MAT.white, -1.8 + k * 0.28, 0.13, 1.5 + (k % 2) * 0.2);
    // 碼頭往海伸出去
    const u = it.freeDirs[0];
    if (u) {
      const yaw = Math.atan2(u.x, u.y);
      const L = 5.6;
      const cx = u.x * 8.9, cz = u.y * 8.9;
      const dp = new Placer(ctx.batch, it.x + cx, 1.05, it.z + cz, yaw);
      dp.box(1.4, 0.14, L, MAT.wood, 0, 0, 0, 0, 0.03);
      for (let k = -2; k <= 2; k++) for (const s of [-0.6, 0.6]) dp.add(G.cyl(0.08, 0.09, 1.9, 8), MAT.woodDark, s, -0.8, k * 1.25);
      addBoat(ctx.batch, it.x + cx + u.y * 1.6, 0.05, it.z + cz - u.x * 1.6, yaw, T.main, 0.9);
      it.exclude = [{ x: u.x * 6.2, z: u.y * 6.2, r: 1.2 }];
    }
  },

  library(p, T) {
    p.box(3.9, 0.22, 2.6, MAT.stone, 0, 0, -0.75, 0, 0.04);
    p.box(3.4, 1.7, 1.9, MAT.cream, 0, 0.22, -1.0, 0, 0.06);
    for (const x of [-1.2, -0.4, 0.4, 1.2]) p.cyl(0.12, 0.14, 1.5, MAT.white, x, 0.22, 0.25, 16);
    p.box(3.6, 0.22, 0.55, MAT.white, 0, 1.72, 0.18, 0, 0.03);
    p.add(G.gable(3.3, 0.62, 0.45, 0.08), T.main, 0, 1.94, 0.2);
    p.box(3.6, 0.2, 1.95, T.main, 0, 1.92, -1.0, 0, 0.05);
    for (const x of [-0.8, 0.8]) p.box(0.5, 0.75, 0.05, MAT.window, x, 0.55, -0.04, 0, 0.02);
    p.box(0.6, 0.95, 0.05, MAT.woodDark, 0, 0.22, -0.04, 0, 0.02);
    p.box(2.4, 0.11, 0.34, MAT.stone, 0, 0, 0.72, 0, 0.02);
    // 疊書雕塑
    p.box(1.0, 0.24, 0.72, T.main, 2.0, 0, 1.55, 0.2, 0.04);
    p.box(0.95, 0.22, 0.68, MAT.yellow, 2.0, 0.24, 1.55, -0.15, 0.04);
    p.box(0.9, 0.2, 0.64, teal, 2.0, 0.46, 1.55, 0.35, 0.04);
    p.box(0.86, 0.04, 0.6, MAT.wall, 2.0, 0.66, 1.55, 0.35, 0.02);
  },

  tech(p, T, ctx) {
    p.cyl(1.25, 1.3, 1.1, MAT.wall, -0.7, 0, -0.95, 32);
    p.add(G.hemi(1.25, 32, 12), T.gloss, -0.7, 1.1, -0.95);
    p.rod([-0.7, 1.75, -0.95], [0.15, 2.45, -0.35], 0.15, MAT.metal, 14);
    p.box(0.5, 0.5, 0.05, MAT.window, -0.7, 0.3, 0.33, 0, 0.02);
    p.cyl(0.05, 0.07, 2.5, MAT.metal, 1.5, 0, -1.4, 8);
    p.add(G.hemi(0.55, 20, 8), MAT.white, 1.5, 2.45, -1.4, -2.3, 0.4, 0);
    for (let k = 0; k < 3; k++) {
      p.add(G.box(0.95, 0.05, 0.62, 0.02), MAT.solar, -1.4 + k * 1.05, 0.62, 1.2, -0.5, 0, 0);
      p.cyl(0.03, 0.03, 0.55, MAT.metal, -1.4 + k * 1.05, 0, 1.25, 6);
    }
    // 小機器人
    const rx = 1.55, rz = 1.35;
    p.box(0.56, 0.6, 0.42, T.main, rx, 0.12, rz, -0.4, 0.1);
    p.box(0.46, 0.36, 0.38, MAT.white, rx, 0.75, rz, -0.4, 0.1);
    for (const s of [-0.1, 0.1]) {
      const c = Math.cos(-0.4), si = Math.sin(-0.4);
      p.add(G.sph(0.05, 8, 6), MAT.dark, rx + s * c + 0.2 * si, 0.95, rz - s * si + 0.2 * c);
    }
    p.cyl(0.015, 0.015, 0.22, MAT.dark, rx, 1.11, rz, 6);
    p.add(G.sph(0.06, 8, 6), MAT.red, rx, 1.36, rz);
    p.box(0.12, 0.12, 0.3, MAT.dark, rx - 0.13, 0, rz, -0.4, 0.04);
    p.box(0.12, 0.12, 0.3, MAT.dark, rx + 0.13, 0, rz, -0.4, 0.04);
  },

  sports(p, T) {
    p.add(G.stadium(6.0, 3.8, 0.7, 0.06), track, 0, 0.0, 0, 0, Math.PI / 2, 0);
    p.add(G.stadium(4.6, 2.4, 0, 0.05), turf, 0, 0.005, 0, 0, Math.PI / 2, 0);
    p.add(G.stadium(5.3, 3.1, 0.035, 0.09), MAT.white, 0, 0, 0, 0, Math.PI / 2, 0);
    for (const s of [-1, 1]) {
      const z = s * 1.55;
      p.rod([-0.45, 0, z], [-0.45, 0.5, z], 0.025, MAT.white);
      p.rod([0.45, 0, z], [0.45, 0.5, z], 0.025, MAT.white);
      p.rod([-0.45, 0.5, z], [0.45, 0.5, z], 0.025, MAT.white);
    }
    for (let k = 0; k < 3; k++) p.box(0.32, 0.22 + k * 0.22, 2.6, k % 2 ? T.main : T.soft, 2.25 + k * 0.32, 0, 0, 0, 0.03);
    p.add(G.sph(0.12, 12, 10), MAT.white, 0.4, 0.12, 0.3);
  },

  temple(p, T) {
    p.box(4.0, 0.3, 3.0, MAT.stone, 0, 0, -0.6, 0, 0.05);
    p.box(3.0, 1.15, 1.9, MAT.cream, 0, 0.3, -0.85, 0, 0.04);
    for (const x of [-1.2, -0.4, 0.4, 1.2]) p.cyl(0.1, 0.1, 1.15, MAT.red, x, 0.3, 0.32, 12);
    p.box(0.62, 0.86, 0.05, MAT.red, 0, 0.3, 0.12, 0, 0.02);
    for (const x of [-0.85, 0.85]) p.add(G.cyl(0.2, 0.2, 0.05, 20), MAT.window, x, 0.82, 0.13, Math.PI / 2, 0, 0);
    p.box(3.75, 0.12, 2.65, T.main, 0, 1.45, -0.65, 0, 0.04);
    p.add(G.gable(3.0, 0.72, 2.3, 0.28), T.main, 0, 1.57, -0.7, 0, Math.PI / 2, 0);
    p.box(3.0, 0.12, 0.16, T.deep, 0, 2.27, -0.7, 0, 0.03);
    for (const s of [-1, 1]) p.add(G.cone(0.1, 0.55, 8), T.deep, s * 1.62, 2.43, -0.7, 0, 0, -s * 0.85);
    p.add(G.sph(0.13, 12, 10), gold, 0, 2.48, -0.7);
    p.cyl(0.3, 0.25, 0.38, gold, 0, 0, 1.55, 18);
    p.add(G.cone(0.22, 0.25, 14), gold, 0, 0.5, 1.55);
    for (const x of [-1.25, 1.25]) {
      p.add(G.sph(1, 14, 10), MAT.lantern, x, 1.12, 0.45, 0, 0, 0, 0.17, 0.21, 0.17, { cast: false });
    }
  },

  heart(p, T, ctx, rnd) {
    const gx = -0.7, gz = -0.65;
    p.cyl(1.5, 1.6, 0.18, MAT.stone, gx, 0, gz, 6);
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + Math.PI / 6;
      p.cyl(0.06, 0.06, 1.4, MAT.wall, gx + Math.cos(a) * 1.25, 0.18, gz + Math.sin(a) * 1.25, 8);
    }
    p.add(G.cone(1.85, 0.9, 6), T.main, gx, 1.58 + 0.45, gz, 0, Math.PI / 6, 0);
    p.add(G.sph(0.12, 10, 8), gold, gx, 2.6, gz);
    p.box(0.7, 0.5, 0.5, MAT.wall, 1.55, 0, 1.25, 0, 0.06);
    for (const s of [-0.2, 0.2]) p.add(G.sph(0.29, 18, 14), T.gloss, 1.55 + s, 1.15, 1.25);
    p.add(G.cone(0.42, 0.6, 18), T.gloss, 1.55, 0.8, 1.25, 0, 0, Math.PI);
    for (let k = 0; k < 5; k++) {
      const a = k * 1.25;
      flowers(ctx, p.x + gx + Math.cos(a) * 2.0, p.y - 0.1, p.z + gz + Math.sin(a) * 2.0, 0.7, rnd);
    }
  },

  hall(p, T) {
    p.box(3.8, 1.5, 2.1, MAT.wall, -0.3, 0, -0.95, 0, 0.1);
    p.box(3.2, 1.1, 0.06, MAT.window, -0.3, 0.15, 0.12, 0, 0.02);
    for (let k = 0; k <= 4; k++) p.box(0.06, 1.1, 0.08, MAT.wall, -1.9 + k * 0.8, 0.15, 0.14, 0, 0.01);
    for (let i = 0; i < 3; i++) p.add(G.gable(1.2, 0.55, 2.0, 0.04), T.main, -1.55 + i * 1.25, 1.5, -0.95);
    p.box(0.8, 0.25, 0.8, MAT.stone, 1.9, 0, 1.45, 0, 0.04);
    p.add(G.cyl(0.24, 0.24, 1.9, 6), MAT.yellow, 1.9, 0.25 + 0.25 + 0.95, 1.45);
    p.add(G.cyl(0.25, 0.25, 0.22, 6), MAT.metal, 1.9, 0.25 + 0.36, 1.45);
    p.add(G.cyl(0.24, 0.24, 0.14, 12), pink, 1.9, 0.25 + 0.18, 1.45);
    p.add(G.cone(0.24, 0.48, 6), MAT.wood, 1.9, 0.25 + 0.5 + 1.9 + 0.24, 1.45);
    p.add(G.cone(0.08, 0.16, 6), MAT.dark, 1.9, 0.25 + 0.5 + 1.9 + 0.48 + 0.02, 1.45);
    p.add(G.sph(1, 18, 14), MAT.red, 1.0, 0.33, 1.95, 0, 0, 0, 0.36, 0.32, 0.36);
    p.cyl(0.02, 0.025, 0.16, MAT.woodDark, 1.0, 0.62, 1.95, 6);
    p.add(G.sph(1, 10, 6), green, 1.09, 0.72, 1.95, 0, 0, 0.6, 0.12, 0.04, 0.07);
  },

  home(p, T) {
    const houses = [
      [-1.35, -1.0, 0.2, peach, MAT.roofRed],
      [1.25, -1.15, -0.25, mint, T.main],
      [-1.55, 1.35, -0.1, butter, MAT.roofBlue]
    ];
    for (const [hx, hz, hr, wall, roof] of houses) {
      p.box(1.4, 1.0, 1.2, wall, hx, 0, hz, hr, 0.06);
      p.add(G.gable(1.2, 0.68, 1.42, 0.12), roof, hx, 1.0, hz, 0, hr + Math.PI / 2, 0);
      const c = Math.cos(hr), s = Math.sin(hr);
      const fx = (lx, lz) => [hx + lx * c + lz * s, hz - lx * s + lz * c];
      let q = fx(0.3, 0.61); p.box(0.3, 0.55, 0.05, MAT.woodDark, q[0], 0, q[1], hr, 0.02);
      q = fx(-0.3, 0.61); p.box(0.34, 0.3, 0.05, MAT.window, q[0], 0.4, q[1], hr, 0.02);
      q = fx(0.4, -0.25); p.box(0.18, 0.5, 0.18, MAT.stone, q[0], 1.15, q[1], hr, 0.03);
    }
    for (let k = 0; k < 7; k++) p.box(0.06, 0.38, 0.06, MAT.wall, 0.3 + k * 0.32, 0, 1.4, 0, 0.02);
    p.box(2.1, 0.05, 0.04, MAT.wall, 1.26, 0.28, 1.4, 0, 0.01);
    p.cyl(0.03, 0.03, 0.75, MAT.woodDark, 0.15, 0, 0.9, 6);
    p.box(0.26, 0.2, 0.36, T.main, 0.15, 0.75, 0.9, 0, 0.05);
  },

  garden(p, T, ctx, rnd) {
    const gx = -0.6, gz = -0.85;
    p.box(2.9, 0.2, 1.95, MAT.wall, gx, 0, gz, 0, 0.04);
    p.box(2.7, 0.9, 1.75, MAT.glass, gx, 0.2, gz, 0, 0.02, { cast: false });
    p.add(halfCyl(0.875, 2.7), MAT.glass, gx, 1.1, gz, 0, 0, 0, 1, 1, 1, { cast: false });
    for (let k = 0; k <= 4; k++) {
      const x = gx - 1.35 + k * 0.675;
      p.add(G.torus(0.875, 0.025, 6, 22, Math.PI), MAT.wall, x, 1.1, gz, 0, Math.PI / 2, 0);
      p.box(0.05, 0.9, 0.05, MAT.wall, x, 0.2, gz + 0.86, 0, 0.01);
    }
    for (let k = 0; k < 6; k++) p.add(G.sph(0.2, 10, 8), ctx.S.leafC, gx - 1.0 + (k % 3) * 1.0, 0.45, gz - 0.4 + Math.floor(k / 3) * 0.8);
    for (let k = 0; k < 3; k++) {
      p.box(0.9, 0.28, 0.5, MAT.wood, -1.3 + k * 1.05, 0, 1.25, 0, 0.04);
      flowers(ctx, p.x - 1.3 + k * 1.05, p.y + 0.24, p.z + 1.25, 0.9, rnd);
    }
    p.box(0.45, 0.55, 0.45, green, 1.9, 0, 0.6, 0, 0.06);
    ctx.turbines.push({ x: p.x + 1.7, y: p.y, z: p.z - 1.45, s: 0.55, yaw: 0.3 });
  },

  art(p, T) {
    p.box(3.2, 1.7, 1.9, MAT.wall, -0.4, 0, -0.95, 0, 0.1);
    const cols = [T.main, MAT.yellow, teal, pink, blue];
    cols.forEach((m, k) => p.box(0.5, 1.45, 0.06, m, -1.6 + k * 0.6, 0.08, 0.02, 0, 0.02));
    p.box(3.4, 0.16, 2.1, T.deep, -0.4, 1.7, -0.95, 0, 0.05);
    p.cyl(0.38, 0.44, 0.65, MAT.wall, 1.75, 0, 1.2, 20);
    p.add(G.knot(0.42, 0.12), T.gloss, 1.75, 1.45, 1.2, 0.3, 0, 0);
    const ex = -1.7, ez = 1.5;
    p.rod([ex - 0.25, 0, ez], [ex, 1.1, ez - 0.1], 0.025, MAT.wood);
    p.rod([ex + 0.25, 0, ez], [ex, 1.1, ez - 0.1], 0.025, MAT.wood);
    p.rod([ex, 0, ez - 0.4], [ex, 1.1, ez - 0.1], 0.025, MAT.wood);
    p.add(G.box(0.7, 0.55, 0.04, 0.01), MAT.wall, ex, 0.85, ez + 0.02, -0.15, 0, 0);
    [[T.main, -0.15, 0.08], [MAT.yellow, 0.12, -0.05], [teal, 0.02, 0.12]].forEach(([m, dx, dy]) =>
      p.add(G.box(0.18, 0.14, 0.02, 0.01), m, ex + dx, 0.85 + dy, ez + 0.05, -0.15, 0, 0));
  },

  puzzle(p, T) {
    const cols = [T.main, MAT.yellow, teal, pink, blue, green];
    const blocks = [[-1.25, 0, -1.0], [-0.3, 0, -1.0], [0.65, 0, -1.0], [-0.78, 0.92, -1.0], [0.18, 0.92, -1.0], [-0.3, 1.84, -1.0]];
    blocks.forEach(([x, y, z], k) => {
      p.box(0.9, 0.9, 0.9, cols[k % cols.length], x, y, z, 0, 0.12);
      const top = !blocks.some(([x2, y2]) => Math.abs(y2 - y - 0.92) < 0.01 && Math.abs(x2 - x) < 0.6);
      if (top) for (const [sx, sz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) p.cyl(0.12, 0.12, 0.1, cols[k % cols.length], x + sx, y + 0.9, z + sz, 14);
    });
    // 溜滑梯
    p.box(0.8, 0.08, 0.8, T.main, 1.7, 1.0, 0.6, 0, 0.03);
    for (const [sx, sz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) p.cyl(0.04, 0.04, 1.0, MAT.wall, 1.7 + sx, 0, 0.6 + sz, 8);
    p.add(G.box(0.6, 0.06, 1.7, 0.03), MAT.yellow, 1.7, 0.55, 1.65, 0.62, 0, 0);
    // 蹺蹺板
    p.add(G.cyl(0.12, 0.12, 0.3, 12), MAT.dark, -1.4, 0.12, 1.4, 0, 0, Math.PI / 2);
    p.add(G.box(1.8, 0.06, 0.25, 0.02), blue, -1.4, 0.28, 1.4, 0, 0, 0.18);
  },

  globe(p, T, ctx) {
    const gx = -0.9, gz = -0.9, gy = 2.05;
    p.cyl(0.62, 0.78, 0.3, MAT.stone, gx, 0, gz, 24);
    p.cyl(0.07, 0.09, 0.75, MAT.metal, gx, 0.3, gz, 10);
    p.add(G.sph(1.05, 36, 24), ocean, gx, gy, gz);
    const pts = [[0.6, 0.2], [0.3, 1.1], [-0.2, 0.7], [0.9, 2.4], [-0.5, 2.9], [0.2, -1.4], [-0.9, -0.6], [0.5, 3.6], [1.1, -2.5]];
    for (const [lat, lon] of pts) {
      const n = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const pos = new THREE.Vector3(p.x + gx, p.y + gy, p.z + gz).addScaledVector(n, 1.0);
      const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(0.36, 0.1, 0.27));
      ctx.batch.add(G.sph(1, 14, 10), land, m);
    }
    p.add(G.torus(1.22, 0.04, 8, 48), gold, gx, gy, gz, 0, 0.5, 0.41);
    const flagCols = [MAT.red, blue, MAT.yellow, green, MAT.white, T.main];
    flagCols.forEach((m, k) => {
      const fx = 0.5 + k * 0.42, fz = 1.75 - (k % 2) * 0.25;
      p.cyl(0.025, 0.03, 1.8, MAT.metal, fx, 0, fz, 6);
      p.box(0.42, 0.28, 0.02, m, fx + 0.22, 1.45, fz, 0, 0.01);
    });
    // 世界路標
    p.cyl(0.05, 0.05, 2.0, MAT.wood, 1.6, 0, -1.2, 8);
    [[T.main, 0.4], [MAT.yellow, -0.6], [teal, 1.4], [pink, 2.4]].forEach(([m, yaw], k) => {
      p.add(G.box(0.85, 0.2, 0.05, 0.02), m, 1.6 + Math.cos(-yaw) * 0.32, 1.85 - k * 0.27, -1.2 + Math.sin(-yaw) * 0.32, 0, yaw, 0);
    });
  }
};

function halfCyl(r, len) {
  return G.shape(`half${r},${len}`, () => {
    const g = new THREE.CylinderGeometry(r, r, len, 24, 1, false, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
    return g;
  });
}

export { LANDMARKS };
