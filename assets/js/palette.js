import * as THREE from 'three';
import { lerp } from './util.js';

// ---------- 一天的光線：依時刻內插 ----------
// h = 小時（0–24），其餘為顏色或數值
const TIME_KEYS = [
  { h: 0,    skyTop: '#0A1533', skyBot: '#22355C', sun: '#A9C1FF', sunI: 0.5, hemiSky: '#5D72A6', hemiGnd: '#1A2238', hemiI: 0.3, env: 0.06, night: 1,    cloud: '#55658C', exposure: 1.05 },
  { h: 4.8,  skyTop: '#0E1A3C', skyBot: '#2A3A62', sun: '#A9C1FF', sunI: 0.5, hemiSky: '#5D72A6', hemiGnd: '#1A2238', hemiI: 0.3, env: 0.06, night: 1,    cloud: '#5A6A90', exposure: 1.05 },
  { h: 6.2,  skyTop: '#93BFE6', skyBot: '#FFD3BA', sun: '#FFC39A', sunI: 2.2,  hemiSky: '#FFE4D2', hemiGnd: '#7B8FA2', hemiI: 0.52, env: 0.15,  night: 0.2,  cloud: '#FFE0D4', exposure: 1.0 },
  { h: 8.0,  skyTop: '#7CC6EF', skyBot: '#DDF3FA', sun: '#FFF3E0', sunI: 3.19,  hemiSky: '#EAF6FF', hemiGnd: '#93AE8C', hemiI: 0.63, env: 0.21, night: 0,    cloud: '#FFFFFF', exposure: 1.0 },
  { h: 12.0, skyTop: '#6CC0EE', skyBot: '#E4F6FB', sun: '#FFFFFF', sunI: 3.52,  hemiSky: '#EEF8FF', hemiGnd: '#96B28E', hemiI: 0.66,  env: 0.23, night: 0,    cloud: '#FFFFFF', exposure: 1.0 },
  { h: 16.0, skyTop: '#76C2EC', skyBot: '#E8F4F2', sun: '#FFF0DA', sunI: 3.19,  hemiSky: '#F2F4FF', hemiGnd: '#97AE8A', hemiI: 0.61,  env: 0.21, night: 0,    cloud: '#FFFBF4', exposure: 1.0 },
  { h: 17.8, skyTop: '#7385C6', skyBot: '#FFB58C', sun: '#FF9D6A', sunI: 2.2,  hemiSky: '#FFCDB0', hemiGnd: '#6E6E8E', hemiI: 0.5,  env: 0.15,  night: 0.3,  cloud: '#FFC3A6', exposure: 1.0 },
  { h: 19.0, skyTop: '#2B3672', skyBot: '#A06F9A', sun: '#C38AB0', sunI: 0.88,  hemiSky: '#8C7FB0', hemiGnd: '#2A2A48', hemiI: 0.39,  env: 0.09, night: 0.75, cloud: '#8E7DAA', exposure: 1.03 },
  { h: 20.4, skyTop: '#0C1736', skyBot: '#25385F', sun: '#A9C1FF', sunI: 0.5, hemiSky: '#5D72A6', hemiGnd: '#1A2238', hemiI: 0.3, env: 0.06, night: 1,    cloud: '#55658C', exposure: 1.05 },
  { h: 24,   skyTop: '#0A1533', skyBot: '#22355C', sun: '#A9C1FF', sunI: 0.5, hemiSky: '#5D72A6', hemiGnd: '#1A2238', hemiI: 0.3, env: 0.06, night: 1,    cloud: '#55658C', exposure: 1.05 }
];

const colorCache = new Map();
const C = (hex) => {
  if (!colorCache.has(hex)) colorCache.set(hex, new THREE.Color(hex));
  return colorCache.get(hex);
};

