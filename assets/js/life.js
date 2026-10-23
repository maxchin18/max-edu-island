import * as THREE from 'three';
import { rng, emojiTexture, labelTexture, softDotTexture, clamp } from './util.js';
import { G, MAT } from './kit.js';
import { makeBoat, makePlane, makeCar, makeTurbine, makeAerator } from './vehicles.js';
import { WALK_Y } from './terrain.js';

// 會動的一切：小人、鳥、雲、季節粒子、船、飛機、車、風機

// ======================= 小人 =======================
const skinMats = ['#F6D5BC', '#EBC09E', '#D9A880', '#F3CDB0'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
const hairMats = ['#3A2E2A', '#5B4033', '#1F1B1A', '#8A6A4F', '#D9D3CC'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
const pantsMat = new THREE.MeshStandardMaterial({ color: '#4F5D75', roughness: 0.8 });
const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.3, 4, 12);
const legGeo = new THREE.CapsuleGeometry(0.075, 0.26, 3, 8);
legGeo.translate(0, -0.2, 0);
const headGeo = new THREE.SphereGeometry(0.18, 18, 14);
const hairGeo = new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
const hitGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.6, 8);
const ringGeo = new THREE.RingGeometry(0.42, 0.55, 28);
ringGeo.rotateX(-Math.PI / 2);

