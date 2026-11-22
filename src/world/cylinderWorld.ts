import * as THREE from 'three';
import {
  WorldShaderUniforms,
  attachStorybookSurfaceShader,
} from '../assets/modelLibrary';
import { RegionBlueprint, RegionId, SeasonId, TimeMode } from './regions';
import { Collider2D, DoorwayTarget } from './playerController';

export type ViewMode = 'space' | 'ground' | 'interior' | 'plot';
export type GroundLookPreset = 'street' | 'sky' | 'walk';
export type ContinentStripId = 0 | 1 | 2;

export const CYLINDER_RADIUS = 320;
export const CYLINDER_LENGTH = 1100;
const CYLINDER_CENTER_Z = -210; // spans z in [-760, +340]
const STRIP_ARC_HALF = (40 * Math.PI) / 180; // 80° continent strips alternating with 40° sky bays

export interface ContinentStripDef {
  id: ContinentStripId;
  theta: number;
  icon: string;
  name: string;
  subtitle: string;
}

export const CONTINENT_STRIPS: readonly ContinentStripDef[] = [
  {
    id: 0,
    theta: 0,
    icon: '🌏',
    name: '东亚水乡带',
    subtitle: '小樽雪岸 · 监利网市镇 · 广州暖冬街区',
  },
  {
    id: 1,
    theta: (Math.PI * 2) / 3,
    icon: '🏰',
    name: '欧陆田园带',
    subtitle: '约克郡达罗比 · 阿姆斯特丹运河 · 爱琴海白湾',
  },
  {
    id: 2,
    theta: (Math.PI * 4) / 3,
    icon: '🌊',
    name: '大洋海岸带',
    subtitle: '魁北克秋林 · 旧金山彩坡 · 悉尼蓝花楹海湾',
  },
] as const;

export interface CylinderPlotDef {
  id: string;
  name: string;
  shortLabel: string;
  icon: string;
  strip: ContinentStripId;
  axialZ: number;
  climateTag: string;
  subtitle: string;
  presetRegionId?: Exclude<RegionId, 'custom'>;
  osmCoords?: { lat: number; lon: number; label: string };
  isCustomUserPlot?: boolean;
}

export const INITIAL_CYLINDER_PLOTS: CylinderPlotDef[] = [
  {
    id: 'otaru',
    name: '北海道 · 小樽运河',
    shortLabel: '小樽运河',
    icon: '🏮',
    strip: 0,
    axialZ: -45,
    climateTag: '北寒雪岸段',
    subtitle: '雪落古砖石仓库、运河煤气灯长廊与冰柱水岸',
    presetRegionId: 'otaru',
  },
  {
    id: 'wangshi',
    name: '湖北监利 · 网市镇',
    shortLabel: '监利网市',
    icon: '🏡',
    strip: 0,
    axialZ: 0,
    climateTag: '温带水乡段',
    subtitle: '白墙黛瓦马头墙、红灯早茶摊与荷塘稻田',
    presetRegionId: 'wangshi',
  },
  {
    id: 'guangzhou',
    name: '广州 · 北京路',
    shortLabel: '广州北京路',
    icon: '🌺',
    strip: 0,
    axialZ: 45,
    climateTag: '亚热带暖冬段',
    subtitle: '岭南常青骑楼街巷与 OpenStreetMap 实景风貌',
    osmCoords: { lat: 23.1216, lon: 113.265, label: '广州 · 北京路' },
  },
  {
    id: 'darrowby',
    name: '约克郡 · 达罗比',
    shortLabel: '约克郡达罗比',
    icon: '🌬️',
    strip: 1,
    axialZ: -45,
    climateTag: '高地冬雪段',
    subtitle: '《万物生灵》冬日玻璃温室、老风磨与牧场石桥',
    presetRegionId: 'darrowby',
  },
  {
    id: 'amsterdam',
    name: '阿姆斯特丹运河',
    shortLabel: '阿姆斯特丹',
    icon: '🚲',
    strip: 1,
    axialZ: 0,
    climateTag: '温带运河段',
    subtitle: '运河山墙红砖街区与 OSM 实测双河道轮廓',
    osmCoords: { lat: 52.3635, lon: 4.896, label: '阿姆斯特丹运河' },
  },
  {
    id: 'santorini',
    name: '圣托里尼 · 伊亚',
    shortLabel: '圣托里尼',
    icon: '🏛️',
    strip: 1,
    axialZ: 45,
    climateTag: '地中海暖夏段',
    subtitle: '悬崖层叠白墙与钴蓝穹顶的爱琴海阳光海岸',
    osmCoords: { lat: 36.4618, lon: 25.3753, label: '圣托里尼 · 伊亚' },
  },
  {
    id: 'quebec',
    name: '魁北克 · 老城',
    shortLabel: '魁北克老城',
    icon: '🍁',
    strip: 2,
    axialZ: -45,
    climateTag: '北美秋雪段',
    subtitle: '铜绿斜顶古堡街区、枫糖树林与北美冬雪风貌',
    osmCoords: { lat: 46.8123, lon: -71.2045, label: '魁北克 · 老城' },
  },
  {
    id: 'sanfrancisco',
    name: '旧金山 · 彩绘女士',
    shortLabel: '旧金山彩坡',
    icon: '🚋',
    strip: 2,
    axialZ: 0,
    climateTag: '海湾缓坡段',
    subtitle: '糖果色维多利亚排屋、阿拉莫公园与电车坡道',
    osmCoords: { lat: 37.7763, lon: -122.4328, label: '旧金山 · 彩绘女士' },
  },
  {
    id: 'sydney',
    name: '悉尼 · 蓝花楹海湾',
    shortLabel: '悉尼蓝花楹',
    icon: '💜',
    strip: 2,
    axialZ: 45,
    climateTag: '南半球初夏段',
    subtitle: '蓝花楹盛放大道、白色歌剧帆影、红白灯塔与海湾帆船',
    presetRegionId: 'sydney',
  },
];

