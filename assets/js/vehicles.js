import * as THREE from 'three';
import { M, mat } from './util.js';
import { G, MAT } from './kit.js';

// 船、飛機、汽車、風機、水車（靜態可進合併批次；動態回傳 Group）

const hullCache = new Map();
function hullGeom(w, L, h) {
  const key = `${w},${L},${h}`;
  if (hullCache.has(key)) return hullCache.get(key);
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -L / 2);
  s.lineTo(w / 2, -L / 2);
  s.lineTo(w / 2, L * 0.12);
  s.quadraticCurveTo(w / 2, L * 0.36, 0, L / 2);
  s.quadraticCurveTo(-w / 2, L * 0.36, -w / 2, L * 0.12);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(Math.PI / 2); // shape y → +z（船頭朝 +z），厚度往下
  g.translate(0, h, 0);
  hullCache.set(key, g);
  return g;
}

const sailGeom = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0, 2.3);
  s.quadraticCurveTo(0.7, 0.9, 1.25, 0);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateY(-Math.PI / 2); // 帆面在 yz 平面
  return g;
})();
const sailMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.7, side: THREE.DoubleSide });

/** 靜態漁船（進批次） */
export function addBoat(batch, x, y, z, yaw, colorMat, s = 1) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const P = (lx, ly, lz) => [x + (lx * c + lz * sn) * s, y + ly * s, z + (-lx * sn + lz * c) * s];
  let p = P(0, 0, 0);
  batch.add(hullGeom(1.0, 2.6, 0.32), colorMat, M(p[0], p[1], p[2], 0, yaw, 0, s));
  p = P(0, 0.32, 0);
  batch.add(hullGeom(0.98, 2.56, 0.18), MAT.white, M(p[0], p[1], p[2], 0, yaw, 0, s));
  p = P(0, 0.62, -0.45);
  batch.add(G.box(0.7, 0.5, 0.75, 0.06), MAT.white, M(p[0], p[1], p[2], 0, yaw, 0, s));
  p = P(0, 0.7, -0.07);
  batch.add(G.box(0.6, 0.16, 0.03, 0.01), MAT.window, M(p[0], p[1], p[2], 0, yaw, 0, s));
  p = P(0, 1.2, -0.3);
  batch.add(G.cyl(0.025, 0.03, 1.2, 6), MAT.dark, M(p[0], p[1], p[2], 0, yaw, 0, s));
}

/** 動態船隻 */
export function makeBoat(colorMat, kind = 'fishing') {
  const g = new THREE.Group();
  const add = (geom, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geom, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  add(hullGeom(1.0, 2.6, 0.32), colorMat, 0, 0, 0);
  add(hullGeom(0.98, 2.56, 0.18), MAT.white, 0, 0.32, 0);
  if (kind === 'sail') {
    add(G.cyl(0.03, 0.035, 2.6, 6), MAT.metal, 0, 1.75, 0.15);
    add(sailGeom, sailMat, 0, 0.6, 0.12);
    add(G.cyl(0.02, 0.02, 1.2, 6), MAT.metal, 0, 0.62, -0.45, Math.PI / 2, 0, 0);
  } else {
    add(G.box(0.7, 0.5, 0.75, 0.06), MAT.white, 0, 0.62, -0.45);
    add(G.box(0.6, 0.16, 0.03, 0.01), MAT.window, 0, 0.7, -0.07);
    add(G.cyl(0.025, 0.03, 1.2, 6), MAT.dark, 0, 1.2, -0.3);
    add(G.box(0.3, 0.2, 0.02, 0.01), colorMat, 0.16, 1.68, -0.3);
  }
  return g;
}

// ---------- 飛機 ----------
const planeWhite = mat('#FAFCFF', { roughness: 0.35, metalness: 0.15 });
const planeGrey = mat('#C9D2DC', { roughness: 0.4, metalness: 0.4 });

function wingGeom(span, root, tip, sweep, thick) {
  const s = new THREE.Shape();
  s.moveTo(0, root / 2);
  s.lineTo(span, root / 2 - sweep);
  s.lineTo(span, root / 2 - sweep - tip);
  s.lineTo(0, -root / 2);
  s.lineTo(-span, root / 2 - sweep - tip);
  s.lineTo(-span, root / 2 - sweep);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, thick / 2, 0);
  return g;
}

function finGeom() {
  const s = new THREE.Shape();
  s.moveTo(-1.95, 0.15);
  s.lineTo(-1.1, 0.15);
  s.lineTo(-1.55, 1.25);
  s.lineTo(-1.95, 1.25);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(0.035, 0, 0);
  return g;
}

