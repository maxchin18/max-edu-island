import * as THREE from 'three';

// 海面：近岸淺綠 → 外海深藍、微微起伏的浪、一圈圈往岸邊推的白浪花
// 「離岸遠近」用一張預先算好的貼圖（R = 近岸、G = 大範圍）

export const SHORE_MIN = -260;
export const SHORE_SIZE = 520;
const RES = 512;

/** shapes: [{type:'poly', pts:[[x,z],...]}, {type:'circle', x, z, r}, {type:'ellipse', x,z,rx,rz,rot}] */
export function buildShoreTexture(shapes) {
  const c = document.createElement('canvas');
  c.width = c.height = RES;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, RES, RES);
  ctx.fillStyle = '#fff';
  const px = (v) => ((v - SHORE_MIN) / SHORE_SIZE) * RES;
  for (const s of shapes) {
    ctx.beginPath();
    if (s.type === 'poly') {
      s.pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), px(z)) : ctx.moveTo(px(x), px(z))));
      ctx.closePath();
    } else if (s.type === 'circle') {
      ctx.arc(px(s.x), px(s.z), (s.r / SHORE_SIZE) * RES, 0, Math.PI * 2);
    } else if (s.type === 'ellipse') {
      ctx.ellipse(px(s.x), px(s.z), (s.rx / SHORE_SIZE) * RES, (s.rz / SHORE_SIZE) * RES, s.rot || 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  const src = ctx.getImageData(0, 0, RES, RES).data;
  const base = new Float32Array(RES * RES);
  for (let i = 0; i < base.length; i++) base[i] = src[i * 4] / 255;

  const near = blur(base, 4, 3);
  const far = blur(base, 18, 3);
  const out = new Uint8Array(RES * RES * 4);
  for (let i = 0; i < base.length; i++) {
    out[i * 4] = Math.round(Math.min(1, near[i]) * 255);
    out[i * 4 + 1] = Math.round(Math.min(1, far[i] * 1.4) * 255);
    out[i * 4 + 2] = Math.round(base[i] * 255);
    out[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, RES, RES, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

// 可分離的 box blur，跑數次近似高斯
function blur(src, radius, passes) {
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  const n = RES;
  const win = radius * 2 + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < n; y++) {
      let acc = 0;
      const row = y * n;
      for (let x = -radius; x <= radius; x++) acc += a[row + Math.min(n - 1, Math.max(0, x))];
      for (let x = 0; x < n; x++) {
        b[row + x] = acc / win;
        acc += a[row + Math.min(n - 1, x + radius + 1)] - a[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < n; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += b[Math.min(n - 1, Math.max(0, y)) * n + x];
      for (let y = 0; y < n; y++) {
        a[y * n + x] = acc / win;
        acc += b[Math.min(n - 1, y + radius + 1) * n + x] - b[Math.max(0, y - radius) * n + x];
      }
    }
  }
  return a;
}

const vertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
varying vec3 vWorld;
varying vec3 vNormalW;
#include <fog_pars_vertex>

void addWave(vec2 p, vec2 dir, float freq, float speed, float amp, inout float h, inout vec2 g) {
  float ph = dot(p, dir) * freq + uTime * speed;
  h += amp * sin(ph);
  g += amp * freq * cos(ph) * dir;
}

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h = 0.0;
  vec2 g = vec2(0.0);
  addWave(wp.xz, normalize(vec2(1.0, 0.35)), 0.16, 1.1, 0.10 * uAmp, h, g);
  addWave(wp.xz, normalize(vec2(-0.4, 1.0)), 0.23, 1.45, 0.06 * uAmp, h, g);
  addWave(wp.xz, normalize(vec2(0.7, -0.8)), 0.41, 1.9, 0.035 * uAmp, h, g);
  addWave(wp.xz, normalize(vec2(-1.0, -0.2)), 0.73, 2.6, 0.018 * uAmp, h, g);
  wp.y += h;
  vWorld = wp.xyz;
  vNormalW = normalize(vec3(-g.x, 1.0, -g.y));
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform sampler2D uShore;
uniform float uShoreMin;
uniform float uShoreSize;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSky;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uNight;
varying vec3 vWorld;
varying vec3 vNormalW;
#include <common>
#include <fog_pars_fragment>

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 suv = (vWorld.xz - vec2(uShoreMin)) / uShoreSize;
  vec4 s = texture2D(uShore, suv);
  float near = s.r;
  float far = s.g;

  // 細碎漣漪讓法線有細節
  vec2 q = vWorld.xz * 0.55;
  float n1 = noise(q + vec2(uTime * 0.35, uTime * 0.21));
  float n2 = noise(q * 2.3 - vec2(uTime * 0.27, -uTime * 0.31));
  vec3 N = normalize(vNormalW + vec3((n1 - 0.5) * 0.1 + (n2 - 0.5) * 0.05, 0.0, (n2 - 0.5) * 0.1 - (n1 - 0.5) * 0.05));

  // 深淺：越靠岸越清澈的淺綠
  float shallowT = smoothstep(0.0, 1.0, far * 0.75 + near * 0.55);
  vec3 col = mix(uDeep, uShallow, shallowT);
  // 近岸看得到一點沙底
  col = mix(col, col * 1.08 + vec3(0.04, 0.035, 0.0), smoothstep(0.25, 0.5, near));

  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col = mix(col, uSky, clamp(fres * 0.55, 0.0, 0.6));

  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 260.0);
  col += uSunColor * spec * mix(0.5, 0.3, uNight);
  // 細碎的波光
  float glint = smoothstep(0.93, 1.0, n2 * n1 * 1.6) * (1.0 - uNight * 0.7);
  col += uSunColor * glint * 0.025;

  // 往岸邊推進的浪花
  float wob = noise(vWorld.xz * 0.12 + uTime * 0.04) * 2.4;
  float band = sin(near * 34.0 - uTime * 1.25 + wob);
  float zone = smoothstep(0.1, 0.34, near) * (1.0 - smoothstep(0.44, 0.5, near));
  float foam = smoothstep(0.72, 0.97, band) * zone;
  foam *= 0.55 + 0.45 * noise(vWorld.xz * 0.9 + uTime * 0.3);
  // 貼著岸邊那一圈細白浪
  float lap = smoothstep(0.42, 0.5, near + 0.025 * sin(uTime * 1.6 + vWorld.x * 0.3 + vWorld.z * 0.2));
  foam = max(foam * 0.75, lap * 0.95);
  col = mix(col, uFoam, foam * mix(1.0, 0.55, uNight));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createWater(shoreTex) {
  const geo = new THREE.PlaneGeometry(1400, 1400, 320, 320);
  geo.rotateX(-Math.PI / 2);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uAmp: { value: 1 },
      uShore: { value: null },
      uShoreMin: { value: SHORE_MIN },
      uShoreSize: { value: SHORE_SIZE },
      uDeep: { value: new THREE.Color('#2E9DC6') },
      uShallow: { value: new THREE.Color('#86E3DD') },
      uFoam: { value: new THREE.Color('#ffffff') },
      uSky: { value: new THREE.Color('#DDF3FA') },
      uSunColor: { value: new THREE.Color('#ffffff') },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
      uNight: { value: 0 }
    }
  ]);
  uniforms.uShore.value = shoreTex;
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, fog: true });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = 0;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}
