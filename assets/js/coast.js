import * as THREE from 'three';
import { M, mat, rng } from './util.js';
import { G, MAT, Placer, themeMats } from './kit.js';
import { tree, palm, bush, flowers } from './flora.js';
import { makeTurbine, makeAerator, makePlane } from './vehicles.js';

// 沿海陸地（沙灘、防風林、魚塭、漁村、鹽山、遠山）與小離島（機場島、燈塔島、沙洲……）

const COAST_CTRL = [
  [-340, -96], [-250, -90], [-185, -84], [-130, -74], [-80, -67], [-35, -64], [5, -69], [40, -66], [68, -58],
  [88, -42], [99, -18], [104, 8], [111, 34], [126, 60], [150, 82], [190, 98], [260, 106], [340, 110]
];

export const AIRPORT = { x: -92, z: 64, yaw: -0.32, len: 50, wid: 15 };

const mangrove = mat('#4F9A62', { roughness: 0.85 });
const saltMat = mat('#FBFBF7', { roughness: 0.75 });
const runwayMat = mat('#727B85', { roughness: 0.9 });
const strawMat = mat('#D9B676', { roughness: 1 });
const houseWalls = ['#FFF4E4', '#FFE6D6', '#E6F5EE', '#FFF6D2', '#E8EEF9', '#FDF0F4'].map((c) => mat(c, { roughness: 0.9 }));
const houseRoofs = [MAT.roofRed, MAT.roofRed, MAT.roofBlue, MAT.roofGrey, mat('#E7A06E', { roughness: 0.75 })];

function sampleCoast() {
  const curve = new THREE.CatmullRomCurve3(COAST_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  return curve.getSpacedPoints(300).map((v) => [v.x, v.z]);
}

/** 沿海岸線往陸地內側平移 d（陸地永遠在行進方向左手邊） */
function offsetLine(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1];
    const L = Math.hypot(tx, tz) || 1;
    return [p[0] + (tz / L) * d, p[1] + (-tx / L) * d];
  });
}

function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}