export class Walkers {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'walkers';
    this.list = [];
    this.hits = [];
    this.typeMats = new Map();
    this.showTags = false;
    this.showItems = true;
    this.focusType = null;
    this.rnd = rng('walkers');
  }

  build(data, info) {
    this.data = data;
    this.info = info;
    this.links = (data.links || []).filter((l) => info.has(l.from) && (l.to || []).some((t) => info.has(t)));
    this.graph = new Map([...info.values()].map((it) => [it.id, it.neighbors.map((n) => n.id)]));
    const ids = [...info.keys()];
    for (const type of data.personTypes || []) {
      const m = new THREE.MeshStandardMaterial({ color: type.color || '#999', roughness: 0.7, transparent: true, opacity: 1 });
      this.typeMats.set(type.id, m);
      const n = clamp(Math.round(+type.count || 0), 0, 40);
      for (let i = 0; i < n; i++) {
        const homes = (type.homes || []).filter((h) => info.has(h));
        const start = homes.length ? homes[i % homes.length] : ids[Math.floor(this.rnd() * ids.length)];
        if (!start) continue;
        this.list.push(this.makeWalker(type, m, start, i));
      }
    }
    this.world.root.add(this.group);
  }

  makeWalker(type, bodyMat, islandId, i) {
    const r = this.rnd;
    const g = new THREE.Group();
    const legs = [];
    for (const s of [-0.09, 0.09]) {
      const leg = new THREE.Mesh(legGeo, pantsMat);
      leg.position.set(s, 0.42, 0);
      leg.castShadow = true;
      g.add(leg);
      legs.push(leg);
    }
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.66;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(headGeo, skinMats[Math.floor(r() * skinMats.length)]);
    head.position.y = 1.08;
    head.castShadow = true;
    g.add(head);
    const hair = new THREE.Mesh(hairGeo, hairMats[Math.floor(r() * hairMats.length)]);
    hair.position.set(0, 1.1, -0.015);
    hair.rotation.x = -0.25;
    g.add(hair);
    const itemMat = new THREE.SpriteMaterial({ map: emojiTexture('📦'), depthWrite: false });
    const item = new THREE.Sprite(itemMat);
    item.position.y = 1.72;
    item.scale.set(0.72, 0.72, 1);
    item.renderOrder = 5;
    g.add(item);
    const { tex, aspect } = labelTexture(type.name, type.color);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }));
    tag.scale.set(0.42 * aspect, 0.42, 1);
    tag.position.y = 2.3;
    tag.visible = false;
    tag.renderOrder = 6;
    g.add(tag);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.position.y = 0.04;
    ring.visible = false;
    g.add(ring);
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.8;
    g.add(hit);
    g.scale.setScalar(1.12);
    this.group.add(g);
    const w = {
      id: `${type.id}-${i}`, type, group: g, body, legs, item, tag, ring, hit,
      island: islandId, path: [], seg: 0, segT: 0, speed: 1.9 + r() * 0.8, phase: r() * 10,
      state: 'pause', wait: r() * 4, carry: null, link: null, dest: null, lane: (r() - 0.5) * 0.7
    };
    hit.userData.walker = w;
    this.hits.push(hit);
    const it = this.info.get(islandId);
    const p = this.plazaPoint(it);
    g.position.copy(p);
    return w;
  }

  plazaPoint(it) {
    const a = this.rnd() * Math.PI * 2, rr = 0.6 + this.rnd() * 1.8;
    return new THREE.Vector3(it.x + Math.cos(a) * rr, WALK_Y, it.z + Math.sin(a) * rr);
  }

  route(fromId, toId) {
    if (fromId === toId) return [fromId];
    const prev = new Map([[fromId, null]]);
    const q = [fromId];
    while (q.length) {
      const cur = q.shift();
      if (cur === toId) break;
      for (const nb of this.graph.get(cur) || []) if (!prev.has(nb)) { prev.set(nb, cur); q.push(nb); }
    }
    if (!prev.has(toId)) return null;
    const out = [];
    for (let c = toId; c; c = prev.get(c)) out.unshift(c);
    return out;
  }

  planTrip(w) {
    const homes = (w.type.homes || []).filter((h) => this.info.has(h));
    let cands = this.links.filter((l) => l.from === w.island || (l.to || []).includes(w.island));
    if (homes.length && this.rnd() < 0.6) {
      const pref = cands.filter((l) => homes.includes(l.from) || l.to.some((t) => homes.includes(t)));
      if (pref.length) cands = pref;
    }
    let link, dest;
    if (cands.length) {
      link = cands[Math.floor(this.rnd() * cands.length)];
      if (link.from === w.island) {
        const tos = link.to.filter((t) => this.info.has(t));
        dest = tos[Math.floor(this.rnd() * tos.length)];
      } else dest = link.from;
    } else if (this.links.length) {
      link = this.links[Math.floor(this.rnd() * this.links.length)];
      dest = link.from;
    } else {
      const ids = [...this.info.keys()];
      dest = ids[Math.floor(this.rnd() * ids.length)];
    }
    const hops = this.route(w.island, dest) || [w.island, dest];
    const pts = [w.group.position.clone()];
    for (let i = 0; i < hops.length - 1; i++) {
      const A = this.info.get(hops[i]), B = this.info.get(hops[i + 1]);
      const u = new THREE.Vector2(B.x - A.x, B.z - A.z).normalize();
      const nx = -u.y * w.lane, nz = u.x * w.lane;
      const adj = A.neighbors.some((n) => n.id === B.id);
      if (adj) {
        pts.push(new THREE.Vector3(A.x + u.x * 2.4 + nx, WALK_Y, A.z + u.y * 2.4 + nz));
        pts.push(new THREE.Vector3(A.x + u.x * 7.6 + nx, WALK_Y + 0.05, A.z + u.y * 7.6 + nz));
        pts.push(new THREE.Vector3(B.x - u.x * 7.6 + nx, WALK_Y + 0.05, B.z - u.y * 7.6 + nz));
        pts.push(new THREE.Vector3(B.x - u.x * 2.4 + nx, WALK_Y, B.z - u.y * 2.4 + nz));
      } else {
        pts.push(new THREE.Vector3(B.x - u.x * 2.4, WALK_Y, B.z - u.y * 2.4));
      }
    }
    pts.push(this.plazaPoint(this.info.get(dest)));
    w.path = pts;
    w.seg = 0;
    w.segT = 0;
    w.link = link || null;
    w.dest = dest;
    const carry = w.type.carry && w.type.carry.length ? w.type.carry[Math.floor(this.rnd() * w.type.carry.length)] : { emoji: '📦', name: '物資' };
    w.carry = carry;
    w.item.material.map = emojiTexture(carry.emoji || '📦');
    w.item.material.needsUpdate = true;
    w.state = 'walk';
    this.world.emit('log', { kind: 'depart', walker: w, from: w.island, to: dest, link: w.link, carry });
  }

  update(dt, t) {
    for (const w of this.list) {
      if (w.state === 'pause') {
        w.wait -= dt;
        w.legs[0].rotation.x = w.legs[1].rotation.x = 0;
        if (w.wait <= 0) this.planTrip(w);
        continue;
      }
      let move = w.speed * dt;
      while (move > 0 && w.seg < w.path.length - 1) {
        const a = w.path[w.seg], b = w.path[w.seg + 1];
        const len = a.distanceTo(b) || 0.0001;
        const remain = len * (1 - w.segT);
        if (move < remain) { w.segT += move / len; move = 0; }
        else { move -= remain; w.seg++; w.segT = 0; }
      }
      if (w.seg >= w.path.length - 1) {
        w.group.position.copy(w.path[w.path.length - 1]);
        w.state = 'pause';
        w.wait = 1.5 + this.rnd() * 3.5;
        const from = w.island;
        w.island = w.dest;
        this.world.emit('log', { kind: this.rnd() < 0.45 ? 'handoff' : 'arrive', walker: w, from, to: w.dest, link: w.link, carry: w.carry });
        continue;
      }
      const a = w.path[w.seg], b = w.path[w.seg + 1];
      w.group.position.lerpVectors(a, b, w.segT);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      let d = yaw - w.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      w.group.rotation.y += d * Math.min(1, dt * 10);
      w.phase += dt * w.speed * 5.2;
      const sw = Math.sin(w.phase) * 0.55;
      w.legs[0].rotation.x = sw;
      w.legs[1].rotation.x = -sw;
      w.body.position.y = 0.66 + Math.abs(Math.cos(w.phase)) * 0.035;
    }
  }

  setTags(on) { this.showTags = on; this.applyVisibility(); }
  setItems(on) { this.showItems = on; this.applyVisibility(); }
  setFocusType(id) { this.focusType = id; this.applyVisibility(); }

  applyVisibility() {
    for (const [id, m] of this.typeMats) m.opacity = !this.focusType || this.focusType === id ? 1 : 0.18;
    for (const w of this.list) {
      const focus = this.focusType === w.type.id;
      const dim = this.focusType && !focus;
      w.tag.visible = (this.showTags && !dim) || focus;
      w.item.visible = this.showItems && !dim;
      w.ring.visible = focus;
      w.legs.forEach((l) => (l.visible = !dim));
    }
  }

  countOnRoad(typeId) {
    return this.list.filter((w) => (!typeId || w.type.id === typeId) && w.state === 'walk').length;
  }
}

