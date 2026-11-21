import * as THREE from 'three';
import {
  WorldShaderUniforms,
  attachStorybookSurfaceShader,
} from '../assets/modelLibrary';
import { RegionId, RenderStyleId, TimeMode } from './regions';

export type ViewMode = 'cylinder' | 'plot';
export type CylinderCameraPreset = 'vista' | 'tram' | 'axis';
export type ContinentStripId = 0 | 1 | 2;

export const CYLINDER_RADIUS = 56;
export const CYLINDER_LENGTH = 180;
const HALF_LEN = CYLINDER_LENGTH * 0.5;
const STRIP_ARC_HALF = (41 * Math.PI) / 180; // 82° lush valley continent strip + 38° skylight bay

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

export interface ProjectedPlotPin {
  plot: CylinderPlotDef;
  x: number;
  y: number;
  visible: boolean;
  isOverhead: boolean;
  isFocused: boolean;
  dist: number;
}

export const INITIAL_CYLINDER_PLOTS: CylinderPlotDef[] = [
  // Strip 0: East Asia & Water Towns
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

  // Strip 1: Europe & Pastoral Canals
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

  // Strip 2: Oceania & Americas Coastline
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

  // Offset slightly along the axial avenue if near a fixed preset plot so pins stay distinct
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

function buildCurvedStripGeometry(
  thetaCenter: number,
  arcHalf: number,
  length: number,
  radius: number,
  segAng: number,
  segZ: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const v = iz / segZ;
    const z = -length * 0.5 + v * length;
    for (let ia = 0; ia <= segAng; ia++) {
      const u = ia / segAng;
      const theta = thetaCenter - arcHalf + u * arcHalf * 2;
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      positions.push(radius * s, -radius * c, z);
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
      // Right-handed inward facing ((d - a) x (b - a) points straight inward toward center axis)
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

function buildContinentTexture(stripId: ContinentStripId): THREE.CanvasTexture {
  const w = 512;
  const h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  // Smooth axial climate gradient from z = -90 (v=1, y=h in Canvas? Careful: in buildCurvedStripGeometry v=0 is z=-90 -> uv.y = 1 (top of texture))
  // Wait: Canvas y=0 corresponds to UV y=1 (Three.js flipY = true default!), which is z = -90 (North Polar snow).
  // Canvas y=h corresponds to UV y=0, which is z = +90 (South Sunlit Sea/Bay).
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (stripId === 0) {
    grad.addColorStop(0.0, '#e6e1d4'); // North polar snow
    grad.addColorStop(0.24, '#c8d4ba');
    grad.addColorStop(0.45, '#9ec16f'); // Wangshi middle plain
    grad.addColorStop(0.68, '#8ab462');
    grad.addColorStop(1.0, '#78a556'); // Guangzhou lush subtropical evergreen
  } else if (stripId === 1) {
    grad.addColorStop(0.0, '#e8e4d8'); // Darrowby Yorkshire frost
    grad.addColorStop(0.26, '#c2cfa6');
    grad.addColorStop(0.50, '#9ac06d'); // Amsterdam pastures
    grad.addColorStop(0.76, '#b5ac6c'); // Mediterranean sunlit hillside
    grad.addColorStop(1.0, '#9cb870');
  } else {
    grad.addColorStop(0.0, '#e4dfd2'); // Quebec winter-autumn border
    grad.addColorStop(0.26, '#c2a66f'); // Autumn gold woods
    grad.addColorStop(0.50, '#99be6e'); // San Francisco green hills
    grad.addColorStop(0.75, '#86b55e'); // Sydney summer lawn
    grad.addColorStop(1.0, '#7eb05b'); // Coastal headland grass
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle deterministic watercolor turf/snow dots
  let seed = 701 + stripId * 193;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 1600; i++) {
    const px = rnd() * w;
    const py = rnd() * h;
    const r = 1.2 + rnd() * 2.8;
    ctx.fillStyle =
      py < h * 0.25
        ? 'rgba(255,253,248,0.45)'
        : i % 2 === 0
          ? 'rgba(110,145,70,0.22)'
          : 'rgba(236,225,165,0.28)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Farmland / vineyard patchwork in mid-strip
  ctx.save();
  for (let row = 0; row < 10; row++) {
    const fy = h * 0.30 + row * 48;
    const fx = row % 2 === 0 ? w * 0.58 : w * 0.14;
    ctx.fillStyle =
      stripId === 0
        ? row % 2 === 0
          ? 'rgba(182, 206, 98, 0.45)'
          : 'rgba(210, 192, 108, 0.38)'
        : 'rgba(170, 196, 106, 0.35)';
    ctx.fillRect(fx, fy, w * 0.22, 34);
    ctx.strokeStyle = 'rgba(128, 118, 92, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, w * 0.22, 34);
  }
  ctx.restore();

  // Coastal bay cove near south end on Strip 2 (Sydney) and Strip 1 (Santorini)
  if (stripId === 2) {
    ctx.fillStyle = '#e5cf9d';
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.78, w * 0.32, h * 0.12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4bbbd0';
    ctx.beginPath();
    ctx.ellipse(w * 0.66, h * 0.80, w * 0.27, h * 0.095, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (stripId === 1) {
    ctx.fillStyle = '#4f99b8';
    ctx.beginPath();
    ctx.ellipse(w * 0.56, h * 0.80, w * 0.26, h * 0.09, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Winding Grand Axial Canal running from polar snow meltwater down the length of the strip
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#758a7e';
  ctx.lineWidth = 26;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = w * 0.54 + Math.sin(t * Math.PI * 3.5 + stripId) * 28;
    const y = t * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
  waterGrad.addColorStop(0.0, '#c6deea'); // frozen ice upper canal
  waterGrad.addColorStop(0.28, '#95cad8');
  waterGrad.addColorStop(0.75, '#6cb8cb');
  waterGrad.addColorStop(1.0, '#4bbbd0');
  ctx.strokeStyle = waterGrad;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.restore();

  // Axial Transit Tram Track & Ring Boulevard (at u ≈ 0.36)
  const trackX = w * 0.36;
  ctx.fillStyle = '#9b8d74';
  ctx.fillRect(trackX - 11, 0, 22, h);
  ctx.fillStyle = '#d7cab0';
  ctx.fillRect(trackX - 8, 0, 16, h);
  ctx.fillStyle = '#5c5244';
  for (let ty = 6; ty < h; ty += 14) {
    ctx.fillRect(trackX - 6, ty, 12, 3);
  }

  // Cross avenues & parcel outlines around z = -45 (y=0.25h), 0 (y=0.5h), +45 (y=0.75h)
  for (const frac of [0.25, 0.5, 0.75]) {
    const py = h * frac;
    ctx.fillStyle = '#d8ccb2';
    ctx.fillRect(w * 0.12, py - 7, w * 0.76, 14);
    ctx.strokeStyle = 'rgba(72, 68, 56, 0.42)';
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.5 - 52, py - 46, 104, 92);
  }

  // Steel strip curb edging
  ctx.fillStyle = '#606872';
  ctx.fillRect(0, 0, 10, h);
  ctx.fillRect(w - 10, 0, 10, h);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function buildSkyBackingTexture(isNight: boolean): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  if (!isNight) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#cfe0ea');
    g.addColorStop(0.5, '#e8eef0');
    g.addColorStop(1.0, '#f3ebd8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle sunlit architectural drafting lines
    ctx.strokeStyle = 'rgba(130, 160, 185, 0.22)';
    ctx.lineWidth = 2;
    for (let x = 32; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#0d1426');
    g.addColorStop(0.5, '#17233f');
    g.addColorStop(1.0, '#0d1529');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Soft Milky Way glow & crisp twinkling star points
    ctx.fillStyle = 'rgba(110, 148, 224, 0.14)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5, w * 0.45, h * 0.14, 0.35, 0, Math.PI * 2);
    ctx.fill();

    let s = 919;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 240; i++) {
      const sx = rnd() * w;
      const sy = rnd() * h;
      const sr = rnd() > 0.88 ? 2.2 : 1.1;
      ctx.fillStyle = rnd() > 0.7 ? '#ffe8b5' : '#e6efff';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 3D interior model of our O'Neill Cylinder ("Cooper Station") habitat.
 * Holds 3 curved Continent Land Strips, 3 Skylight Bays, structural arch ribs,
 * North/South geodesic endcaps, 9 curated miniature plot clusters, 3 animated trams,
 * and floating axis cloud puffs.
 */
export class CylinderWorld {
  readonly root = new THREE.Group();
  private plots: CylinderPlotDef[] = INITIAL_CYLINDER_PLOTS.map((p) => ({ ...p }));
  private plotGroups = new Map<string, THREE.Group>();
  private pickMeshes: THREE.Mesh[] = [];
  private beaconRings = new Map<string, THREE.Mesh>();

  private skyShellMat: THREE.MeshBasicMaterial;
  private skyDayTex: THREE.CanvasTexture;
  private skyNightTex: THREE.CanvasTexture;
  private stripTextures: THREE.CanvasTexture[] = [];

  private trams: Array<{ group: THREE.Group; strip: ContinentStripId; phase: number }> = [];
  private clouds: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }> = [];
  private millBlades: THREE.Object3D[] = [];
  private sailboats: Array<{ mesh: THREE.Object3D; phase: number }> = [];
  private solarRing: THREE.Group | null = null;
  private polarBeaconMat: THREE.MeshLambertMaterial | null = null;
  private northEndcapMat: THREE.MeshLambertMaterial | null = null;
  private customPlotGroup: THREE.Group | null = null;

  constructor(
    parentScene: THREE.Scene,
    private uniforms: WorldShaderUniforms,
  ) {
    this.skyDayTex = buildSkyBackingTexture(false);
    this.skyNightTex = buildSkyBackingTexture(true);
    this.skyShellMat = new THREE.MeshBasicMaterial({
      map: this.skyDayTex,
      side: THREE.BackSide,
      color: '#ffffff',
    });

    this.buildShellAndRibs();
    this.buildContinentStrips();
    this.buildEndcaps();
    this.buildCuratedPlots();
    this.buildAmbientValleyProps();
    this.buildRingTrams();
    this.buildAxisClouds();

    parentScene.add(this.root);
  }

  private mkMat(
    hex: string | number,
    opts: { snowCap?: boolean; isWindow?: boolean; isLantern?: boolean } = {},
  ): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true });
    attachStorybookSurfaceShader(m, this.uniforms, {
      snowCap: opts.snowCap ?? false,
      isWindow: opts.isWindow ?? false,
      isLantern: opts.isLantern ?? false,
    });
    return m;
  }

  /**
   * Place a local-Y-up object cleanly onto the cylinder inner wall at `(theta, z)`.
   * Setting `rotation.z = theta` maps local `+Y` straight inward to `(0, 0, z)`.
   */
  private placeOnCylinder(obj: THREE.Object3D, theta: number, z: number, radialInset = 0): void {
    const r = CYLINDER_RADIUS - radialInset;
    obj.position.set(r * Math.sin(theta), -r * Math.cos(theta), z);
    obj.rotation.z = theta;
  }

  private buildShellAndRibs(): void {
    // 1. Outer Skylight Sky/Cosmos Backing Cylinder (radius slightly larger than strips so strips project cleanly inward)
    const skyGeo = new THREE.CylinderGeometry(
      CYLINDER_RADIUS + 2.2,
      CYLINDER_RADIUS + 2.2,
      CYLINDER_LENGTH + 4,
      48,
      1,
      true,
    );
    skyGeo.rotateX(Math.PI * 0.5);
    const skyMesh = new THREE.Mesh(skyGeo, this.skyShellMat);
    this.root.add(skyMesh);

    const frameMat = this.mkMat('#4e5864');
    const strutMat = this.mkMat('#697482');

    // 2. 9 Full-Circle Circumferential Structural Arch Ribs along z = -90 .. +90
    for (let i = 0; i <= 8; i++) {
      const z = -HALF_LEN + (i / 8) * CYLINDER_LENGTH;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(CYLINDER_RADIUS + 0.15, 0.55, 6, 60), frameMat);
      ring.position.set(0, 0, z);
      this.root.add(ring);
    }

    // 3. Longitudinal Skylight Window Mullions across the 3 sky bays (centered at 60°, 180°, 300°)
    const mulGeo = new THREE.BoxGeometry(0.45, 0.65, CYLINDER_LENGTH);
    for (let bay = 0; bay < 3; bay++) {
      const bayCenter = (bay * Math.PI * 2) / 3 + Math.PI / 3;
      for (const offset of [-0.32, 0, 0.32]) {
        const theta = bayCenter + offset;
        const mul = new THREE.Mesh(mulGeo, strutMat);
        this.placeOnCylinder(mul, theta, 0, -1.2);
        this.root.add(mul);
      }
      // Strip border girders flanking each skylight bay
      for (const edge of [-STRIP_ARC_HALF, STRIP_ARC_HALF]) {
        const landTheta = (bay * Math.PI * 2) / 3 + edge;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, CYLINDER_LENGTH), frameMat);
        this.placeOnCylinder(beam, landTheta, 0, 0.25);
        this.root.add(beam);
      }
    }
  }

  private buildContinentStrips(): void {
    for (const strip of CONTINENT_STRIPS) {
      const geo = buildCurvedStripGeometry(
        strip.theta,
        STRIP_ARC_HALF,
        CYLINDER_LENGTH,
        CYLINDER_RADIUS,
        24,
        36,
      );
      const tex = buildContinentTexture(strip.id);
      this.stripTextures.push(tex);
      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        flatShading: true,
      });
      attachStorybookSurfaceShader(mat, this.uniforms, { snowCap: false, isWindow: false });
      const mesh = new THREE.Mesh(geo, mat);
      this.root.add(mesh);
    }
  }

  private buildEndcaps(): void {
    const steel = this.mkMat('#55606e');
    const darkTrim = this.mkMat('#39414c');
    const iceCol = this.mkMat('#e6eff5');
    const glacierBlue = this.mkMat('#8cc4d8');
    this.polarBeaconMat = this.mkMat('#8ee8ff', { isLantern: true });
    const solarAmber = this.mkMat('#ffd373', { isLantern: true });

    const buildCap = (zPos: number, isNorthPolar: boolean) => {
      const cap = new THREE.Group();
      cap.position.set(0, 0, zPos);

      // Stepped outer concentric structural rings
      for (const [r, t] of [
        [CYLINDER_RADIUS - 0.5, 1.1],
        [CYLINDER_RADIUS * 0.66, 0.7],
        [CYLINDER_RADIUS * 0.34, 0.55],
      ] as Array<[number, number]>) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 48), steel);
        cap.add(ring);
      }

      // 12 radial geodesic spokes converging onto central observation hub
      const spokeGeo = new THREE.BoxGeometry(0.9, CYLINDER_RADIUS * 2, 0.9);
      for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(spokeGeo, darkTrim);
        spoke.rotation.z = (i * Math.PI) / 6;
        cap.add(spoke);
      }

      // Outer backdrop disc behind spokes so endcap reads as enclosed geodesic conservatory glass
      const panMat = new THREE.MeshLambertMaterial({
        color: isNorthPolar ? '#cfe2ed' : '#b7d0df',
        side: THREE.DoubleSide,
        flatShading: true,
      });
      attachStorybookSurfaceShader(panMat, this.uniforms, { snowCap: false, isWindow: false });
      if (isNorthPolar) this.northEndcapMat = panMat;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(CYLINDER_RADIUS + 2.2, 36), panMat);
      disc.position.z = isNorthPolar ? -1.4 : 1.4;
      cap.add(disc);

      if (isNorthPolar) {
        // Polar Glacier Observatory Landmark + Glowing Beacon Spire (replaces empty Antarctica continent!)
        const dirSign = 1; // points inward (+Z)
        const base = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 11.5, 4.5, 8), iceCol);
        base.rotation.x = Math.PI * 0.5;
        base.position.z = dirSign * 2.2;
        cap.add(base);

        for (let k = 0; k < 6; k++) {
          const ang = (k * Math.PI) / 3;
          const crag = new THREE.Mesh(new THREE.ConeGeometry(3.4, 7.5, 5), glacierBlue);
          crag.rotation.x = Math.PI * 0.5;
          crag.position.set(Math.cos(ang) * 7.5, Math.sin(ang) * 7.5, dirSign * 3.0);
          cap.add(crag);
        }

        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, 12.0, 8), steel);
        tower.rotation.x = Math.PI * 0.5;
        tower.position.z = dirSign * 7.5;
        cap.add(tower);

        const beacon = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), this.polarBeaconMat!);
        beacon.position.z = dirSign * 14.5;
        cap.add(beacon);
      } else {
        // South Horizon Sunlit Conservatory Ring
        const hub = new THREE.Group();
        hub.position.z = -3.0;
        const innerDisk = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 8.8, 3.2, 12), steel);
        innerDisk.rotation.x = Math.PI * 0.5;
        hub.add(innerDisk);

        const sunRing = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.75, 6, 24), solarAmber);
        hub.add(sunRing);
        this.solarRing = hub;
        cap.add(hub);
      }

      this.root.add(cap);
    };

    buildCap(-HALF_LEN, true);
    buildCap(HALF_LEN, false);
  }

  private createMiniatureHouse(
    w: number,
    h: number,
    d: number,
    wallCol: string,
    roofCol: string,
    roofStyle: 'gable' | 'flat' | 'dome' = 'gable',
  ): THREE.Group {
    const g = new THREE.Group();
    const wallMat = this.mkMat(wallCol);
    const roofMat = this.mkMat(roofCol);
    const winMat = this.mkMat('#344254', { isWindow: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h * 0.5;
    g.add(body);

    const winBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, h * 0.28, d + 0.08), winMat);
    winBar.position.y = h * 0.56;
    g.add(winBar);

    if (roofStyle === 'gable') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.55, 4), roofMat);
      roof.position.y = h + h * 0.27;
      roof.rotation.y = Math.PI * 0.25;
      g.add(roof);
    } else if (roofStyle === 'dome') {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(Math.min(w, d) * 0.44, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
        roofMat,
      );
      dome.position.y = h;
      g.add(dome);
    } else {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.18, d + 0.14), roofMat);
      parapet.position.y = h + 0.09;
      g.add(parapet);
    }
    return g;
  }

  private createMiniTree(foliageHex: string, scale = 1.0, pine = false): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.95, 5), this.mkMat('#6c5646'));
    trunk.position.y = 0.45;
    g.add(trunk);

    const leafMat = this.mkMat(foliageHex);
    if (pine) {
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.5, 6), leafMat);
      c1.position.y = 1.45;
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.2, 6), leafMat);
      c2.position.y = 2.15;
      g.add(c1, c2);
    } else {
      const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), leafMat);
      cr.scale.set(1.15, 0.78, 1.15);
      cr.position.y = 1.35;
      g.add(cr);
    }
    g.scale.setScalar(scale);
    return g;
  }

  private buildPlotCluster(plot: CylinderPlotDef): THREE.Group {
    const grp = new THREE.Group();
    const strip = CONTINENT_STRIPS[plot.strip];
    // Slight angular offset per strip plot edge for visual rhythm inside the wide strip
    const thetaOff = plot.isCustomUserPlot ? -0.18 : 0.05;
    this.placeOnCylinder(grp, strip.theta + thetaOff, plot.axialZ, 0.05);

    // Architectural Plot Frame Plinth (13.5 x 13.5)
    const plinthHex = plot.isCustomUserPlot ? '#e5ca85' : '#cfc2a7';
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.32, 13.6), this.mkMat(plinthHex));
    plinth.position.y = 0.14;
    grp.add(plinth);

    // Subtle glowing focus selection frame ring (scaled smoothly in update())
    const ringMat = this.mkMat('#e8a84c', { isLantern: true });
    const beaconRing = new THREE.Mesh(new THREE.BoxGeometry(14.3, 0.16, 14.3), ringMat);
    beaconRing.position.y = 0.06;
    beaconRing.visible = false;
    grp.add(beaconRing);
    this.beaconRings.set(plot.id, beaconRing);

    // 4 Corner Architectural Lantern Bollards
    const lampMat = this.mkMat('#ffe594', { isLantern: true });
    const postMat = this.mkMat('#3c4148');
    for (const [bx, bz] of [
      [-6.3, -6.3],
      [6.3, -6.3],
      [-6.3, 6.3],
      [6.3, 6.3],
    ] as Array<[number, number]>) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.0, 5), postMat);
      post.position.set(bx, 0.65, bz);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), lampMat);
      bulb.position.set(bx, 1.2, bz);
      grp.add(post, bulb);
    }

    // Bespoke City Architecture inside Plinth
    const pid = plot.id;
    if (pid === 'sydney') {
      const bay = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 0.12, 16), this.mkMat('#4bbbd0'));
      bay.position.set(0.6, 0.3, 2.4);
      grp.add(bay);

      // White Opera Sails silhouette
      const sailMat = this.mkMat('#f8f4eb');
      for (const [sx, sz, h, rot] of [
        [2.6, -1.6, 3.3, -0.35],
        [3.6, -1.2, 2.6, -0.25],
        [1.7, -2.0, 2.2, -0.45],
      ] as Array<[number, number, number, number]>) {
        const shell = new THREE.Mesh(new THREE.ConeGeometry(1.15, h, 4), sailMat);
        shell.scale.set(0.75, 1, 1.35);
        shell.position.set(sx, 0.3 + h * 0.45, sz);
        shell.rotation.z = rot;
        grp.add(shell);
      }

      // Red-white coastal lighthouse
      const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 1.8, 8), this.mkMat('#f6f2e8'));
      lhBase.position.set(-4.0, 1.2, 2.8);
      const lhMid = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.3, 8), this.mkMat('#cb4a3d'));
      lhMid.position.set(-4.0, 2.65, 2.8);
      const lhLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 8), lampMat);
      lhLamp.position.set(-4.0, 3.55, 2.8);
      grp.add(lhBase, lhMid, lhLamp);

      // Lush Purple Jacaranda bloom trees
      for (const [tx, tz, sc, hex] of [
        [-3.6, -2.8, 1.25, '#9b7be0'],
        [-0.8, -3.6, 1.15, '#b698f0'],
        [4.2, -4.0, 1.1, '#8c6bd4'],
        [-1.6, 0.4, 1.05, '#a889e6'],
        [4.5, 1.2, 1.0, '#9b7be0'],
      ] as Array<[number, number, number, string]>) {
        const jt = this.createMiniTree(hex, sc);
        jt.position.set(tx, 0.25, tz);
        grp.add(jt);
      }

      // Tiny bay sailboats
      for (const [bx, bz, ph] of [
        [0.0, 3.2, 0.4],
        [2.2, 2.0, 2.1],
      ] as Array<[number, number, number]>) {
        const boat = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 1.1), this.mkMat('#f7f4ec'));
        const sail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.35, 3), sailMat);
        sail.position.y = 0.75;
        boat.add(hull, sail);
        boat.position.set(bx, 0.42, bz);
        grp.add(boat);
        this.sailboats.push({ mesh: boat, phase: ph });
      }
    } else if (pid === 'guangzhou') {
      // Lingnan evergreen terracotta + slate shophouse grid
      for (const [hx, hz, w, h, d, rc] of [
        [-2.8, -2.2, 3.2, 2.8, 2.4, '#b8644f'],
        [1.2, -2.4, 3.6, 3.2, 2.5, '#596978'],
        [-2.2, 2.0, 3.4, 2.4, 2.4, '#596978'],
        [2.2, 1.8, 3.0, 2.9, 2.6, '#c26952'],
      ] as Array<[number, number, number, number, number, string]>) {
        const hh = this.createMiniatureHouse(w, h, d, '#efe8d8', rc, 'flat');
        hh.position.set(hx, 0.25, hz);
        grp.add(hh);
      }
      for (const [tx, tz] of [
        [-4.5, 0.2],
        [4.6, -1.0],
        [-0.2, 4.4],
        [0.4, -4.6],
      ] as Array<[number, number]>) {
        const banyan = this.createMiniTree('#679852', 1.1);
        banyan.position.set(tx, 0.25, tz);
        grp.add(banyan);
      }
    } else if (pid === 'wangshi') {
      for (const [hx, hz, rc] of [
        [-3.0, -2.5, '#596978'],
        [-0.2, -3.2, '#596978'],
        [-3.4, 1.5, '#687988'],
      ] as Array<[number, number, string]>) {
        const hh = this.createMiniatureHouse(2.4, 2.1, 2.0, '#f3ede0', rc, 'gable');
        hh.position.set(hx, 0.25, hz);
        grp.add(hh);
      }
      const tea = this.createMiniatureHouse(1.9, 1.4, 1.6, '#8a6856', '#c96858', 'gable');
      tea.position.set(1.8, 0.25, 2.2);
      grp.add(tea);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 5.0), this.mkMat('#b5ca5e'));
      pad.position.set(3.2, 0.32, -1.8);
      grp.add(pad);
    } else if (pid === 'otaru') {
      plinth.material = this.mkMat('#ebe7dc');
      for (const [hx, hz] of [
        [-3.2, -2.2],
        [-3.2, 2.2],
        [3.2, -1.8],
        [3.2, 2.4],
      ] as Array<[number, number]>) {
        const wh = this.createMiniatureHouse(2.6, 2.3, 2.8, '#b57b66', '#ede9df', 'gable');
        wh.position.set(hx, 0.25, hz);
        grp.add(wh);
      }
      const canal = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 12.6), this.mkMat('#9fc8d8'));
      canal.position.set(0, 0.28, 0);
      grp.add(canal);
      for (const [tx, tz] of [
        [-4.8, 4.8],
        [4.8, -4.8],
      ] as Array<[number, number]>) {
        const pine = this.createMiniTree('#88a68c', 1.1, true);
        pine.position.set(tx, 0.25, tz);
        grp.add(pine);
      }
    } else if (pid === 'darrowby') {
      plinth.material = this.mkMat('#e6e2d5');
      const inn = this.createMiniatureHouse(3.0, 2.4, 2.2, '#e3dbc6', '#d6d4cc', 'gable');
      inn.position.set(-2.6, 0.25, -2.4);
      grp.add(inn);
      const gh = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 2.0), this.mkMat('#b5dedd'));
      gh.position.set(1.6, 0.95, -2.2);
      grp.add(gh);
      // Windmill tower + animated blades
      const millTower = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.0, 3.8, 7), this.mkMat('#dcd3be'));
      millTower.position.set(3.2, 2.1, 2.4);
      const hub = new THREE.Group();
      hub.position.set(3.2, 3.6, 1.65);
      const bladeMat = this.mkMat('#8a684a');
      for (let b = 0; b < 2; b++) {
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.2, 0.12), bladeMat);
        bl.rotation.z = (b * Math.PI) / 2;
        hub.add(bl);
      }
      this.millBlades.push(hub);
      grp.add(millTower, hub);
    } else if (pid === 'amsterdam') {
      const canal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 12.6), this.mkMat('#6faec4'));
      canal.position.set(0, 0.28, 0);
      grp.add(canal);
      const gableColors = ['#a85648', '#465868', '#c68a52', '#70584a'];
      [-3.5, -0.5, 2.5].forEach((pz, i) => {
        const h1 = this.createMiniatureHouse(1.7, 2.6 + (i % 2) * 0.6, 1.9, gableColors[i], '#3e4752', 'gable');
        h1.position.set(-3.2, 0.25, pz);
        const h2 = this.createMiniatureHouse(1.7, 2.4 + ((i + 1) % 2) * 0.7, 1.9, gableColors[(i + 2) % 4], '#3e4752', 'gable');
        h2.position.set(3.2, 0.25, pz);
        grp.add(h1, h2);
      });
    } else if (pid === 'santorini') {
      const sea = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.16, 4.6), this.mkMat('#419ec2'));
      sea.position.set(0, 0.28, 3.4);
      grp.add(sea);
      for (const [hx, hz, h, dome] of [
        [-3.2, -2.5, 2.2, true],
        [0.0, -3.0, 2.8, true],
        [3.2, -2.2, 2.0, false],
        [-1.8, -0.2, 1.6, false],
        [2.2, -0.4, 1.8, true],
      ] as Array<[number, number, number, boolean]>) {
        const hMesh = this.createMiniatureHouse(2.3, h, 2.1, '#f7f5ee', dome ? '#3269b0' : '#f2eee4', dome ? 'dome' : 'flat');
        hMesh.position.set(hx, 0.25, hz);
        grp.add(hMesh);
      }
    } else if (pid === 'quebec') {
      plinth.material = this.mkMat('#e4dfd2');
      for (const [hx, hz, h] of [
        [-2.8, -1.8, 3.2],
        [1.4, -2.6, 2.5],
        [-1.6, 2.2, 2.3],
      ] as Array<[number, number, number]>) {
        const chateau = this.createMiniatureHouse(2.6, h, 2.4, '#d9cdb6', '#568577', 'gable');
        chateau.position.set(hx, 0.25, hz);
        grp.add(chateau);
      }
      for (const [tx, tz, hex] of [
        [3.8, 1.8, '#d45e3e'],
        [4.2, -2.2, '#e29f42'],
        [-4.4, 2.6, '#c84f39'],
      ] as Array<[number, number, string]>) {
        const maple = this.createMiniTree(hex, 1.15);
        maple.position.set(tx, 0.25, tz);
        grp.add(maple);
      }
    } else if (pid === 'sanfrancisco') {
      const pastels = ['#e2928e', '#9dc6a8', '#e8cf86', '#94b9d6'];
      pastels.forEach((col, idx) => {
        const rowHouse = this.createMiniatureHouse(1.85, 2.8, 2.2, col, '#5d626e', 'gable');
        rowHouse.position.set(-3.4 + idx * 2.2, 0.25, -2.4);
        grp.add(rowHouse);
      });
      for (const [tx, tz] of [
        [-3.8, 2.4],
        [0.4, 2.8],
        [3.8, 2.0],
      ] as Array<[number, number]>) {
        const tree = this.createMiniTree('#72a058', 1.1);
        tree.position.set(tx, 0.25, tz);
        grp.add(tree);
      }
    } else {
      // Custom user-generated plot beacon monument
      for (const [hx, hz, w, h] of [
        [-2.4, -1.8, 2.6, 2.6],
        [2.0, -2.0, 2.4, 3.0],
        [-1.8, 2.0, 2.4, 2.1],
      ] as Array<[number, number, number, number]>) {
        const block = this.createMiniatureHouse(w, h, 2.2, '#efe7d4', '#596978', 'flat');
        block.position.set(hx, 0.25, hz);
        grp.add(block);
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4.2, 6), lampMat);
      spire.position.set(2.2, 2.4, 2.0);
      grp.add(spire);
    }

    // Raycast hitbox (kept visible=false until pickPlot() so Pass 2 InkPipeline never outlines it!)
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(15.2, 9.0, 15.2), hitMat);
    hitbox.position.y = 4.2;
    hitbox.visible = false;
    hitbox.userData.plotId = plot.id;
    grp.add(hitbox);
    this.pickMeshes.push(hitbox);

    this.plotGroups.set(plot.id, grp);
    this.root.add(grp);
    return grp;
  }

  private buildCuratedPlots(): void {
    for (const p of this.plots) {
      this.buildPlotCluster(p);
    }
  }

  private buildAmbientValleyProps(): void {
    let seed = 409;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (const strip of CONTINENT_STRIPS) {
      for (const zBand of [-70, -22, 22, 70]) {
        for (let k = 0; k < 6; k++) {
          const theta = strip.theta + (rnd() - 0.5) * 0.85;
          const pz = zBand + (rnd() - 0.5) * 14;
          const obj = new THREE.Group();
          this.placeOnCylinder(obj, theta, pz, 0.04);

          if (zBand < -30) {
            obj.add(this.createMiniTree('#88a88d', 0.85 + rnd() * 0.45, true));
          } else if (zBand < 30) {
            if (k === 0) {
              obj.add(this.createMiniatureHouse(1.8, 1.4, 1.5, '#eae2ce', '#b6745a', 'gable'));
            } else {
              obj.add(this.createMiniTree(k % 2 === 0 ? '#78a556' : '#c69a50', 0.8 + rnd() * 0.45));
            }
          } else {
            obj.add(
              this.createMiniTree(
                strip.id === 2 && k % 2 === 0 ? '#9e7fe0' : '#6ea25a',
                0.85 + rnd() * 0.4,
              ),
            );
          }
          this.root.add(obj);
        }
      }
    }
  }

  private buildRingTrams(): void {
    const tramColors = ['#d9654c', '#3d7991', '#916ec9'];
    for (const strip of CONTINENT_STRIPS) {
      const tram = new THREE.Group();
      const bodyMat = this.mkMat('#f7f1e0');
      const stripeMat = this.mkMat(tramColors[strip.id]);
      const winMat = this.mkMat('#2e3c4c', { isWindow: true });
      const glowMat = this.mkMat('#ffe99b', { isLantern: true });

      const car = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 4.4), bodyMat);
      car.position.y = 0.72;
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.35, 4.45), stripeMat);
      band.position.y = 0.52;
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.38, 3.6), winMat);
      win.position.y = 0.92;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.16), glowMat);
      head.position.set(0, 0.55, -2.25);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.16), glowMat);
      tail.position.set(0, 0.55, 2.25);

      tram.add(car, band, win, head, tail);
      const tramTheta = strip.theta - STRIP_ARC_HALF * 0.28;
      this.placeOnCylinder(tram, tramTheta, 0, 0.05);
      this.root.add(tram);
      this.trams.push({ group: tram, strip: strip.id, phase: strip.id * 2.1 });
    }
  }

  private buildAxisClouds(): void {
    const cloudMat = this.mkMat('#fbf8ef');
    let seed = 883;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 22; i++) {
      const puff = new THREE.Group();
      const parts = 2 + (i % 3);
      for (let p = 0; p < parts; p++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05 + (p === 0 ? 0.35 : 0), 1), cloudMat);
        s.position.set((p - 1) * 0.95, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.6);
        s.scale.set(1.3, 0.62, 1.0);
        puff.add(s);
      }
      const ang = rnd() * Math.PI * 2;
      const rad = 12 + rnd() * 14;
      const baseX = Math.cos(ang) * rad;
      const baseY = Math.sin(ang) * rad;
      const baseZ = -76 + rnd() * 122;
      puff.position.set(baseX, baseY, baseZ);
      this.root.add(puff);
      // Push first child mesh reference or wrap cleanly; cast puff to Mesh container type
      this.clouds.push({
        mesh: puff as unknown as THREE.Mesh,
        baseX,
        baseY,
        baseZ,
        phase: rnd() * Math.PI * 2,
      });
    }
  }

  upsertCustomPlot(label: string, lat: number, lon: number): CylinderPlotDef {
    const routed = routeCoordsToCylinder(lat, lon, this.plots);
    const shortLabel = label.length > 9 ? `${label.slice(0, 9)}…` : label;

    let def = this.plots.find((p) => p.isCustomUserPlot);
    if (!def) {
      def = {
        id: 'custom_user',
        name: label,
        shortLabel,
        icon: '📍',
        strip: routed.strip,
        axialZ: routed.axialZ,
        climateTag: routed.climateLabel,
        subtitle: `${routed.stripName} · 玩家自建 OSM 地块（${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}）`,
        osmCoords: { lat, lon, label },
        isCustomUserPlot: true,
      };
      this.plots.push(def);
    } else {
      def.name = label;
      def.shortLabel = shortLabel;
      def.strip = routed.strip;
      def.axialZ = routed.axialZ;
      def.climateTag = routed.climateLabel;
      def.subtitle = `${routed.stripName} · 玩家自建 OSM 地块（${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}）`;
      def.osmCoords = { lat, lon, label };
    }

    if (this.customPlotGroup) {
      this.root.remove(this.customPlotGroup);
      this.pickMeshes = this.pickMeshes.filter((m) => m.userData.plotId !== 'custom_user');
      this.beaconRings.delete('custom_user');
      this.plotGroups.delete('custom_user');
    }
    this.customPlotGroup = this.buildPlotCluster(def);
    return def;
  }

  getPlots(): CylinderPlotDef[] {
    return this.plots;
  }

  getPlotById(id: string): CylinderPlotDef | undefined {
    return this.plots.find((p) => p.id === id);
  }

  pickPlot(raycaster: THREE.Raycaster): CylinderPlotDef | null {
    for (const m of this.pickMeshes) m.visible = true;
    const hits = raycaster.intersectObjects(this.pickMeshes, false);
    for (const m of this.pickMeshes) m.visible = false;
    if (hits.length === 0) return null;
    const pid = hits[0].object.userData.plotId as string | undefined;
    if (!pid) return null;
    return this.getPlotById(pid) ?? null;
  }

  getProjectedPins(
    camera: THREE.PerspectiveCamera,
    cssWidth: number,
    cssHeight: number,
    focusedPlotId: string,
  ): ProjectedPlotPin[] {
    const out: ProjectedPlotPin[] = [];
    const anchorLocal = new THREE.Vector3(0, 4.2, 0);
    const wp = new THREE.Vector3();
    const camPos = camera.position;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toPin = new THREE.Vector3();

    this.root.updateMatrixWorld(true);
    for (const plot of this.plots) {
      const grp = this.plotGroups.get(plot.id);
      if (!grp) continue;
      wp.copy(anchorLocal).applyMatrix4(grp.matrixWorld);
      toPin.copy(wp).sub(camPos);
      const dist = toPin.length();
      if (toPin.dot(camDir) <= 1.0) continue; // behind camera

      const ndc = wp.clone().project(camera);
      if (Math.abs(ndc.x) > 0.96 || Math.abs(ndc.y) > 0.92 || ndc.z > 1) continue;

      const x = (ndc.x * 0.5 + 0.5) * cssWidth;
      const y = (-ndc.y * 0.5 + 0.5) * cssHeight;
      out.push({
        plot,
        x,
        y,
        visible: true,
        isOverhead: wp.y > 0,
        isFocused: plot.id === focusedPlotId,
        dist,
      });
    }
    return out;
  }

  applyAtmosphere(timeMode: TimeMode, renderStyle: RenderStyleId): void {
    const isNight = timeMode === 'night' || timeMode === 'eclipse';
    this.skyShellMat.map = isNight ? this.skyNightTex : this.skyDayTex;
    if (timeMode === 'sunset') {
      this.skyShellMat.color.set('#f6cfb5');
    } else if (timeMode === 'morning') {
      this.skyShellMat.color.set('#f5ebe4');
    } else if (renderStyle === 'hd' && !isNight) {
      this.skyShellMat.color.set('#d5ebf8');
    } else {
      this.skyShellMat.color.set('#ffffff');
    }
    this.skyShellMat.needsUpdate = true;

    if (this.polarBeaconMat) {
      this.polarBeaconMat.color.set(isNight ? '#a8f2ff' : '#d2f7ff');
    }
    if (this.northEndcapMat) {
      this.northEndcapMat.color.set(
        isNight ? '#182540' : timeMode === 'sunset' ? '#d9b5a0' : '#cfe2ed',
      );
    }
  }

  update(dt: number, simTime: number, focusedPlotId: string): void {
    // Animate circumferential transit trams back and forth along each continent strip
    for (const tr of this.trams) {
      const z = Math.sin(simTime * 0.16 + tr.phase) * 68;
      tr.group.position.z = z;
    }

    // Drift axis clouds softly along cylinder longitudinal wind stream
    for (const c of this.clouds) {
      c.mesh.position.z = c.baseZ + Math.sin(simTime * 0.14 + c.phase) * 7.5;
      c.mesh.position.x = c.baseX + Math.cos(simTime * 0.18 + c.phase) * 1.1;
    }

    for (const bl of this.millBlades) {
      bl.rotation.z += dt * 1.4;
    }

    for (const sb of this.sailboats) {
      sb.mesh.rotation.z = Math.sin(simTime * 2.1 + sb.phase) * 0.08;
    }

    if (this.solarRing) {
      this.solarRing.rotation.z += dt * 0.18;
    }

    const pulse = 1.0 + Math.sin(simTime * 3.8) * 0.025;
    for (const [id, ring] of this.beaconRings.entries()) {
      const active = id === focusedPlotId;
      ring.visible = active;
      if (active) {
        ring.scale.set(pulse, 1, pulse);
      }
    }
  }

  dispose(): void {
    this.skyDayTex.dispose();
    this.skyNightTex.dispose();
    for (const tex of this.stripTextures) tex.dispose();
  }
}