function slab(pts, depth, bevel, bevelSize, segs = 3) {
  const g = new THREE.ExtrudeGeometry(polyShape(pts), {
    depth: Math.max(0.05, depth - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize, bevelSegments: segs, curveSegments: 4
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

function closeLand(line) {
  return [...line, [360, 120], [360, -360], [-360, -360], [-360, -100]];
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function buildCoast(ctx) {
  const rnd = rng('coast');
  const b = ctx.batch;
  const coast = sampleCoast();
  const shapes = [];

  // ---------- 本島 ----------
  const sandLine = offsetLine(coast, 1.6);
  b.add(slab(closeLand(sandLine), 3.3, 0.95, 1.6), ctx.S.sand, M(0, -2.45, 0), { cast: false });
  shapes.push({ type: 'poly', pts: closeLand(coast) });
  const grassLine = offsetLine(coast, 10.5);
  const grassPoly = closeLand(grassLine);
  b.add(slab(grassPoly, 1.1, 0.35, 0.6), ctx.S.grass2, M(0, 0.45, 0), { cast: false });
  const LAND_Y = 1.55;
  const onLand = (x, z, margin = 0) => pointInPoly(x, z, closeLand(offsetLine(coast, 10.5 + margin)));
  ctx.landTest = onLand;

  // 道路（與車道）
  const road = offsetLine(coast, 19);
  const roadVis = road.filter(([x, z]) => x > -240 && x < 240 && z > -200 && z < 130);
  b.add(ribbon(roadVis, 3.2, LAND_Y + 0.03), mat('#A9B1B8', { roughness: 0.95 }), null, { cast: false });
  for (let i = 0; i < roadVis.length - 1; i += 2) {
    const [x1, z1] = roadVis[i], [x2, z2] = roadVis[i + 1];
    b.add(G.box(0.18, 0.03, 1.5, 0), MAT.white, M((x1 + x2) / 2, LAND_Y + 0.055, (z1 + z2) / 2, 0, Math.atan2(x2 - x1, z2 - z1), 0), { cast: false });
  }
  ctx.roads.push(offsetLine(coast, 18.2).filter(([x, z]) => x > -240 && x < 240 && z < 130));
  ctx.roads.push(offsetLine(coast, 19.8).filter(([x, z]) => x > -240 && x < 240 && z < 130).reverse());

  // 防風林（木麻黃）與海灘椰子樹
  const windbreak = offsetLine(coast, 13.5);
  for (let i = 0; i < windbreak.length; i++) {
    const [x, z] = windbreak[i];
    if (Math.abs(x) > 230 || z < -190) continue;
    for (let k = 0; k < 2; k++) {
      const jx = x + (rnd() - 0.5) * 3, jz = z + (rnd() - 0.5) * 3;
      tree(ctx, jx, LAND_Y - 0.05, jz, 1.4 + rnd() * 0.5, rnd, 'cone');
    }
  }
  const beach = offsetLine(coast, 5.5);
  for (let i = 0; i < beach.length; i += 3) {
    const [x, z] = beach[i];
    if (Math.abs(x) > 220 || rnd() < 0.45) continue;
    palm(ctx, x + (rnd() - 0.5) * 2, 0.82, z + (rnd() - 0.5) * 2, 1.3 + rnd() * 0.4, rnd);
  }
  // 夏天的海灘傘
  const umbrella = [mat('#FF8A80', { roughness: 0.6 }), mat('#4FC3F7', { roughness: 0.6 }), mat('#FFD54F', { roughness: 0.6 })];
  for (let i = 40; i < 170; i += 7) {
    const [x, z] = offsetLine(coast, 4)[i];
    const um = umbrella[i % 3];
    ctx.seasonal.summer.add(G.cyl(0.03, 0.03, 1.6, 6), MAT.white, M(x, 0.82 + 0.8, z));
    ctx.seasonal.summer.add(G.cone(0.85, 0.42, 12), um, M(x, 0.82 + 1.75, z));
  }

  // 紅樹林（西側淺水）
  for (let i = 18; i < 70; i += 2) {
    const [x, z] = offsetLine(coast, -3 - rnd() * 5)[i];
    for (let k = 0; k < 3; k++) {
      const ox = x + (rnd() - 0.5) * 3, oz = z + (rnd() - 0.5) * 3;
      for (let r = 0; r < 3; r++) b.add(G.cyl(0.04, 0.06, 1.0, 5), MAT.trunk, M(ox + (rnd() - 0.5) * 0.6, 0.35, oz + (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6));
      const s = 0.8 + rnd() * 0.6;
      b.add(G.sph(1, 12, 9), mangrove, M(ox, 1.2 * s, oz, 0, 0, 0, 1.0 * s, 0.6 * s, 1.0 * s));
    }
  }

  // 魚塭與水車
  const coastZ = (x) => {
    let best = null;
    for (const [px, pz] of coast) if (!best || Math.abs(px - x) < Math.abs(best[0] - x)) best = [px, pz];
    return best[1];
  };
  for (let col = 0; col < 6; col++) {
    for (let row = 0; row < 3; row++) {
      const x = -158 + col * 19.5;
      const z = coastZ(x) - 33 - row * 13.5;
      if (!onLand(x - 9, z, 2) || !onLand(x + 9, z, 2)) continue;
      b.add(G.box(16.6, 0.12, 10.6, 0.05), MAT.pond, M(x, LAND_Y + 0.0, z), { cast: false });
      for (const [dx, dz, w, d] of [[0, -5.6, 17.8, 0.9], [0, 5.6, 17.8, 0.9], [-8.6, 0, 0.9, 11.6], [8.6, 0, 0.9, 11.6]]) {
        b.add(G.box(w, 0.4, d, 0.2), ctx.S.grass, M(x + dx, LAND_Y + 0.1, z + dz));
      }
      if ((col + row) % 2 === 0) ctx.aerators.push({ x: x + (rnd() - 0.5) * 6, y: LAND_Y + 0.02, z: z + (rnd() - 0.5) * 4, yaw: rnd() * Math.PI });
      ctx.birdSpots.push({ x: x + (rnd() - 0.5) * 14, y: LAND_Y + 0.3, z: z - 5.6, kind: 'dike' });
      if (rnd() < 0.6) ctx.birdSpots.push({ x: x + (rnd() - 0.5) * 10, y: LAND_Y + 0.05, z: z + (rnd() - 0.5) * 6, kind: 'pond' });
    }
  }

  // 漁村
  const village = [];
  for (let n = 0; n < 160 && village.length < 26; n++) {
    const x = -20 + rnd() * 105;
    const z = coastZ(Math.min(x, 60)) - 26 - rnd() * 34;
    if (!onLand(x, z, 4)) continue;
    if (village.some((v) => Math.hypot(v.x - x, v.z - z) < 5.2)) continue;
    village.push({ x, z });
    house(ctx, x, LAND_Y, z, rnd() * 0.5 - 0.25 + (rnd() < 0.5 ? 0 : Math.PI / 2), rnd);
  }
  for (let n = 0; n < 40; n++) {
    const x = -25 + rnd() * 115, z = coastZ(Math.min(x, 60)) - 24 - rnd() * 40;
    if (!onLand(x, z, 3) || village.some((v) => Math.hypot(v.x - x, v.z - z) < 3)) continue;
    tree(ctx, x, LAND_Y, z, 1.3 + rnd() * 0.5, rnd, rnd() < 0.7 ? 'round' : 'cone');
  }
  // 廟（鹿耳門的味道）
  shrine(ctx, 22, LAND_Y, coastZ(22) - 52, themeMats('#E8705E'));

  // 鹽山
  const sx = 150, sz = -20;
  b.add(G.cyl(13, 17, 2.4, 28), saltMat, M(sx, LAND_Y + 1.2, sz));
  b.add(G.cyl(8.5, 12.5, 3.4, 28), saltMat, M(sx, LAND_Y + 2.4 + 1.7, sz));
  b.add(G.cyl(4, 8, 3.0, 28), saltMat, M(sx, LAND_Y + 5.8 + 1.5, sz));
  b.add(G.sph(1, 24, 12), saltMat, M(sx, LAND_Y + 8.8, sz, 0, 0, 0, 4, 1.4, 4));
  for (let k = 0; k < 8; k++) b.add(G.box(1.6, 0.25, 0.9, 0.05), MAT.wood, M(sx - 1 - k * 1.55, LAND_Y + 9.0 - k * 1.05, sz + 1.2, 0, Math.PI / 2, 0));

  // 海岸風機
  const east = offsetLine(coast, 7);
  for (const targetZ of [-30, -6, 18, 42, 66]) {
    let best = east[0];
    for (const p of east) if (p[0] > 80 && Math.abs(p[1] - targetZ) < Math.abs(best[1] - targetZ)) best = p;
    ctx.turbines.push({ x: best[0], y: 0.9, z: best[1], s: 1.0, yaw: -Math.PI / 2 + 0.2 });
  }

  // 遠方丘陵與山
  for (let k = 0; k < 16; k++) {
    const x = -300 + k * 40 + (rnd() - 0.5) * 20;
    const z = -150 - rnd() * 60 - (x > 140 ? 0 : 0);
    if (!onLand(x, z, 20)) continue;
    const r = 30 + rnd() * 26;
    b.add(G.sph(1, 28, 16), ctx.S.far, M(x, LAND_Y - 2, z, 0, 0, 0, r, r * (0.28 + rnd() * 0.12), r * 0.8), { cast: false });
  }
  for (let k = 0; k < 7; k++) {
    const x = 210 + rnd() * 70, z = -100 + k * 34;
    const r = 22 + rnd() * 16;
    b.add(G.sph(1, 24, 14), ctx.S.far, M(x, LAND_Y - 2, z, 0, 0, 0, r, r * 0.35, r), { cast: false });
  }
  for (let k = 0; k < 9; k++) {
    const x = -330 + k * 80 + (rnd() - 0.5) * 30;
    const z = -270 - rnd() * 40;
    const r = 55 + rnd() * 30, h = 45 + rnd() * 35, rot = rnd() * 3;
    b.add(G.cone(1, 1, 9), ctx.S.mountain, M(x, h / 2 - 2, z, 0, rot, 0, r, h, r), { cast: false });
    ctx.seasonal.winter.add(G.cone(1, 1, 9), MAT.snow, M(x, h - 2 - h * 0.14, z, 0, rot, 0, r * 0.3, h * 0.3, r * 0.3), { cast: false });
  }

  // ---------- 小離島 ----------
  airport(ctx, shapes);
  lighthouseIslet(ctx, shapes, 74, 72);
  sandbar(ctx, shapes, -42, 100, 19, 7, 0.2, true);
  sandbar(ctx, shapes, -132, 6, 36, 4.6, 1.15, false);
  sandbar(ctx, shapes, 112, 132, 22, 5, -0.4, false);
  for (const [x, z, r] of [[42, 58, 2.6], [-66, 24, 2.2], [64, -46, 2.8], [-58, -46, 2.0], [-20, 128, 3.2], [150, 160, 2.6]]) rocks(ctx, shapes, x, z, r);
  fishCages(ctx, 54, 44);
  for (const [x, z] of [[-165, 132], [-195, 112], [-210, 148], [-178, 165], [-230, 125]]) {
    ctx.turbines.push({ x, y: 0, z, s: 1.15, yaw: -Math.PI / 2 + 0.2, foundation: true });
  }

  return { shapes, coast };
}

function ribbon(pts, width, y) {
  const pos = [];
  const half = width / 2;
  const side = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
    const tx = c[0] - a[0], tz = c[1] - a[1];
    const L = Math.hypot(tx, tz) || 1;
    return [tz / L, -tx / L];
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const [n1x, n1z] = side[i], [n2x, n2z] = side[i + 1];
    const A = [x1 + n1x * half, y, z1 + n1z * half], B = [x1 - n1x * half, y, z1 - n1z * half];
    const C = [x2 + n2x * half, y, z2 + n2z * half], D = [x2 - n2x * half, y, z2 - n2z * half];
    pos.push(...A, ...B, ...C, ...B, ...D, ...C);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // 確保法線朝上
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

function house(ctx, x, y, z, yaw, rnd) {
  const p = new Placer(ctx.batch, x, y, z, yaw);
  const w = 2.2 + rnd() * 1.2, d = 1.8 + rnd() * 0.6, h = 1.3 + rnd() * 0.5;
  p.box(w, h, d, houseWalls[Math.floor(rnd() * houseWalls.length)], 0, 0, 0, 0, 0.08);
  p.add(G.gable(d, 0.7 + rnd() * 0.3, w + 0.1, 0.16), houseRoofs[Math.floor(rnd() * houseRoofs.length)], 0, h, 0, 0, Math.PI / 2, 0);
  p.box(0.4, 0.7, 0.05, MAT.woodDark, w * 0.25, 0, d / 2, 0, 0.02);
  p.box(0.45, 0.35, 0.05, MAT.window, -w * 0.22, h * 0.45, d / 2, 0, 0.02);
  if (rnd() < 0.5) p.box(0.45, 0.35, 0.05, MAT.window, w * 0.05, h * 0.45, -d / 2, 0, 0.02);
}

function shrine(ctx, x, y, z, T) {
  const p = new Placer(ctx.batch, x, y, z, 0.05);
  p.box(9, 0.5, 6.5, MAT.stone, 0, 0, 0, 0, 0.08);
  p.box(7, 2.4, 4.2, MAT.cream, 0, 0.5, -0.4, 0, 0.06);
  for (const lx of [-2.7, -0.9, 0.9, 2.7]) p.cyl(0.22, 0.22, 2.4, MAT.red, lx, 0.5, 2.0, 12);
  p.box(8.4, 0.24, 5.6, T.main, 0, 2.9, -0.2, 0, 0.05);
  p.add(G.gable(4.8, 1.5, 7.6, 0.5), T.main, 0, 3.1, -0.3, 0, Math.PI / 2, 0);
  p.box(7.2, 0.24, 0.3, T.deep, 0, 4.55, -0.3, 0, 0.05);
  for (const s of [-1, 1]) p.add(G.cone(0.2, 1.1, 8), T.deep, s * 3.8, 4.85, -0.3, 0, 0, -s * 0.85);
  for (const lx of [-2.6, 2.6]) p.add(G.sph(1, 12, 10), MAT.lantern, lx, 2.4, 2.25, 0, 0, 0, 0.3, 0.38, 0.3, { cast: false });
}

function islandSlab(ctx, shapes, pts, top, sandMat, grassInset, grassMat) {
  ctx.batch.add(slab(pts, top + 2.5, 0.45, 0.45), sandMat, M(0, -2.5, 0));
  shapes.push({ type: 'poly', pts });
  if (grassInset != null) {
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    const inner = pts.map(([x, z]) => {
      const dx = x - c[0], dz = z - c[1];
      const L = Math.hypot(dx, dz) || 1;
      return [x - (dx / L) * grassInset, z - (dz / L) * grassInset];
    });
    ctx.batch.add(slab(inner, 0.5, 0.2, 0.25), grassMat, M(0, top - 0.35, 0));
  }
}

function roundedRectPts(cx, cz, len, wid, yaw, r, n = 8) {
  const pts = [];
  const hl = len / 2 - r, hw = wid / 2 - r;
  const corners = [[hl, hw, 0], [-hl, hw, Math.PI / 2], [-hl, -hw, Math.PI], [hl, -hw, Math.PI * 1.5]];
  for (const [ox, oz, a0] of corners) {
    for (let k = 0; k <= n; k++) {
      const a = a0 + (k / n) * (Math.PI / 2);
      pts.push([ox + Math.cos(a) * r, oz + Math.sin(a) * r]);
    }
  }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return pts.map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
}

function airport(ctx, shapes) {
  const A = AIRPORT;
  const pts = roundedRectPts(A.x, A.z, A.len, A.wid, A.yaw, 5.5);
  islandSlab(ctx, shapes, pts, 1.1, ctx.S.sand, 1.4, ctx.S.grass);
  const top = 1.1 + 0.15;
  // Placer 的 yaw 定義：local +x 對應世界 (cos yaw', -sin yaw')；這裡讓 local +x 沿跑道
  const p = new Placer(ctx.batch, A.x, top, A.z, -A.yaw);
  p.box(44, 0.06, 3.8, runwayMat, 0, 0, -1.8, 0, 0.02);
  for (let k = -9; k <= 9; k++) p.box(1.4, 0.02, 0.16, MAT.white, k * 2.3, 0.06, -1.8, 0, 0);
  for (const end of [-20.5, 20.5]) for (let k = -3; k <= 3; k++) p.box(1.6, 0.02, 0.22, MAT.white, end, 0.06, -1.8 + k * 0.45, 0, 0);
  // 航廈、塔台
  const T = themeMats('#3CC1C7');
  p.box(9, 1.6, 3.0, MAT.wall, -6, 0, 4.2, 0, 0.12);
  p.box(8.4, 1.0, 0.06, MAT.window, -6, 0.3, 2.68, 0, 0.02);
  p.add(G.box(9.6, 0.25, 3.6, 0.12), T.main, -6, 1.75, 4.1, 0.05, 0, 0);
  p.cyl(0.55, 0.7, 4.2, MAT.wall, 3, 0, 4.6, 18);
  p.cyl(1.0, 0.8, 0.9, MAT.window, 3, 4.2, 4.6, 18);
  p.cyl(1.1, 1.1, 0.15, T.main, 3, 5.1, 4.6, 18);
  p.add(G.cone(0.3, 0.6, 12), T.main, 3, 5.55, 4.6);
  p.add(G.sph(0.12, 10, 8), MAT.lantern, 3, 5.95, 4.6, 0, 0, 0, 1, 1, 1, { cast: false });
  // 機庫
  p.add(G.shape('hangar', () => { const g = new THREE.CylinderGeometry(2.2, 2.2, 5, 24, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); return g; }), MAT.metal, 11, 0, 4.2);
  // 風向袋
  p.cyl(0.05, 0.05, 2.2, MAT.wall, 15, 0, 1.8, 6);
  p.add(G.cone(0.22, 1.0, 10), mat('#FF8A3D', { roughness: 0.6 }), 15.45, 2.1, 1.8, 0, 0, Math.PI / 2);
  for (const [lx, lz] of [[-21, 4.6], [20.5, 4.4], [19, -5.6], [-19, -5.6], [-3, -5.8]]) {
    const [px, pz] = p.world(lx, lz);
    palm(ctx, px, top, pz, 1.2, rng('ap' + lx));
  }
  // 停機坪上的飛機
  const parked = makePlane(T.main);
  const [wx, wz] = p.world(-15, 3.2);
  parked.position.set(wx, top + 0.72, wz);
  parked.rotation.y = -A.yaw + Math.PI * 0.75;
  parked.scale.setScalar(0.85);
  ctx.root.add(parked);
  ctx.airport = { ...A, top, runwayLocalZ: -1.8 };
}

function lighthouseIslet(ctx, shapes, x, z) {
  const pts = [];
  const rnd = rng('lh');
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const r = 7 + (rnd() - 0.5) * 1.6;
    pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]);
  }
  islandSlab(ctx, shapes, pts, 1.3, MAT.rock, 1.6, ctx.S.grass);
  for (let k = 0; k < 9; k++) {
    const a = rnd() * Math.PI * 2, r = 5.5 + rnd() * 2.2;
    const s = 0.8 + rnd() * 1.1;
    ctx.batch.add(G.ico(1, 1), k % 2 ? MAT.rock : MAT.rockDark, M(x + Math.cos(a) * r, 0.4, z + Math.sin(a) * r, rnd(), rnd(), rnd(), s, s * 0.7, s));
  }
  const p = new Placer(ctx.batch, x, 1.45, z, 0);
  p.cyl(1.3, 1.5, 0.5, MAT.stone, 0, 0, 0, 20);
  p.cyl(0.7, 1.05, 6.4, MAT.white, 0, 0.5, 0, 22);
  for (const y0 of [1.4, 3.4, 5.4]) {
    const r0 = 1.05 - (0.35 * (y0 - 0.5)) / 6.4;
    p.cyl(r0 - 0.044 + 0.04, r0 + 0.04, 0.8, MAT.red, 0, y0, 0, 22);
  }
  p.cyl(1.0, 1.0, 0.12, MAT.dark, 0, 6.9, 0, 22);
  p.cyl(0.55, 0.55, 0.8, MAT.beacon, 0, 7.0, 0, 18, { cast: false });
  p.add(G.cone(0.75, 0.8, 18), MAT.red, 0, 8.2, 0);
  p.box(2.0, 1.2, 1.6, MAT.wall, 2.6, 0, 1.2, 0.3, 0.08);
  p.add(G.gable(1.6, 0.7, 2.1, 0.12), MAT.roofRed, 2.6, 1.2, 1.2, 0, 0.3 + Math.PI / 2, 0);
  for (let k = 0; k < 3; k++) tree(ctx, x - 3 + k * 1.4, 1.45, z - 2.5 + (k % 2), 1.0, rnd, 'cone');
  ctx.lighthouse = new THREE.Vector3(x, 1.45 + 7.4, z);
}

function sandbar(ctx, shapes, x, z, len, wid, yaw, inhabited) {
  const rnd = rng('sb' + x);
  const pts = [];
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const r = 1 + (rnd() - 0.5) * 0.08;
    const lx = Math.cos(a) * len / 2 * r, lz = Math.sin(a) * wid / 2 * r;
    pts.push([x + lx * Math.cos(yaw) - lz * Math.sin(yaw), z + lx * Math.sin(yaw) + lz * Math.cos(yaw)]);
  }
  ctx.batch.add(slab(pts, 2.95, 0.6, 1.0), ctx.S.sand, M(0, -2.5, 0), { cast: false });
  shapes.push({ type: 'poly', pts });
  const along = (t, side = 0) => [x + Math.cos(yaw) * t * len / 2 - Math.sin(yaw) * side, z + Math.sin(yaw) * t * len / 2 + Math.cos(yaw) * side];
  if (inhabited) {
    for (const t of [-0.6, -0.25, 0.3, 0.65]) {
      const [px, pz] = along(t, (rnd() - 0.5) * 2);
      palm(ctx, px, 0.42, pz, 1.2 + rnd() * 0.3, rnd);
    }
    const [hx, hz] = along(0.05, -0.6);
    const p = new Placer(ctx.batch, hx, 0.42, hz, -yaw);
    for (const [ox, oz] of [[-0.9, -0.7], [0.9, -0.7], [-0.9, 0.7], [0.9, 0.7]]) p.cyl(0.07, 0.07, 1.5, MAT.wood, ox, 0, oz, 6);
    p.box(2.2, 0.1, 1.8, MAT.wood, 0, 0.3, 0, 0, 0.02);
    p.add(G.cone(1.75, 1.0, 4), strawMat, 0, 2.0, 0, 0, Math.PI / 4, 0);
    const [kx, kz] = along(0.45, 1.5);
    ctx.batch.add(G.box(0.5, 0.25, 2.4, 0.12), mat('#FF8A65', { roughness: 0.5 }), M(kx, 0.55, kz, 0, -yaw + 0.8, 0));
    for (const t of [-0.4, 0.2]) {
      const [ux, uz] = along(t, 1.2);
      ctx.seasonal.summer.add(G.cyl(0.03, 0.03, 1.5, 6), MAT.white, M(ux, 0.42 + 0.75, uz));
      ctx.seasonal.summer.add(G.cone(0.8, 0.38, 12), t < 0 ? MAT.red : MAT.yellow, M(ux, 0.42 + 1.62, uz));
    }
  }
  for (let k = 0; k < (inhabited ? 2 : 6); k++) {
    const [bx, bz] = along(rnd() * 1.4 - 0.7, (rnd() - 0.5) * wid * 0.4);
    ctx.birdSpots.push({ x: bx, y: 0.42, z: bz, kind: 'sand' });
  }
}

function rocks(ctx, shapes, x, z, r) {
  const rnd = rng('rk' + x + z);
  for (let k = 0; k < 4; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.6;
    const s = r * (0.45 + rnd() * 0.4);
    ctx.batch.add(G.ico(1, 1), k % 2 ? MAT.rock : MAT.rockDark, M(x + Math.cos(a) * d, s * 0.25, z + Math.sin(a) * d, rnd(), rnd() * 3, rnd(), s, s * 0.8, s));
  }
  shapes.push({ type: 'circle', x, z, r: r * 0.9 });
  if (rnd() < 0.6) ctx.birdSpots.push({ x, y: r * 0.75, z, kind: 'rock' });
}

function fishCages(ctx, x, z) {
  const ring = mat('#F5F7FA', { roughness: 0.5 });
  const net = new THREE.MeshStandardMaterial({ color: '#2F6F7A', roughness: 0.9, transparent: true, opacity: 0.55 });
  for (let k = 0; k < 4; k++) {
    const cx = x + (k % 2) * 6.2, cz = z + Math.floor(k / 2) * 6.2;
    ctx.batch.add(G.torus(2.3, 0.12, 8, 36), ring, M(cx, 0.15, cz, Math.PI / 2, 0, 0));
    ctx.batch.add(G.cyl(2.25, 2.25, 0.25, 30, true), net, M(cx, 0.05, cz), { cast: false });
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2;
      ctx.batch.add(G.sph(0.18, 10, 8), b % 2 ? MAT.red : MAT.yellow, M(cx + Math.cos(a) * 2.3, 0.3, cz + Math.sin(a) * 2.3));
    }
  }
  ctx.batch.add(G.box(0.6, 0.1, 12.4, 0.02), MAT.wood, M(x + 3.1, 0.2, z + 3.1));
  ctx.batch.add(G.box(12.4, 0.1, 0.6, 0.02), MAT.wood, M(x + 3.1, 0.2, z + 3.1));
}