// ======================= 鳥 =======================
const gullWhite = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.6, side: THREE.DoubleSide });
const gullGrey = new THREE.MeshStandardMaterial({ color: '#AEB8C4', roughness: 0.6, side: THREE.DoubleSide });
const gullTip = new THREE.MeshStandardMaterial({ color: '#3D4652', roughness: 0.6, side: THREE.DoubleSide });
const beakYellow = new THREE.MeshStandardMaterial({ color: '#F4C542', roughness: 0.5 });
const beakBlack = new THREE.MeshStandardMaterial({ color: '#22262B', roughness: 0.5 });

function wingShapes() {
  const inner = new THREE.Shape();
  inner.moveTo(0, 0.2); inner.lineTo(0.8, 0.12); inner.lineTo(0.8, -0.12); inner.lineTo(0, -0.2); inner.closePath();
  const tip = new THREE.Shape();
  tip.moveTo(0.78, 0.12); tip.quadraticCurveTo(1.15, 0.06, 1.38, -0.08); tip.lineTo(1.1, -0.14); tip.lineTo(0.78, -0.12); tip.closePath();
  const gi = new THREE.ShapeGeometry(inner); gi.rotateX(-Math.PI / 2);
  const gt = new THREE.ShapeGeometry(tip, 6); gt.rotateX(-Math.PI / 2);
  return [gi, gt];
}
const [wingInner, wingTip] = wingShapes();