/** 取得某時刻的光線參數（顏色為 THREE.Color，線性空間） */
export function lightAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < TIME_KEYS.length - 2 && TIME_KEYS[i + 1].h <= h) i++;
  const a = TIME_KEYS[i];
  const b = TIME_KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h || 1);
  const out = {};
  for (const k of Object.keys(a)) {
    if (k === 'h') continue;
    if (typeof a[k] === 'string') out[k] = C(a[k]).clone().lerp(C(b[k]), t);
    else out[k] = lerp(a[k], b[k], t);
  }
  // 太陽方位：6 點從東方升起、18 點西沉；夜裡改用月光（固定在高處偏西）
  const dayT = (h - 6) / 12; // 0..1 白天
  if (dayT > -0.08 && dayT < 1.08) {
    const az = lerp(-0.6, Math.PI + 0.6, dayT); // 東 → 西
    const el = Math.max(0.12, Math.sin(Math.min(Math.max(dayT, 0), 1) * Math.PI) * 1.05);
    out.sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), 0.55 * Math.cos(el) + 0.25).normalize();
  } else {
    out.sunDir = new THREE.Vector3(-0.35, 0.85, 0.4).normalize();
  }
  return out;
}

export const TIME_PRESETS = { dawn: 6.4, day: 11.5, dusk: 17.9, night: 22 };
export function phaseOf(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 16.8) return 'day';
  if (h >= 16.8 && h < 19.3) return 'dusk';
  return 'night';
}

// ---------- 四季配色（清新粉彩） ----------
export const SEASON_LOOK = {
  spring: {
    grass: '#A8DB82', grass2: '#BEE69A', meadow: '#B5E08E',
    leafA: '#F7B3C8', leafB: '#FFD3E0', leafC: '#9BD877', conifer: '#6DB57A',
    sand: '#F4E5C6', far: '#A6D59A', mountain: '#8CC79A',
    shallow: '#86E3DD', deep: '#3FAED3', foam: '#F7FFFE',
    flowers: ['#FF9EBB', '#FFE38A', '#FFFFFF', '#C9A8FF'],
    skyTint: '#FFE9F1', bareTrees: false, snow: false
  },
  summer: {
    grass: '#8DD068', grass2: '#A2DC7A', meadow: '#98D670',
    leafA: '#5DBD5E', leafB: '#7BCB66', leafC: '#4FAE5A', conifer: '#3F9E62',
    sand: '#F7E9CB', far: '#7DC27F', mountain: '#6CB47C',
    shallow: '#6FE6D8', deep: '#2AA6CF', foam: '#FFFFFF',
    flowers: ['#FFD54A', '#FF8A65', '#FFFFFF', '#FFB3C7'],
    skyTint: '#E8FBFF', bareTrees: false, snow: false
  },
  autumn: {
    grass: '#CBD487', grass2: '#DCCF84', meadow: '#D3D08A',
    leafA: '#F3A35C', leafB: '#EC7A55', leafC: '#F5CB61', conifer: '#5F9C68',
    sand: '#F2DFBE', far: '#BDB879', mountain: '#A9AE7E',
    shallow: '#8AD8D8', deep: '#3A9CC4', foam: '#FFFDF8',
    flowers: ['#F6B04B', '#E9724C', '#FFF1C9', '#C9874B'],
    skyTint: '#FFF1E2', bareTrees: false, snow: false
  },
  winter: {
    grass: '#DCEBE5', grass2: '#EEF6F4', meadow: '#E6F0EC',
    leafA: '#C7D8D2', leafB: '#DDE8E4', leafC: '#B9CEC6', conifer: '#4F8B6E',
    sand: '#EEE8DC', far: '#D5E4E6', mountain: '#CADCE2',
    shallow: '#A1DCE6', deep: '#4D90BB', foam: '#FFFFFF',
    flowers: ['#FFFFFF', '#E3F1FF', '#FFD9E4', '#CFE7FF'],
    skyTint: '#EEF6FF', bareTrees: true, snow: true
  }
};

export function seasonByMonth(list, month) {
  return (list.find((s) => (s.months || []).includes(month)) || list[0] || { id: 'spring' }).id;
}