export function routeCoordsToCylinder(
  lat: number,
  lon: number,
  existingPlots: readonly CylinderPlotDef[] = [],
): {
  strip: ContinentStripId;
  axialZ: number;
  climateLabel: string;
  stripName: string;
} {
  let strip: ContinentStripId;
  if (lon >= 65 && lon <= 150 && lat >= -12) strip = 0;
  else if (lon >= -25 && lon < 65) strip = 1;
  else strip = 2;

  let axialZ = lat > 40 ? -45 : lat >= 26 ? 0 : 45;
  const climateLabel =
    lat > 40 ? '高纬寒雪气候段' : lat >= 26 ? '温带四季气候段' : lat < 0 ? '南半球反季暖夏段' : '低纬亚热带暖冬段';

  const near = existingPlots.find(
    (p) => !p.isCustomUserPlot && p.strip === strip && Math.abs(p.axialZ - axialZ) < 12,
  );
  if (near) {
    axialZ = axialZ > 0 ? axialZ - 17 : axialZ + 17;
  }
  axialZ = Math.max(-60, Math.min(60, axialZ));

  return {
    strip,
    axialZ,
    climateLabel,
    stripName: CONTINENT_STRIPS[strip].name,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Ground height of the seamless flat central plain curving smoothly into the R=320 O'Neill cylinder barrel. */
export function groundBowlY(x: number, z: number): number {
  const sinT = Math.min(0.999, Math.abs(x) / CYLINDER_RADIUS);
  const cylY = CYLINDER_RADIUS * (1 - Math.sqrt(1 - sinT * sinT));
  const r = Math.hypot(x, z);
  const blend = smoothstep(52, 130, r);
  return -0.045 + (cylY + 0.045) * blend;
}

/** Lateral banking angle (radians) matching the O'Neill valley curvature when running up flanks. */
export function groundBowlSlopeTilt(x: number, z: number): number {
  const blend = smoothstep(52, 130, Math.hypot(x, z));
  return Math.atan2(x, CYLINDER_RADIUS) * blend * 0.65;
}

function buildBottomValleyStripGeometry(arcHalf: number, length: number, radius: number): THREE.BufferGeometry {
  const segAng = 32;
  const segZ = 44;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const v = iz / segZ;
    const z = CYLINDER_CENTER_Z - length * 0.5 + v * length;
    for (let ia = 0; ia <= segAng; ia++) {
      const u = ia / segAng;
      const theta = -arcHalf + u * arcHalf * 2;
      const x = radius * Math.sin(theta);
      const y = groundBowlY(x, z);
      positions.push(x, y, z);

      const s = Math.sin(theta);
      const c = Math.cos(theta);
      const r = Math.hypot(x, z);
      const b = smoothstep(52, 130, r);
      normals.push(-s * b, c * b + (1 - b), 0);
      uvs.push(u, 1 - v);
    }
  }

  const stride = segAng + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ia = 0; ia < segAng; ia++) {
      const a = iz * stride + ia;
      const b = a + 1;
      const d = (iz + 1) * stride + ia;
      const e = d + 1;
      // Right-handed inward facing (+Y upward)
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildOverheadContinentGeometry(
  thetaCenter: number,
  arcHalf: number,
  length: number,
  radius: number,
): THREE.BufferGeometry {
  const segAng = 24;
  const segZ = 32;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const v = iz / segZ;
    const z = CYLINDER_CENTER_Z - length * 0.5 + v * length;
    for (let ia = 0; ia <= segAng; ia++) {
      const u = ia / segAng;
      const theta = thetaCenter - arcHalf + u * arcHalf * 2;
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      positions.push(radius * s, radius * (1 - c), z);
      normals.push(-s, c, 0);
      uvs.push(u, 1 - v);
    }
  }

  const stride = segAng + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ia = 0; ia < segAng; ia++) {
      const a = iz * stride + ia;
      const b = a + 1;
      const d = (iz + 1) * stride + ia;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildFloorLandscapeTexture(region: RegionBlueprint, season: SeasonId, snowy: boolean): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const turfHex = snowy
    ? region.palette.grassWinter
    : season === 'spring'
      ? region.palette.grassSpring
      : season === 'autumn'
        ? region.palette.grassAutumn
        : season === 'winter'
          ? '#92b070'
          : region.palette.grassSummer;

  ctx.fillStyle = turfHex;
  ctx.fillRect(0, 0, w, h);

  let seed = 919;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Agricultural & meadow patchworks across the sweeping valley slopes
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 18; col++) {
      if (Math.abs(col - 9) <= 2 && Math.abs(row - 13) <= 2) continue;
      if (rnd() > 0.62) continue;
      const px = col * 56 + 4;
      const py = row * 50 + 4;
      ctx.fillStyle = snowy
        ? 'rgba(232, 232, 224, 0.45)'
        : col % 3 === 0 && rnd() > 0.45
          ? 'rgba(202, 186, 108, 0.42)'
          : rnd() > 0.5
            ? 'rgba(154, 188, 86, 0.40)'
            : 'rgba(118, 158, 78, 0.36)';
      ctx.fillRect(px, py, 48, 42);
      ctx.strokeStyle = 'rgba(110, 104, 82, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, 48, 42);
    }
  }

  // Grand curving river / bay running down the right-center valley toward the far endcap
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = snowy ? '#c4d8e0' : region.palette.waterTop;
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.moveTo(w * 0.58, 0);
  ctx.bezierCurveTo(w * 0.68, h * 0.3, w * 0.48, h * 0.68, w * 0.54, h);
  ctx.stroke();
  ctx.restore();

  if (region.waterLayout === 'harbour_bay' && !snowy) {
    ctx.fillStyle = '#dec996';
    ctx.beginPath();
    ctx.ellipse(w * 0.54, h * 0.72, 130, 72, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4bbbd0';
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.72, 114, 58, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Extending sandstone avenue straight along center-left axis
  ctx.fillStyle = snowy ? '#d8d4c8' : region.palette.dirtPath;
  ctx.fillRect(w * 0.41, 0, 22, h);
  ctx.fillStyle = 'rgba(120, 108, 86, 0.35)';
  ctx.fillRect(w * 0.41, 0, 2, h);
  ctx.fillRect(w * 0.41 + 20, 0, 2, h);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function buildOverheadCityTexture(stripIdx: number, isNight: boolean): THREE.CanvasTexture {
  const w = 1024;
  const h = 2048;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (isNight) {
    grad.addColorStop(0, '#141c2c');
    grad.addColorStop(0.5, '#121b29');
    grad.addColorStop(1, '#101925');
  } else if (stripIdx === 1) {
    grad.addColorStop(0, '#cfd8c2');
    grad.addColorStop(0.35, '#8bb364');
    grad.addColorStop(1, '#78a354');
  } else {
    grad.addColorStop(0, '#d2d4c4');
    grad.addColorStop(0.3, '#94b86a');
    grad.addColorStop(0.7, '#7eab5a');
    grad.addColorStop(1, '#6d9b4e');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Lush continuous central linear park belt down the middle (Spinward style!)
  ctx.fillStyle = isNight ? '#162d26' : '#5f9646';
  ctx.fillRect(w * 0.42, 0, w * 0.16, h);

  // Curving canal & lakes inside central park
  ctx.strokeStyle = isNight ? '#2c6486' : '#43a8c4';
  ctx.lineWidth = 26;
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const x = w * 0.5 + Math.sin(t * Math.PI * 4 + stripIdx) * 38;
    const y = t * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Dense urban blocks flanking both sides of the central park!
  let seed = 4111 + stripIdx * 313;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const roofPal = isNight
    ? ['#222b3d', '#2b354a', '#1b2333']
    : ['#c96b54', '#efe6d2', '#4e6d85', '#d9ab58', '#849c64', '#b45a4a'];

  for (let row = 0; row < 54; row++) {
    const by = row * 38 + 4;
    ctx.fillStyle = isNight ? '#243045' : '#dfd8c3';
    ctx.fillRect(16, by - 4, w - 32, 4);

    for (let col = 0; col < 18; col++) {
      if (col >= 7 && col <= 10) continue;
      if (rnd() > 0.88) continue;
      const bx = 24 + col * 54;
      const bw = 40 + rnd() * 10;
      const bh = 27 + rnd() * 7;
      ctx.fillStyle = roofPal[(row * 7 + col) % roofPal.length];
      ctx.fillRect(bx, by + 2, bw, bh);

      if (isNight) {
        ctx.fillStyle = rnd() > 0.28 ? '#ffd978' : '#7ae2ff';
        for (let wy = 4; wy < bh - 3; wy += 4) {
          for (let wx = 4; wx < bw - 3; wx += 6) {
            if (rnd() > 0.35) ctx.fillRect(bx + wx, by + 2 + wy, 3, 2);
          }
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function buildSkyVaultTexture(isNight: boolean): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  if (!isNight) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#7ebce0');
    g.addColorStop(0.45, '#b6dcef');
    g.addColorStop(1.0, '#e6eff0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 10; i++) {
      const cx = (i * 97 + 40) % w;
      const cy = (i * 53 + 35) % h;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 46 + (i % 3) * 18, 13 + (i % 2) * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#0e172c';
    ctx.fillRect(0, 0, w, h);
    let s = 1777;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 360; i++) {
      ctx.fillStyle = rnd() > 0.75 ? '#ffe7b3' : '#e4eeff';
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, rnd() > 0.9 ? 1.8 : 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  tex.needsUpdate = true;
  return tex;
}

function buildEndcapTexture(isNight: boolean): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size * 0.5;
  const cy = size * 0.5;

  const g = ctx.createRadialGradient(cx, cy, 18, cx, cy, size * 0.5);
  if (isNight) {
    g.addColorStop(0.0, '#9bd6ff');
    g.addColorStop(0.24, '#243554');
    g.addColorStop(0.75, '#172238');
    g.addColorStop(1.0, '#0f182a');
  } else {
    g.addColorStop(0.0, '#eef7fc');
    g.addColorStop(0.22, '#bdd4e3');
    g.addColorStop(0.65, '#c7cfbf');
    g.addColorStop(1.0, '#aeb9b0');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Subtle concentric architectural rings (inspired by Spinward Endcap horizon!)
  ctx.strokeStyle = isNight ? 'rgba(130, 175, 225, 0.28)' : 'rgba(105, 118, 128, 0.25)';
  for (let r = 34; r < 252; r += 26) {
    ctx.lineWidth = r < 90 ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
    ctx.lineTo(cx + Math.cos(a) * 252, cy + Math.sin(a) * 252);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Spinward-scale O'Neill Cylinder sky vault (R=320m, L=1100m) enveloping the flat 22×22 diorama plot.
 * Combines a seamlessly blended flat extended park neighborhood with monumental overhead curving continents,
 * angled skylight mirrors, gliding airships, and a distant circular conservatory hub at the horizon.
 */
export class GroundBackdropWorld {
  readonly root = new THREE.Group();
  private vaultGroup = new THREE.Group();
  private neighborhoodGroup = new THREE.Group();
  private dynamicGroup = new THREE.Group();

  private floorMat: THREE.MeshLambertMaterial;
  private overheadMats: THREE.MeshLambertMaterial[] = [];
  private skyMat: THREE.MeshBasicMaterial;
  private endcapMat: THREE.MeshBasicMaterial;

  private floorTex: THREE.CanvasTexture | null = null;
  private cityDayTexs: THREE.CanvasTexture[] = [];
  private cityNightTexs: THREE.CanvasTexture[] = [];
  private skyDayTex: THREE.CanvasTexture;
  private skyNightTex: THREE.CanvasTexture;
  private endcapDayTex: THREE.CanvasTexture;
  private endcapNightTex: THREE.CanvasTexture;

  private hubWheel: THREE.Group | null = null;
  private airships: Array<{ group: THREE.Group; baseX: number; baseY: number; baseZ: number; speed: number; phase: number }> = [];
  private walkers: Array<{ group: THREE.Group; ax: number; az: number; range: number; axis: 'x' | 'z'; phase: number }> = [];
  private doorwayMarker: THREE.Group | null = null;
  private neighborhoodColliders: Collider2D[] = [];
  private doorwayTarget: DoorwayTarget = {
    x: -5.8,
    z: -4.4,
    label: '☕ 推门进入「观海驿站酒馆」',
    action: 'enter_tavern',
  };

  constructor(
    parentScene: THREE.Scene,
    private uniforms: WorldShaderUniforms,
  ) {
    this.floorMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
    attachStorybookSurfaceShader(this.floorMat, this.uniforms, { snowCap: false, isWindow: false });

    this.skyDayTex = buildSkyVaultTexture(false);
    this.skyNightTex = buildSkyVaultTexture(true);
    this.skyMat = new THREE.MeshBasicMaterial({ map: this.skyDayTex, side: THREE.BackSide });

    this.endcapDayTex = buildEndcapTexture(false);
    this.endcapNightTex = buildEndcapTexture(true);
    this.endcapMat = new THREE.MeshBasicMaterial({ map: this.endcapDayTex, side: THREE.DoubleSide });

    for (let i = 1; i <= 2; i++) {
      this.cityDayTexs.push(buildOverheadCityTexture(i, false));
      this.cityNightTexs.push(buildOverheadCityTexture(i, true));
    }

    this.buildSkyVault();
    this.buildSkyProps();
    this.root.add(this.vaultGroup, this.neighborhoodGroup, this.dynamicGroup);
    parentScene.add(this.root);
  }

  private mkMat(
    hex: string | number,
    opts: { isWindow?: boolean; isLantern?: boolean } = {},
  ): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true });
    attachStorybookSurfaceShader(m, this.uniforms, {
      snowCap: false,
      isWindow: opts.isWindow ?? false,
      isLantern: opts.isLantern ?? false,
    });
    return m;
  }

  private buildSkyVault(): void {
    // 1. Outer Skylight Sky Shell (R = 348, 64 segs -> stays strictly outside Strip 0 hillsides everywhere!)
    const skyGeo = new THREE.CylinderGeometry(
      CYLINDER_RADIUS + 28,
      CYLINDER_RADIUS + 28,
      CYLINDER_LENGTH + 40,
      64,
      1,
      true,
    );
    skyGeo.rotateX(Math.PI * 0.5);
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    skyMesh.position.set(0, CYLINDER_RADIUS, CYLINDER_CENTER_Z);
    this.vaultGroup.add(skyMesh);

    // 2. Bottom Valley Strip (Strip 0): seamlessly flat underfoot (y = -0.045), curving upward into sides & hills!
    const bottomGeo = buildBottomValleyStripGeometry(STRIP_ARC_HALF, CYLINDER_LENGTH, CYLINDER_RADIUS);
    const bottomMesh = new THREE.Mesh(bottomGeo, this.floorMat);
    bottomMesh.receiveShadow = true;
    this.vaultGroup.add(bottomMesh);

    // 3. Upper-Left & Upper-Right Overhead Inverted Continent Strips (120° & 240°) with colorful city-skyline relief
    const towerPal = ['#d6c9b4', '#c97e68', '#7d92a4', '#e3d8c0', '#b89f78'];
    [1, 2].forEach((stripId, idx) => {
      const thetaCenter = CONTINENT_STRIPS[stripId].theta;
      const geo = buildOverheadContinentGeometry(thetaCenter, STRIP_ARC_HALF, CYLINDER_LENGTH, CYLINDER_RADIUS);
      const mat = new THREE.MeshLambertMaterial({ map: this.cityDayTexs[idx], flatShading: true });
      attachStorybookSurfaceShader(mat, this.uniforms, { snowCap: false, isWindow: false });
      this.overheadMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      this.vaultGroup.add(mesh);

      // 1-draw-call InstancedMesh low-poly megacity blocks overhead with colored rooftops/walls!
      const count = 200;
      const blockGeo = new THREE.BoxGeometry(6.8, 1, 6.8);
      const blockMat = this.mkMat('#ffffff', { isWindow: false });
      const inst = new THREE.InstancedMesh(blockGeo, blockMat, count);
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      let seed = 7001 + idx * 911;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      for (let k = 0; k < count; k++) {
        const side = k % 2 === 0 ? 1 : -1;
        const angOff = side * (0.14 + rnd() * (STRIP_ARC_HALF - 0.16));
        const th = thetaCenter + angOff;
        const zz = CYLINDER_CENTER_Z - 420 + rnd() * 760;
        const bh = 8 + rnd() * 30;
        const rad = CYLINDER_RADIUS - bh * 0.5;
        dummy.position.set(rad * Math.sin(th), CYLINDER_RADIUS - rad * Math.cos(th), zz);
        dummy.rotation.set(0, 0, th);
        dummy.scale.set(0.95 + rnd() * 1.45, bh, 0.95 + rnd() * 1.55);
        dummy.updateMatrix();
        inst.setMatrixAt(k, dummy.matrix);
        col.set(towerPal[k % towerPal.length]);
        inst.setColorAt(k, col);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.vaultGroup.add(inst);
    });

    // 4. Slender Skylight Margin Trim ONLY on upper overhead continent edges (leaves lower valley horizon open!)
    const rimMat = this.mkMat('#8b9ba8');
    for (const s of [CONTINENT_STRIPS[1], CONTINENT_STRIPS[2]]) {
      for (const edge of [-STRIP_ARC_HALF, STRIP_ARC_HALF]) {
        const th = s.theta + edge;
        const rim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, CYLINDER_LENGTH), rimMat);
        rim.position.set(CYLINDER_RADIUS * Math.sin(th), CYLINDER_RADIUS * (1 - Math.cos(th)), CYLINDER_CENTER_Z);
        rim.rotation.z = th;
        this.vaultGroup.add(rim);
      }
    }

    // 5. Distant Circular Conservatory Endcap Horizon + Suspended Zero-G Hub Wheel (z = -755)
    const endcap = new THREE.Mesh(new THREE.CircleGeometry(CYLINDER_RADIUS + 8, 48), this.endcapMat);
    endcap.position.set(0, CYLINDER_RADIUS, CYLINDER_CENTER_Z - CYLINDER_LENGTH * 0.5 + 10);
    this.vaultGroup.add(endcap);

    const hub = new THREE.Group();
    hub.position.set(0, CYLINDER_RADIUS, CYLINDER_CENTER_Z - CYLINDER_LENGTH * 0.5 + 22);
    const hubMat = this.mkMat('#d8ccb2');
    const hubGlow = this.mkMat('#ffe6a3', { isLantern: true });
    hub.add(new THREE.Mesh(new THREE.TorusGeometry(64, 4.2, 8, 36), hubMat));
    hub.add(new THREE.Mesh(new THREE.TorusGeometry(28, 2.8, 6, 24), hubGlow));
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(3.5, 128, 3.5), hubMat);
      sp.rotation.z = (i * Math.PI) / 4;
      hub.add(sp);
    }
    this.hubWheel = hub;
    this.vaultGroup.add(hub);
  }

  private buildSkyProps(): void {
    // Stylized Dirigible Airships cruising quietly across the grand sky vault
    const hullMat = this.mkMat('#f5efe0');
    const finMat = this.mkMat('#c96852');
    const gondMat = this.mkMat('#52606e');

    for (let i = 0; i < 2; i++) {
      const ship = new THREE.Group();
      const env = new THREE.Mesh(new THREE.SphereGeometry(4.2, 14, 10), hullMat);
      env.scale.set(1.0, 0.85, 3.1);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 4.0), finMat);
      fin.position.set(0, 1.4, 9.0);
      const gond = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 5.2), gondMat);
      gond.position.set(0, -3.6, 0);
      ship.add(env, fin, gond);
      const bx = i === 0 ? -42 : 55;
      const by = i === 0 ? 115 : 155;
      const bz = i === 0 ? -210 : -340;
      ship.position.set(bx, by, bz);
      this.dynamicGroup.add(ship);
      this.airships.push({ group: ship, baseX: bx, baseY: by, baseZ: bz, speed: 0.14 + i * 0.06, phase: i * 2.4 });
    }
  }

  rebuildForRegion(region: RegionBlueprint, season: SeasonId, snowy: boolean): void {
    this.floorTex?.dispose();
    this.floorTex = buildFloorLandscapeTexture(region, season, snowy);
    this.floorMat.map = this.floorTex;
    this.floorMat.needsUpdate = true;

    while (this.neighborhoodGroup.children.length > 0) {
      this.neighborhoodGroup.remove(this.neighborhoodGroup.children[0]);
    }
    this.walkers = [];
    this.neighborhoodColliders = [];

    // Stylized Midground Neighborhood outside [-12.5, +12.5] so streets flow naturally into the curving horizon
    const wallMat = this.mkMat(region.palette.wallTone);
    const roofMat = this.mkMat(snowy ? '#eae6dc' : region.palette.roofTone);
    const altRoof = this.mkMat(snowy ? '#eae6dc' : '#65788a');
    const winMat = this.mkMat('#2e3c4e', { isWindow: true });
    const trunkMat = this.mkMat('#6b5545');
    const lampPost = this.mkMat('#3c4148');
    const lampBulb = this.mkMat('#ffe592', { isLantern: true });

    const treeHex = snowy
      ? '#cfd8d4'
      : region.id === 'sydney' && (season === 'summer' || season === 'spring')
        ? '#9b7be0'
        : season === 'autumn'
          ? '#d68846'
          : '#6a9e52';
    const treeHexAlt = snowy ? '#dde4e0' : '#73a659';
    const leafMat1 = this.mkMat(treeHex);
    const leafMat2 = this.mkMat(treeHexAlt);

    let seed = 2309;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const addBuilding = (x: number, z: number, w: number, h: number, d: number, alt: boolean) => {
      const y = groundBowlY(x, z);
      const b = new THREE.Group();
      b.position.set(x, y, z);

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      b.add(body);

      const winBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h * 0.55, d + 0.08), winMat);
      winBand.position.y = h * 0.52;
      b.add(winBand);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 1.8, 4), alt ? altRoof : roofMat);
      roof.position.y = h + 0.9;
      roof.rotation.y = Math.PI * 0.25;
      b.add(roof);

      this.neighborhoodGroup.add(b);
      this.neighborhoodColliders.push({
        kind: 'box',
        minX: x - w * 0.5,
        maxX: x + w * 0.5,
        minZ: z - d * 0.5,
        maxZ: z + d * 0.5,
      });
    };

    const addTree = (x: number, z: number, sc: number, purple: boolean) => {
      const y = groundBowlY(x, z);
      const tr = new THREE.Group();
      tr.position.set(x, y, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.3, 6), trunkMat);
      trunk.position.y = 0.65;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), purple ? leafMat1 : leafMat2);
      crown.scale.set(1.15, 0.85, 1.15);
      crown.position.y = 1.95;
      crown.castShadow = true;
      tr.add(trunk, crown);
      tr.scale.setScalar(sc);
      this.neighborhoodGroup.add(tr);
      this.neighborhoodColliders.push({ kind: 'circle', x, z, r: 0.42 * sc });
    };

    // Place charming lower cottages well outside central bay/vista corridor (|x| >= 16.5)
    const blocks: Array<[number, number, number, number, number]> = [
      [-18, -22, 3.4, 2.8, 3.0],
      [-28, -36, 3.8, 3.4, 3.4],
      [-20, -52, 3.2, 2.6, 3.0],
      [-34, -72, 4.0, 3.6, 3.6],
      [-22, -96, 3.6, 3.2, 3.2],
      [19, -20, 3.2, 2.6, 3.0],
      [29, -34, 3.8, 3.2, 3.4],
      [21, -54, 3.4, 2.8, 3.0],
      [35, -74, 4.0, 3.5, 3.4],
      [-23, 18, 3.4, 2.8, 3.0],
      [24, 18, 3.6, 3.0, 3.2],
    ];
    blocks.forEach(([x, z, w, h, d], idx) => addBuilding(x, z, w, h, d, idx % 2 === 1));

    // Boulevard trees & street lamps framing central promenade without blocking the sweeping center vista
    for (let z = -110; z <= 32; z += 12) {
      if (Math.abs(z) <= 12) continue;
      addTree(-13.2 - rnd() * 2, z, 0.9 + rnd() * 0.3, rnd() > 0.35);
      addTree(13.2 + rnd() * 2, z, 0.9 + rnd() * 0.3, rnd() > 0.35);

      const ly = groundBowlY(-7.2, z);
      const lamp = new THREE.Group();
      lamp.position.set(-7.2, ly, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 5), lampPost);
      pole.position.y = 1.4;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), lampBulb);
      bulb.position.y = 2.85;
      lamp.add(pole, bulb);
      this.neighborhoodGroup.add(lamp);
    }
    for (let i = 0; i < 28; i++) {
      const tx = (rnd() > 0.5 ? 1 : -1) * (16 + rnd() * 44);
      const tz = -130 + rnd() * 155;
      if (Math.max(Math.abs(tx), Math.abs(tz)) <= 13.8) continue;
      addTree(tx, tz, 0.9 + rnd() * 0.55, i % 2 === 0);
    }

    // 1-draw-call curving hillside villages climbing UP the left & right valley slopes (R=320 curvature!)
    const slopeCount = 120;
    const slopeMat = this.mkMat('#ffffff');
    const slopeInst = new THREE.InstancedMesh(new THREE.BoxGeometry(4.2, 3.2, 4.2), slopeMat, slopeCount);
    const sdum = new THREE.Object3D();
    const scol = new THREE.Color();
    const slopePal = ['#ede4d0', '#d28168', '#c8b896', '#72899c'];
    for (let i = 0; i < slopeCount; i++) {
      const sign = i % 2 === 0 ? -1 : 1;
      const sx = sign * (56 + rnd() * 129);
      const sz = -440 + rnd() * 490;
      const sy = groundBowlY(sx, sz);
      const tilt = Math.atan2(sx, CYLINDER_RADIUS);
      sdum.position.set(sx, sy + 1.0, sz);
      sdum.rotation.set(0, rnd() * 1.4, tilt);
      const sc = 0.8 + rnd() * 1.25;
      sdum.scale.set(sc, sc * (0.8 + rnd() * 0.9), sc);
      sdum.updateMatrix();
      slopeInst.setMatrixAt(i, sdum.matrix);
      scol.set(slopePal[i % slopePal.length]);
      slopeInst.setColorAt(i, scol);
    }
    slopeInst.instanceMatrix.needsUpdate = true;
    if (slopeInst.instanceColor) slopeInst.instanceColor.needsUpdate = true;
    this.neighborhoodGroup.add(slopeInst);

    // Animated Pedestrian Walkers along park promenade (gives immediate Spinward human scale!)
    const coatColors = ['#d6674c', '#3c6f94', '#e0a94c', '#4f8564'];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Group();
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.05, 6), this.mkMat(coatColors[i % 4]));
      coat.position.y = 0.65;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), this.mkMat('#f0c8a8'));
      head.position.y = 1.38;
      p.add(coat, head);
      const ax = i % 2 === 0 ? -4.4 : 4.2;
      const az = i < 3 ? -18 - i * 11 : -2 + (i - 3) * 7;
      p.position.set(ax, groundBowlY(ax, az), az);
      this.neighborhoodGroup.add(p);
      this.walkers.push({ group: p, ax, az, range: 6.5, axis: 'z', phase: i * 1.1 });
    }

    // Subtle glowing floating beacon above the region's Inn / Greenhouse doorstep for entering indoor exploration
    const doorPos: [number, number] =
      region.id === 'sydney'
        ? [-5.8, -5.8]
        : region.id === 'darrowby'
          ? [-1.8, -4.8]
          : region.id === 'wangshi'
            ? [-6.4, -5.6]
            : [-5.8, 0.8];
    const mk = new THREE.Group();
    mk.position.set(doorPos[0], 3.3, doorPos[1]);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), lampBulb);
    mk.add(diamond);
    this.doorwayMarker = mk;
    this.neighborhoodGroup.add(mk);

    this.doorwayTarget = {
      x: doorPos[0],
      z: doorPos[1] + 1.45,
      label:
        region.id === 'darrowby'
          ? '🌿 进入「玻璃温室花房」 (E)'
          : region.id === 'wangshi'
            ? '☕ 进入「网市驿站茶馆」 (E)'
            : '☕ 进入「观海驿站酒馆」 (E)',
      action: region.id === 'darrowby' ? 'enter_greenhouse' : 'enter_tavern',
    };
  }

  getColliders(): Collider2D[] {
    return this.neighborhoodColliders;
  }

  getDoorwayTarget(): DoorwayTarget {
    return this.doorwayTarget;
  }

  applyAtmosphere(timeMode: TimeMode, renderStyle: 'pocket' | 'pixel' | 'hd'): void {
    const isNight = timeMode === 'night' || timeMode === 'eclipse';
    this.skyMat.map = isNight ? this.skyNightTex : this.skyDayTex;
    this.skyMat.color.set(
      timeMode === 'sunset'
        ? '#f5cbb0'
        : timeMode === 'morning'
          ? '#f6ebe0'
          : renderStyle === 'hd' && !isNight
            ? '#d9ecf8'
            : '#ffffff',
    );
    this.skyMat.needsUpdate = true;

    this.endcapMat.map = isNight ? this.endcapNightTex : this.endcapDayTex;
    this.endcapMat.needsUpdate = true;

    this.overheadMats.forEach((m, i) => {
      m.map = isNight ? this.cityNightTexs[i] : this.cityDayTexs[i];
      m.needsUpdate = true;
    });
  }

  update(dt: number, simTime: number): void {
    if (this.hubWheel) {
      this.hubWheel.rotation.z += dt * 0.08;
    }
    for (const a of this.airships) {
      a.group.position.x = a.baseX + Math.sin(simTime * a.speed + a.phase) * 32;
      a.group.position.z = a.baseZ + Math.cos(simTime * a.speed * 0.6 + a.phase) * 26;
      a.group.rotation.y = Math.cos(simTime * a.speed + a.phase) > 0 ? Math.PI * 0.35 : -Math.PI * 0.65;
    }
    for (const w of this.walkers) {
      const z = w.az + Math.sin(simTime * 0.48 + w.phase) * w.range;
      w.group.position.set(w.ax, groundBowlY(w.ax, z), z);
    }
    if (this.doorwayMarker) {
      this.doorwayMarker.rotation.y += dt * 1.6;
      this.doorwayMarker.position.y = 3.3 + Math.sin(simTime * 3.0) * 0.16;
    }
  }

  dispose(): void {
    this.floorTex?.dispose();
    this.skyDayTex.dispose();
    this.skyNightTex.dispose();
    this.endcapDayTex.dispose();
    this.endcapNightTex.dispose();
    for (const t of [...this.cityDayTexs, ...this.cityNightTexs]) t.dispose();
  }
}