function makeGull() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 4, 10), gullWhite);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const head = new THREE.Mesh(G.sph(0.12, 12, 10), gullWhite);
  head.position.set(0, 0.06, 0.34);
  g.add(head);
  const beak = new THREE.Mesh(G.cone(0.035, 0.16, 6), beakYellow);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.04, 0.5);
  g.add(beak);
  const tail = new THREE.Mesh(G.box(0.22, 0.03, 0.2, 0.01), gullWhite);
  tail.position.set(0, 0.02, -0.36);
  g.add(tail);
  const wings = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.08, 0.05, 0.02);
    const wi = new THREE.Mesh(wingInner, gullGrey);
    const wt = new THREE.Mesh(wingTip, gullTip);
    const holder = new THREE.Group();
    holder.add(wi, wt);
    holder.scale.x = s;
    pivot.add(holder);
    g.add(pivot);
    wings.push({ pivot, s });
  }
  g.userData.wings = wings;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Birds {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.flocks = [];
    this.standing = [];
    this.rnd = rng('birds');
  }

  build(spots) {
    const routes = [
      { cx: 0, cz: 5, rx: 70, rz: 48, y: 24, speed: 0.07, n: 7 },
      { cx: -60, cz: 60, rx: 55, rz: 35, y: 18, speed: -0.09, n: 6 },
      { cx: 70, cz: -40, rx: 60, rz: 30, y: 28, speed: 0.06, n: 8 },
      { cx: -20, cz: -70, rx: 90, rz: 25, y: 32, speed: -0.05, n: 5 }
    ];
    for (const r of routes) {
      const birds = [];
      for (let i = 0; i < r.n; i++) {
        const b = makeGull();
        b.scale.setScalar(0.85 + this.rnd() * 0.25);
        this.group.add(b);
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        birds.push({ mesh: b, off: new THREE.Vector3(side * row * 1.6 + (this.rnd() - 0.5), (this.rnd() - 0.5) * 1.2, -row * 1.5), flap: this.rnd() * 10, glide: 0 });
      }
      this.flocks.push({ ...r, phase: this.rnd() * Math.PI * 2, birds });
    }
    // 站著的白鷺鷥／黑面琵鷺
    for (const s of spots) {
      const bird = makeWader(this.rnd);
      bird.position.set(s.x, s.y, s.z);
      bird.rotation.y = this.rnd() * Math.PI * 2;
      this.group.add(bird);
      this.standing.push({ mesh: bird, t: this.rnd() * 10 });
    }
    this.world.root.add(this.group);
  }

  setSeason(id) {
    for (const s of this.standing) {
      const spoon = id === 'winter';
      s.mesh.userData.beak.material = spoon ? beakBlack : beakYellow;
      s.mesh.userData.face.visible = spoon;
      s.mesh.userData.spoon.visible = spoon;
    }
  }

  update(dt, t, night) {
    const visible = night < 0.75;
    for (const f of this.flocks) {
      f.phase += dt * f.speed;
      const a = f.phase;
      const c = new THREE.Vector3(f.cx + Math.cos(a) * f.rx, f.y + Math.sin(a * 2.3) * 3, f.cz + Math.sin(a) * f.rz);
      const vel = new THREE.Vector3(-Math.sin(a) * f.rx * f.speed, Math.cos(a * 2.3) * 3 * 2.3 * f.speed, Math.cos(a) * f.rz * f.speed).normalize();
      const yaw = Math.atan2(vel.x, vel.z);
      const bank = clamp(-f.speed * 6, -0.5, 0.5);
      for (const b of f.birds) {
        b.mesh.visible = visible;
        if (!visible) continue;
        const o = b.off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        o.y += Math.sin(t * 0.8 + b.flap) * 0.4;
        b.mesh.position.copy(c).add(o);
        b.mesh.rotation.set(-vel.y * 0.6, yaw, bank, 'YXZ');
        b.flap += dt;
        const cycle = (b.flap % 7);
        const gliding = cycle > 4.5;
        const amp = gliding ? 0.08 : 0.62;
        const wave = Math.sin(t * (gliding ? 2 : 7.5) + b.flap * 3) * amp + (gliding ? 0.05 : 0.12);
        for (const w of b.mesh.userData.wings) w.pivot.rotation.z = w.s * wave;
      }
    }
    for (const s of this.standing) {
      s.t += dt;
      const neck = s.mesh.userData.neck;
      const peck = Math.max(0, Math.sin(s.t * 0.7)) ** 8;
      neck.rotation.x = 0.15 + peck * 1.1;
    }
  }
}

