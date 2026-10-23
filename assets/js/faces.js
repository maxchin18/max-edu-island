import * as THREE from 'three';

// 小人的臉：眼睛、嘴巴、腮紅（與眼鏡）畫在透明貼圖上，貼在頭的前半球
// 貼圖寬 160 × 高 116（邏輯像素，實際 2 倍解析度），對應頭部前方 1.56 × 1.12 弧度

const W = 160, H = 116, SCALE = 2;
const PHI = 1.56, THETA = 1.12, THETA_UP = 0.62; // 赤道以上 0.62 弧度、以下 0.5
const cache = new Map();

const INK = '#2A2A35';
const LIP = '#7A3B3B';

/** smile 微笑、happy 瞇眼笑、grin 開口笑、wink 眨單眼、oh 驚訝、blink 眨眼 */
export const EXPRESSIONS = ['smile', 'happy', 'grin', 'wink', 'oh', 'blink'];

const LOOK = {
  smile: { eyes: 'dot', mouth: 'smile', blush: 0.5 },
  happy: { eyes: 'arc', mouth: 'grin', blush: 0.7 },
  grin: { eyes: 'big', mouth: 'grin', blush: 0.55 },
  wink: { eyes: 'wink', mouth: 'smile', blush: 0.6 },
  oh: { eyes: 'big', mouth: 'oh', blush: 0.35 },
  blink: { eyes: 'closed', mouth: 'smile', blush: 0.5 }
};

export function faceTexture(expr = 'smile', glasses = false) {
  const key = expr + (glasses ? '+g' : '');
  if (cache.has(key)) return cache.get(key);
  const look = LOOK[expr] || LOOK.smile;
  const c = document.createElement('canvas');
  c.width = W * SCALE;
  c.height = H * SCALE;
  const ctx = c.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 腮紅
  for (const s of [-1, 1]) {
    const g = ctx.createRadialGradient(80 + s * 48, 79, 0, 80 + s * 48, 79, 15);
    g.addColorStop(0, `rgba(255,128,150,${look.blush})`);
    g.addColorStop(1, 'rgba(255,128,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(80 + s * 48, 79, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 眼睛
  for (const s of [-1, 1]) {
    const x = 80 + s * 30, y = 55;
    let kind = look.eyes;
    if (kind === 'wink') kind = s === 1 ? 'arc' : 'dot';
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    if (kind === 'dot' || kind === 'big') {
      const rx = kind === 'big' ? 12 : 10.5, ry = kind === 'big' ? 15 : 13.5;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 3.2, y - 5, kind === 'big' ? 4.4 : 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 3.4, y + 4.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'arc') {
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.arc(x, y + 7, 11, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    } else if (kind === 'closed') {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 2);
      ctx.quadraticCurveTo(x, y + 7, x + 10, y + 2);
      ctx.stroke();
    }
  }

  // 眼鏡
  if (glasses) {
    ctx.strokeStyle = '#3B3F4A';
    ctx.lineWidth = 3.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(80 + s * 30, 55, 17.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(80 - 12.5, 53);
    ctx.quadraticCurveTo(80, 48, 80 + 12.5, 53);
    ctx.stroke();
  }

  // 嘴巴
  ctx.strokeStyle = LIP;
  ctx.fillStyle = LIP;
  const mx = 80, my = 89;
  if (look.mouth === 'smile') {
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(mx - 14, my - 4);
    ctx.quadraticCurveTo(mx, my + 10, mx + 14, my - 4);
    ctx.stroke();
  } else if (look.mouth === 'grin') {
    ctx.beginPath();
    ctx.moveTo(mx - 17, my - 6);
    ctx.quadraticCurveTo(mx, my - 3, mx + 17, my - 6);
    ctx.quadraticCurveTo(mx + 13, my + 17, mx, my + 17);
    ctx.quadraticCurveTo(mx - 13, my + 17, mx - 17, my - 6);
    ctx.fill();
    ctx.fillStyle = '#F2898C';
    ctx.beginPath();
    ctx.ellipse(mx, my + 11, 8.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.mouth === 'oh') {
    ctx.beginPath();
    ctx.ellipse(mx, my + 4, 7, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** 頭部前方的球面貼片（臉朝 +z） */
export function faceGeometry(radius) {
  return new THREE.SphereGeometry(radius, 22, 16, Math.PI / 2 - PHI / 2, PHI, Math.PI / 2 - THETA_UP, THETA);
}

const GLASSES_BY_DEFAULT = new Set(['teacher', 'elder', 'partner']);
/** 人物類型可以在資料裡設定 glasses: true/false；沒設定時老師、耆老、大學夥伴戴眼鏡 */
export const wearsGlasses = (type) => (typeof type.glasses === 'boolean' ? type.glasses : GLASSES_BY_DEFAULT.has(type.id));