export function makePlane(accentMat) {
  const g = new THREE.Group();
  const add = (geom, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geom, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const body = new THREE.CapsuleGeometry(0.4, 3.1, 8, 18);
  body.rotateX(Math.PI / 2);
  add(body, planeWhite, 0, 0, 0);
  add(G.box(0.03, 0.12, 2.2, 0.01), MAT.dark, 0.39, 0.1, 0.25);
  add(G.box(0.03, 0.12, 2.2, 0.01), MAT.dark, -0.39, 0.1, 0.25);
  add(G.box(0.04, 0.08, 3.2, 0.01), accentMat, 0.385, -0.08, -0.1);
  add(G.box(0.04, 0.08, 3.2, 0.01), accentMat, -0.385, -0.08, -0.1);
  add(G.box(0.36, 0.16, 0.06, 0.02), MAT.dark, 0, 0.18, 1.78, -0.6, 0, 0);
  add(wingGeom(2.5, 1.15, 0.42, 0.75, 0.08), planeWhite, 0, -0.12, 0.15);
  add(wingGeom(1.05, 0.55, 0.25, 0.32, 0.05), planeWhite, 0, 0.12, -1.75);
  add(finGeom(), accentMat, 0, 0.1, 0);
  for (const s of [-1, 1]) {
    const eng = new THREE.CylinderGeometry(0.17, 0.15, 0.7, 14);
    eng.rotateX(Math.PI / 2);
    add(eng, planeGrey, s * 1.0, -0.36, 0.35);
    add(G.cyl(0.13, 0.13, 0.02, 14), accentMat, s * 1.0, -0.36, 0.71, Math.PI / 2, 0, 0);
  }
  // 起落架
  const gear = new THREE.Group();
  for (const [x, z] of [[0, 1.3], [-0.45, -0.1], [0.45, -0.1]]) {
    const leg = new THREE.Mesh(G.cyl(0.03, 0.03, 0.35, 6), MAT.dark);
    leg.position.set(x, -0.52, z);
    const wheel = new THREE.Mesh(G.cyl(0.09, 0.09, 0.07, 12), MAT.dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.7, z);
    gear.add(leg, wheel);
  }
  g.add(gear);
  g.userData.gear = gear;
  // 航行燈
  const navR = new THREE.Mesh(G.sph(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#ff5a5a', emissive: '#ff3b3b', emissiveIntensity: 2 }));
  navR.position.set(-2.5, -0.08, -0.6);
  const navG = new THREE.Mesh(G.sph(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#5aff8a', emissive: '#3bff6b', emissiveIntensity: 2 }));
  navG.position.set(2.5, -0.08, -0.6);
  g.add(navR, navG);
  return g;
}

// ---------- 小汽車 ----------
const carCols = ['#FF8A80', '#80CBC4', '#FFD180', '#90CAF9', '#F8BBD0', '#FFFFFF'].map((c) => mat(c, { roughness: 0.4, metalness: 0.1 }));
export function makeCar(i = 0) {
  const g = new THREE.Group();
  const add = (geom, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geom, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    g.add(mesh);
  };
  const body = carCols[i % carCols.length];
  add(G.box(0.8, 0.36, 1.6, 0.12), body, 0, 0.32, 0);
  add(G.box(0.7, 0.3, 0.85, 0.1), MAT.window, 0, 0.6, -0.1);
  add(G.box(0.72, 0.06, 0.8, 0.03), body, 0, 0.77, -0.1);
  for (const [x, z] of [[-0.4, 0.5], [0.4, 0.5], [-0.4, -0.5], [0.4, -0.5]]) add(G.cyl(0.15, 0.15, 0.12, 12), MAT.dark, x, 0.15, z, 0, 0, Math.PI / 2);
  return g;
}

// ---------- 風力發電機 ----------
const bladeGeom = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.12, 0);
  s.quadraticCurveTo(-0.22, 1.2, -0.05, 4.2);
  s.lineTo(0.04, 4.2);
  s.quadraticCurveTo(0.14, 1.0, 0.12, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  g.translate(0, 0.25, -0.025);
  return g;
})();
const turbineMat = mat('#F7F9FB', { roughness: 0.45 });

export function makeTurbine(scale = 1, foundation = false) {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(G.cyl(0.13, 0.24, 9, 16), turbineMat);
  tower.position.y = 4.5;
  tower.castShadow = true;
  g.add(tower);
  if (foundation) {
    const f = new THREE.Mesh(G.cyl(0.38, 0.42, 2.2, 16), mat('#F2C94C', { roughness: 0.6 }));
    f.position.y = -0.4;
    g.add(f);
  }
  const nacelle = new THREE.Mesh(G.box(0.45, 0.45, 1.1, 0.12), turbineMat);
  nacelle.position.set(0, 9.1, -0.2);
  nacelle.castShadow = true;
  g.add(nacelle);
  const rotor = new THREE.Group();
  rotor.position.set(0, 9.1, 0.45);
  const hub = new THREE.Mesh(G.sph(0.22, 14, 10), turbineMat);
  hub.scale.z = 1.4;
  rotor.add(hub);
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Mesh(bladeGeom, turbineMat);
    b.rotation.z = (k * Math.PI * 2) / 3;
    b.castShadow = true;
    rotor.add(b);
  }
  g.add(rotor);
  g.scale.setScalar(scale);
  g.userData.rotor = rotor;
  return g;
}

// ---------- 魚塭水車 ----------
const floatMat = mat('#4FC3F7', { roughness: 0.5 });
const wheelMat = mat('#FFD54F', { roughness: 0.5 });
export function makeAerator() {
  const g = new THREE.Group();
  for (const s of [-0.5, 0.5]) {
    const f = new THREE.Mesh(G.cyl(0.14, 0.14, 1.2, 10), floatMat);
    f.rotation.x = Math.PI / 2;
    f.position.set(s, 0.05, 0);
    g.add(f);
  }
  const motor = new THREE.Mesh(G.box(0.4, 0.3, 0.4, 0.06), MAT.white);
  motor.position.set(0, 0.3, 0);
  g.add(motor);
  const wheel = new THREE.Group();
  wheel.position.set(0, 0.2, 0.75);
  const hub = new THREE.Mesh(G.cyl(0.05, 0.05, 1.1, 8), MAT.metal);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  for (let k = 0; k < 8; k++) {
    const pad = new THREE.Mesh(G.box(0.9, 0.16, 0.04, 0.01), wheelMat);
    const a = (k / 8) * Math.PI * 2;
    pad.position.set(0, Math.cos(a) * 0.32, Math.sin(a) * 0.32);
    pad.rotation.x = -a;
    wheel.add(pad);
  }
  g.add(wheel);
  g.userData.wheel = wheel;
  return g;
}