function makeWader(rnd) {
  const g = new THREE.Group();
  const white = MAT.white;
  const body = new THREE.Mesh(G.sph(1, 14, 10), white);
  body.scale.set(0.22, 0.2, 0.38);
  body.position.y = 0.95;
  body.rotation.x = -0.25;
  g.add(body);
  for (const s of [-0.07, 0.07]) {
    const leg = new THREE.Mesh(G.cyl(0.018, 0.018, 0.8, 5), MAT.dark);
    leg.position.set(s, 0.4, 0);
    g.add(leg);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 1.05, 0.22);
  const n1 = new THREE.Mesh(G.cyl(0.05, 0.06, 0.45, 8), white);
  n1.position.y = 0.2;
  n1.rotation.x = 0.35;
  neck.add(n1);
  const head = new THREE.Mesh(G.sph(0.09, 12, 10), white);
  head.position.set(0, 0.44, 0.1);
  neck.add(head);
  const face = new THREE.Mesh(G.shape('waderFace', () => new THREE.SphereGeometry(0.094, 12, 10, 0, Math.PI)), beakBlack);
  face.position.copy(head.position).add(new THREE.Vector3(0, 0, 0.012));
  face.visible = false;
  neck.add(face);
  const beak = new THREE.Mesh(G.cone(0.025, 0.3, 6), beakYellow);
  beak.rotation.x = Math.PI / 2 + 0.25;
  beak.position.set(0, 0.41, 0.28);
  neck.add(beak);
  const spoon = new THREE.Mesh(G.sph(1, 10, 6), beakBlack);
  spoon.scale.set(0.05, 0.015, 0.06);
  spoon.position.set(0, 0.37, 0.44);
  spoon.visible = false;
  neck.add(spoon);
  g.add(neck);
  g.userData = { neck, beak, face, spoon };
  g.scale.setScalar(1.25 + rnd() * 0.3);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ======================= 雲 =======================
export class Clouds {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.list = [];
    this.mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, emissive: '#cfe6f5', emissiveIntensity: 0.32 });
    this.mats = [];
    this.rnd = rng('clouds');
  }

  build() {
    const geo = new THREE.SphereGeometry(1, 22, 16);
    for (let k = 0; k < 22; k++) {
      const c = new THREE.Group();
      const mat = this.mat.clone();
      this.mats.push(mat);
      c.userData.mat = mat;
      const puffs = 6 + Math.floor(this.rnd() * 6);
      const len = 10 + this.rnd() * 14;
      for (let i = 0; i < puffs; i++) {
        const t = i / (puffs - 1) - 0.5;
        const r = (3.2 + this.rnd() * 3.2) * (1 - Math.abs(t) * 0.9);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(t * len + (this.rnd() - 0.5) * 2, r * 0.35 + this.rnd() * 1.2, (this.rnd() - 0.5) * 5);
        m.scale.set(r * 1.15, r * 0.82, r);
        m.castShadow = true;
        c.add(m);
      }
      // 扁平的底
      const base = new THREE.Mesh(geo, mat);
      base.scale.set(len * 0.55, 1.4, 4.2);
      base.position.y = 0.6;
      base.castShadow = true;
      c.add(base);
      let x, z;
      for (let tries = 0; tries < 60; tries++) {
        x = -300 + this.rnd() * 600;
        z = -230 + this.rnd() * 400;
        if (!(Math.abs(x) < 95 && z > -85 && z < 190)) break;
      }
      const y = 30 + this.rnd() * 26;
      c.position.set(x, y, z);
      c.rotation.y = (this.rnd() - 0.5) * 0.6;
      const s = 0.9 + this.rnd() * 0.9;
      c.scale.set(s, s * (0.8 + this.rnd() * 0.3), s);
      c.userData.speed = 1.2 + this.rnd() * 1.6;
      this.group.add(c);
      this.list.push(c);
    }
    this.world.root.add(this.group);
  }

  setTint(color, skyTop, night) {
    const em = skyTop.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    for (const m of this.mats) {
      m.color.copy(color);
      m.emissive.copy(em);
      m.emissiveIntensity = 0.22 + (1 - night) * 0.12;
    }
  }

  update(dt, cam) {
    for (const c of this.list) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 320) c.position.x = -320;
      // 鏡頭靠太近時淡出，避免一大團白擋住畫面
      const d = cam ? c.position.distanceTo(cam) : 999;
      const a = Math.min(1, Math.max(0, (d - 30) / 45));
      const m = c.userData.mat;
      m.transparent = a < 0.999;
      m.opacity = a;
      m.depthWrite = a >= 0.999;
      c.visible = a > 0.02;
    }
  }
}

// ======================= 季節粒子 =======================
export class SeasonFx {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.mode = null;
    this.rnd = rng('fx');
    this.dummy = new THREE.Object3D();
    this.night = 0;
  }

  build() {
    // 花瓣／落葉：InstancedMesh，會翻轉
    const petal = new THREE.Shape();
    petal.moveTo(0, -0.12); petal.quadraticCurveTo(0.12, -0.02, 0.02, 0.12); petal.quadraticCurveTo(-0.1, 0.02, 0, -0.12);
    const leaf = new THREE.Shape();
    leaf.moveTo(0, -0.2); leaf.quadraticCurveTo(0.16, -0.05, 0, 0.2); leaf.quadraticCurveTo(-0.16, -0.05, 0, -0.2);
    const mk = (shape, count, colors) => {
      const m = new THREE.InstancedMesh(new THREE.ShapeGeometry(shape, 4), new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), count);
      const col = new THREE.Color();
      const parts = [];
      for (let i = 0; i < count; i++) {
        col.set(colors[i % colors.length]);
        m.setColorAt(i, col);
        parts.push(this.spawn({}, true));
      }
      m.instanceColor.needsUpdate = true;
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
      return { mesh: m, parts };
    };
    this.petals = mk(petal, 420, ['#FFB7CC', '#FFD3E0', '#FFC4D6', '#FFFFFF']);
    this.leaves = mk(leaf, 360, ['#F2A04E', '#E8704C', '#F5C85A', '#D9894A']);

    // 雪
    const N = 2600;
    const pos = new Float32Array(N * 3);
    this.snowV = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -160 + this.rnd() * 320;
      pos[i * 3 + 1] = this.rnd() * 70;
      pos[i * 3 + 2] = -130 + this.rnd() * 260;
      this.snowV[i] = 1.4 + this.rnd() * 1.6;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.42, map: softDotTexture(), transparent: true, depthWrite: false, opacity: 0.95, color: '#ffffff' }));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.group.add(this.snow);

    // 螢火蟲
    const F = 320;
    const fpos = new Float32Array(F * 3);
    this.fireBase = [];
    for (let i = 0; i < F; i++) {
      const a = this.rnd() * Math.PI * 2, r = Math.sqrt(this.rnd()) * 70;
      const b = [Math.cos(a) * r, 2 + this.rnd() * 5, Math.sin(a) * r * 0.8, this.rnd() * 10];
      this.fireBase.push(b);
      fpos.set(b.slice(0, 3), i * 3);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    this.fire = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.7, map: softDotTexture('rgba(255,255,200,1)', 'rgba(220,255,120,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#E9FF9A' }));
    this.fire.frustumCulled = false;
    this.fire.visible = false;
    this.group.add(this.fire);

    // 蝴蝶（春夏白天）
    this.butterflies = [];
    const wing = new THREE.Shape();
    wing.moveTo(0, 0); wing.quadraticCurveTo(0.3, 0.28, 0.24, 0.02); wing.quadraticCurveTo(0.26, -0.18, 0, 0);
    const wg = new THREE.ShapeGeometry(wing, 5);
    wg.rotateX(-Math.PI / 2);
    const bcols = ['#FFD54F', '#FFFFFF', '#F8BBD0', '#B3E5FC', '#FFAB91'];
    const islands = [...this.world.islandInfo.values()];
    for (let i = 0; i < 26 && islands.length; i++) {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: bcols[i % bcols.length], roughness: 0.6, side: THREE.DoubleSide });
      const wl = new THREE.Mesh(wg, m), wr = new THREE.Mesh(wg, m);
      wr.scale.x = -1;
      g.add(wl, wr);
      g.scale.setScalar(1.6);
      const home = islands[i % islands.length];
      this.butterflies.push({ g, wl, wr, home: new THREE.Vector3(home.x + (this.rnd() - 0.5) * 8, 2.6, home.z + (this.rnd() - 0.5) * 8), t: this.rnd() * 100 });
      g.visible = false;
      this.group.add(g);
    }
    this.world.root.add(this.group);
  }

  spawn(p, initial = false) {
    p.x = -90 + this.rnd() * 180;
    p.y = initial ? this.rnd() * 40 : 32 + this.rnd() * 10;
    p.z = -80 + this.rnd() * 160;
    p.vy = 0.7 + this.rnd() * 0.8;
    p.sway = this.rnd() * 10;
    p.rx = this.rnd() * 6; p.ry = this.rnd() * 6; p.rz = this.rnd() * 6;
    p.spin = 0.8 + this.rnd() * 2;
    return p;
  }

  setMode(particle, season) {
    this.mode = particle;
    this.season = season;
    this.petals.mesh.visible = particle === 'petal';
    this.leaves.mesh.visible = particle === 'leaf';
    this.snow.visible = particle === 'snow';
    this.fire.visible = particle === 'firefly';
  }

  update(dt, t, night) {
    this.night = night;
    const wind = 0.9;
    for (const set of [this.petals, this.leaves]) {
      if (!set.mesh.visible) continue;
      set.parts.forEach((p, i) => {
        p.y -= p.vy * dt;
        p.x += (wind + Math.sin(t * 0.7 + p.sway) * 0.6) * dt;
        p.z += Math.cos(t * 0.5 + p.sway) * 0.4 * dt;
        p.rx += p.spin * dt; p.rz += p.spin * 0.7 * dt;
        if (p.y < 0.2 || p.x > 95) this.spawn(p);
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.rotation.set(p.rx, p.ry, p.rz);
        this.dummy.scale.setScalar(set === this.leaves ? 1.6 : 1.4);
        this.dummy.updateMatrix();
        set.mesh.setMatrixAt(i, this.dummy.matrix);
      });
      set.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.snow.visible) {
      const a = this.snow.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - this.snowV[i] * dt;
        let x = a.getX(i) + Math.sin(t * 0.6 + i) * 0.3 * dt + 0.4 * dt;
        if (y < 0) { y = 70; }
        if (x > 160) x = -160;
        a.setY(i, y);
        a.setX(i, x);
      }
      a.needsUpdate = true;
    }
    if (this.fire.visible) {
      const a = this.fire.geometry.attributes.position;
      this.fireBase.forEach((b, i) => {
        a.setXYZ(i, b[0] + Math.sin(t * 0.4 + b[3]) * 1.6, b[1] + Math.sin(t * 0.9 + b[3] * 2) * 0.8, b[2] + Math.cos(t * 0.35 + b[3]) * 1.6);
      });
      a.needsUpdate = true;
      this.fire.material.opacity = 0.12 + night * 0.88;
      this.fire.material.size = 0.45 + night * 0.4 + Math.sin(t * 3) * 0.05;
    }
    const showB = (this.season === 'spring' || this.season === 'summer') && night < 0.5;
    for (const b of this.butterflies) {
      b.g.visible = showB;
      if (!showB) continue;
      b.t += dt;
      const s = b.t * 0.6;
      b.g.position.set(b.home.x + Math.sin(s) * 3 + Math.sin(s * 2.3) * 1.2, b.home.y + Math.sin(s * 3.1) * 0.6, b.home.z + Math.cos(s * 0.8) * 3);
      b.g.rotation.y = Math.atan2(Math.cos(s) * 3, -Math.sin(s * 0.8) * 2.4);
      const f = Math.sin(b.t * 16) * 1.1;
      b.wl.rotation.z = f;
      b.wr.rotation.z = -f;
    }
  }
}

// ======================= 交通與機械 =======================
export class Traffic {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.boats = [];
    this.planes = [];
    this.cars = [];
    this.spinners = [];
    this.wheels = [];
    this.rnd = rng('traffic');
  }

  build(ctx, data, accentMat) {
    // 風機、水車
    for (const t of ctx.turbines) {
      const tb = makeTurbine(t.s, t.foundation);
      tb.position.set(t.x, t.y, t.z);
      tb.rotation.y = t.yaw || 0;
      this.group.add(tb);
      this.spinners.push({ rotor: tb.userData.rotor, speed: 1.1 + this.rnd() * 0.5, phase: this.rnd() * 6 });
    }
    for (const a of ctx.aerators) {
      const ae = makeAerator();
      ae.position.set(a.x, a.y, a.z);
      ae.rotation.y = a.yaw;
      this.group.add(ae);
      this.wheels.push(ae.userData.wheel);
    }
    // 船
    const routes = [
      { cx: -20, cz: 68, rx: 28, rz: 11, kind: 'fishing', speed: 0.05 },
      { cx: 66, cz: 0, rx: 11, rz: 33, kind: 'sail', speed: -0.04 },
      { cx: 0, cz: -52, rx: 44, rz: 3.5, kind: 'sail', speed: 0.03 },
      { cx: 25, cz: 122, rx: 58, rz: 16, kind: 'fishing', speed: -0.035 },
      { cx: -152, cz: 52, rx: 13, rz: 26, kind: 'fishing', speed: 0.05 },
      { cx: 150, cz: 130, rx: 30, rz: 9, kind: 'sail', speed: 0.04 }
    ];
    const hullCols = ['#4FC3F7', '#FF8A80', '#FFD54F', '#81C784', '#BA68C8', '#4DB6AC'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    routes.forEach((r, i) => {
      const boat = makeBoat(hullCols[i % hullCols.length], r.kind);
      boat.scale.setScalar(1.15);
      this.group.add(boat);
      this.boats.push({ ...r, mesh: boat, a: this.rnd() * Math.PI * 2 });
    });
    // 車
    ctx.roads.forEach((road, ri) => {
      if (road.length < 4) return;
      const lens = [0];
      for (let i = 1; i < road.length; i++) lens.push(lens[i - 1] + Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1]));
      for (let k = 0; k < 4; k++) {
        const car = makeCar(ri * 4 + k);
        this.group.add(car);
        this.cars.push({ mesh: car, road, lens, d: (lens[lens.length - 1] / 4) * k + this.rnd() * 20, speed: 7 + this.rnd() * 3 });
      }
    });
    // 飛機
    const ap = ctx.airport;
    if (ap && data.airport?.enabled !== false) {
      const ux = Math.cos(ap.yaw), uz = Math.sin(ap.yaw);
      const vx = -uz, vz = ux; // 跑道側向（runway 在 local z = -1.8）
      const rc = (d, y) => new THREE.Vector3(ap.x + ux * d + vx * ap.runwayLocalZ, y, ap.z + uz * d + vz * ap.runwayLocalZ);
      const gy = ap.top + 0.82;
      const pts = [
        rc(-19, gy), rc(-5, gy), rc(12, gy + 0.6), rc(40, 9), rc(75, 18),
        new THREE.Vector3(12, 25, 29), new THREE.Vector3(55, 31, 32), new THREE.Vector3(94, 35, 62),
        new THREE.Vector3(90, 37, 112), new THREE.Vector3(38, 37, 146), new THREE.Vector3(-42, 35, 160),
        new THREE.Vector3(-130, 31, 165), new THREE.Vector3(-205, 26, 136), new THREE.Vector3(-216, 21, 106),
        rc(-95, 16), rc(-55, 9), rc(-31, 3.2)
      ];
      this.flightPath = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
      this.flightLen = this.flightPath.getLength();
      const n = clamp(Math.round(data.airport?.planes ?? 2), 0, 4);
      for (let i = 0; i < n; i++) {
        const pl = makePlane(accentMat);
        pl.scale.setScalar(1.05);
        this.group.add(pl);
        this.planes.push({ mesh: pl, u: i / Math.max(1, n), grounded: true });
      }
      // 高空客機與凝結尾
      const jet = makePlane(accentMat);
      jet.scale.setScalar(1.6);
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.12, 90, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -47), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uOpacity: { value: 0.55 } },
        vertexShader: 'varying float vZ; void main(){ vZ = position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform float uOpacity; varying float vZ; void main(){ float a = smoothstep(-92.0, -6.0, vZ) * uOpacity; gl_FragColor = vec4(1.0,1.0,1.0,a); }'
      }));
      jet.add(trail);
      this.group.add(jet);
      this.jet = { mesh: jet, t: 0, trail };
    }
    this.world.root.add(this.group);
  }

  update(dt, t, night) {
    for (const s of this.spinners) s.rotor.rotation.z += dt * s.speed;
    for (const w of this.wheels) w.rotation.x += dt * 4.5;
    for (const b of this.boats) {
      b.a += dt * b.speed;
      const x = b.cx + Math.cos(b.a) * b.rx, z = b.cz + Math.sin(b.a) * b.rz;
      const dx = -Math.sin(b.a) * b.rx * Math.sign(b.speed), dz = Math.cos(b.a) * b.rz * Math.sign(b.speed);
      b.mesh.position.set(x, 0.02 + Math.sin(t * 1.6 + b.cx) * 0.06, z);
      b.mesh.rotation.set(Math.sin(t * 1.3 + b.cz) * 0.04, Math.atan2(dx, dz), Math.sin(t * 1.1 + b.cx) * 0.05, 'YXZ');
    }
    for (const c of this.cars) {
      const total = c.lens[c.lens.length - 1];
      c.d = (c.d + c.speed * dt) % total;
      let i = 1;
      while (i < c.lens.length - 1 && c.lens[i] < c.d) i++;
      const a = c.road[i - 1], b = c.road[i];
      const f = (c.d - c.lens[i - 1]) / (c.lens[i] - c.lens[i - 1] || 1);
      c.mesh.position.set(a[0] + (b[0] - a[0]) * f, 1.55, a[1] + (b[1] - a[1]) * f);
      c.mesh.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    }
    if (this.flightPath) {
      for (const p of this.planes) {
        const pos = this.flightPath.getPointAt(p.u);
        const speed = 7 + Math.max(0, pos.y - 2) * 0.62;
        p.u = (p.u + (speed * dt) / this.flightLen) % 1;
        const ahead = this.flightPath.getPointAt((p.u + 0.004) % 1);
        p.mesh.position.copy(pos);
        p.mesh.lookAt(ahead);
        const tan = this.flightPath.getTangentAt(p.u);
        const tan2 = this.flightPath.getTangentAt((p.u + 0.01) % 1);
        const turn = tan.x * tan2.z - tan.z * tan2.x;
        p.mesh.rotateZ(clamp(turn * 18, -0.6, 0.6));
        const low = pos.y < 6;
        p.mesh.userData.gear.visible = low;
        const ground = pos.y < 2.6;
        if (ground && !p.grounded) this.world.emit('flight', { kind: 'arrive' });
        if (!ground && p.grounded && pos.y > 3) this.world.emit('flight', { kind: 'depart' });
        if (ground !== p.grounded && (ground || pos.y > 3)) p.grounded = ground;
      }
    }
    if (this.jet) {
      const j = this.jet;
      j.t = (j.t + dt) % 70;
      const f = j.t / 55;
      const from = new THREE.Vector3(-380, 92, -210), to = new THREE.Vector3(380, 98, 120);
      j.mesh.visible = f <= 1;
      if (f <= 1) {
        j.mesh.position.lerpVectors(from, to, f);
        j.mesh.lookAt(to);
        j.trail.material.uniforms.uOpacity.value = 0.5 * (1 - night * 0.6);
      }
    }
  }
}

// 燈塔光束（夜裡旋轉）
export function makeBeam() {
  const geo = new THREE.ConeGeometry(4.5, 46, 24, 1, true);
  geo.translate(0, -23, 0);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uOpacity; varying vec3 vP; void main(){ float a = (1.0 - smoothstep(0.0, 46.0, length(vP))) * uOpacity; gl_FragColor = vec4(1.0, 0.95, 0.72, a); }'
  });
  const g = new THREE.Group();
  const b1 = new THREE.Mesh(geo, m);
  const b2 = new THREE.Mesh(geo, m);
  b2.rotation.y = Math.PI;
  g.add(b1, b2);
  g.userData.mat = m;
  return g;
}
