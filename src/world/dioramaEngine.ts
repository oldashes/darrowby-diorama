import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CATALOG_MAP,
  InstantiatedAsset,
  ModelLibrary,
  WorldShaderUniforms,
  attachStorybookSurfaceShader,
} from '../assets/modelLibrary';
import { playPlaceSound, playRemoveSound } from '../audio/sfx';
import { InkPipeline } from '../render/inkPipeline';
import {
  CameraPresetId,
  LiveWeatherReport,
  PRESET_REGIONS,
  PlacedItemData,
  RegionBlueprint,
  RegionId,
  RenderStyleId,
  SeasonId,
  TimeMode,
  WeatherId,
  cloneBlueprint,
  computeMildWinter,
  makePlacementId,
} from './regions';
import {
  GroundBackdropWorld,
  GroundLookPreset,
  ViewMode,
  groundBowlSlopeTilt,
  groundBowlY,
} from './cylinderWorld';
import { InteriorKind, InteriorWorld } from './interiorWorld';
import {
  Collider2D,
  DoorwayTarget,
  PlayerController,
  RoomBounds,
} from './playerController';
import { SpaceSectorPin, SpaceWorld } from './spaceWorld';

export type BuildToolMode = 'view' | 'place' | 'delete';

interface LivePlacedEntry {
  data: PlacedItemData;
  asset: InstantiatedAsset;
  popAnim: number;
  baseY: number;
}

interface BreezeRibbon {
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  phase: number;
  speed: number;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  phase: number;
}

const ISLAND_HALF = 11.0;
const STORAGE_PREFIX = 'darrowby_diorama_v1_';

export function buildIslandGroundTexture(
  region: RegionBlueprint,
  season: SeasonId,
  snowy = season === 'winter' && !region.mildWinter,
): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  const grassHex = snowy
    ? region.palette.grassWinter
    : season === 'spring'
      ? region.palette.grassSpring
      : season === 'autumn'
        ? region.palette.grassAutumn
        : season === 'winter'
          ? '#92b070'
          : region.palette.grassSummer;

  ctx.fillStyle = grassHex;
  ctx.fillRect(0, 0, size, size);

  const toPx = (v: number) => ((v + ISLAND_HALF) / (ISLAND_HALF * 2)) * size;

  // Deterministic subtle meadow tuft speckles & clover dots (story-book grass texture)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.5 + rand() * 3.5;
    if (snowy) {
      ctx.fillStyle = rand() > 0.45 ? 'rgba(225,222,212,0.55)' : 'rgba(255,253,247,0.55)';
    } else if (season === 'autumn') {
      ctx.fillStyle = rand() > 0.4 ? 'rgba(164,132,74,0.34)' : 'rgba(220,188,118,0.28)';
    } else if (season === 'winter') {
      ctx.fillStyle = rand() > 0.35 ? 'rgba(116,144,82,0.26)' : 'rgba(218,214,175,0.30)';
    } else {
      ctx.fillStyle = rand() > 0.3 ? 'rgba(122,155,78,0.28)' : 'rgba(242,232,165,0.42)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawStoneRoad = (pts: Array<[number, number]>, widthUnits: number) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Road shadow/mud edge
    ctx.strokeStyle = snowy ? '#beb5a2' : '#9c8f76';
    ctx.lineWidth = ((widthUnits + 0.35) / (ISLAND_HALF * 2)) * size;
    ctx.beginPath();
    pts.forEach(([wx, wz], idx) => {
      if (idx === 0) ctx.moveTo(toPx(wx), toPx(wz));
      else ctx.lineTo(toPx(wx), toPx(wz));
    });
    ctx.stroke();

    // Inner road bed
    ctx.strokeStyle = snowy ? '#ded8c8' : region.palette.dirtPath;
    ctx.lineWidth = (widthUnits / (ISLAND_HALF * 2)) * size;
    ctx.stroke();
    ctx.restore();
  };

  if (region.waterLayout === 'brook_pond') {
    drawStoneRoad(
      [
        [-11.2, -1.5],
        [-5.2, -1.6],
        [-1.0, 0.2],
        [1.2, 0.8],
        [4.8, 3.0],
        [11.2, 3.4],
      ],
      1.9,
    );
    // Side lane to stable & mill
    drawStoneRoad(
      [
        [-5.4, -1.4],
        [-5.4, 2.2],
      ],
      1.3,
    );
    // Carve brook & duck pond bank bed
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = snowy ? '#a5b5b8' : '#7b897a';
    ctx.lineWidth = (2.2 / (ISLAND_HALF * 2)) * size;
    ctx.beginPath();
    ctx.moveTo(toPx(4.8), toPx(-11.2));
    ctx.quadraticCurveTo(toPx(2.2), toPx(-3.0), toPx(0.2), toPx(1.8));
    ctx.quadraticCurveTo(toPx(-1.8), toPx(6.2), toPx(-0.8), toPx(11.2));
    ctx.stroke();

    ctx.fillStyle = snowy ? '#a5b5b8' : '#7b897a';
    ctx.beginPath();
    ctx.ellipse(toPx(-1.5), toPx(6.6), toPx(-1.5 + 3.2) - toPx(-1.5), toPx(6.6 + 2.5) - toPx(6.6), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (region.waterLayout === 'canal_pond') {
    // Wangshi main village road + spurs to twin bridges
    drawStoneRoad(
      [
        [-11.0, -3.4],
        [-5.0, -3.4],
        [-1.8, -2.5],
        [3.6, -2.5],
      ],
      1.75,
    );
    drawStoneRoad(
      [
        [-4.2, -7.8],
        [-4.2, 2.8],
        [-1.6, 5.2],
        [4.0, 5.2],
      ],
      1.65,
    );
    // Lotus pond rim (SW corner)
    ctx.fillStyle = '#7b8c74';
    ctx.beginPath();
    ctx.ellipse(toPx(-5.6), toPx(6.8), 165, 118, 0, 0, Math.PI * 2);
    ctx.fill();
    // Canal bed along x = +1.1
    ctx.fillStyle = '#75877b';
    ctx.fillRect(toPx(0.05), 0, (2.1 / (ISLAND_HALF * 2)) * size, size);

    // Terraced Golden Rice Paddy plots (East side)
    if (region.hasPaddies) {
      const plots: Array<[number, number, number, number]> = [
        [4.2, -8.8, 4.8, 3.6],
        [4.2, -4.6, 4.8, 3.6],
        [4.2, -0.4, 4.8, 3.6],
        [4.2, 3.8, 4.8, 4.4],
      ];
      for (const [px, pz, pw, ph] of plots) {
        ctx.fillStyle = '#8b8362'; // earthen bund
        ctx.fillRect(
          toPx(px - 0.15),
          toPx(pz - 0.15),
          ((pw + 0.3) / (ISLAND_HALF * 2)) * size,
          ((ph + 0.3) / (ISLAND_HALF * 2)) * size,
        );
        ctx.fillStyle = snowy ? '#b8d0d6' : season === 'autumn' ? '#d4b85b' : '#b7cb66';
        ctx.fillRect(
          toPx(px),
          toPx(pz),
          (pw / (ISLAND_HALF * 2)) * size,
          (ph / (ISLAND_HALF * 2)) * size,
        );
      }
    }
  } else if (region.waterLayout === 'osm_custom' && region.osmData) {
    const osm = region.osmData;
    const fillPoly = (pts: Array<[number, number]>, color: string) => {
      if (pts.length < 3) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach(([wx, wz], idx) => {
        if (idx === 0) ctx.moveTo(toPx(wx), toPx(wz));
        else ctx.lineTo(toPx(wx), toPx(wz));
      });
      ctx.closePath();
      ctx.fill();
    };

    // 1. OSM parks, woods & farmland
    for (const g of osm.greens) {
      if (g.kind === 'farmland') {
        fillPoly(
          g.points,
          snowy ? '#b8d0d6' : season === 'autumn' ? '#d4b85b' : '#b5c966',
        );
      } else if (g.kind === 'wood') {
        fillPoly(
          g.points,
          snowy
            ? 'rgba(210,214,210,0.72)'
            : season === 'autumn'
              ? 'rgba(182,134,62,0.72)'
              : 'rgba(116,152,92,0.72)',
        );
      } else {
        fillPoly(
          g.points,
          snowy
            ? 'rgba(224,224,218,0.68)'
            : season === 'autumn'
              ? 'rgba(196,156,86,0.65)'
              : 'rgba(148,186,114,0.65)',
        );
      }
    }

    // 2. OSM lakes, rivers & canals bank rims
    const bankCol = snowy ? '#a5b5b8' : '#7b897a';
    for (const w of osm.waters) {
      if (w.isPolygon) {
        fillPoly(w.points, bankCol);
      } else if (w.points.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = bankCol;
        ctx.lineWidth = ((w.width + 0.45) / (ISLAND_HALF * 2)) * size;
        ctx.beginPath();
        w.points.forEach(([wx, wz], idx) => {
          if (idx === 0) ctx.moveTo(toPx(wx), toPx(wz));
          else ctx.lineTo(toPx(wx), toPx(wz));
        });
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. OSM street network (sorted footways first, primary avenues last)
    const sortedRoads = [...osm.roads].sort((a, b) => a.width - b.width);
    for (const rd of sortedRoads) {
      if (rd.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = snowy ? '#b8b09e' : '#a49880';
      ctx.lineWidth = ((rd.width + 0.28) / (ISLAND_HALF * 2)) * size;
      ctx.beginPath();
      rd.points.forEach(([wx, wz], idx) => {
        if (idx === 0) ctx.moveTo(toPx(wx), toPx(wz));
        else ctx.lineTo(toPx(wx), toPx(wz));
      });
      ctx.stroke();

      ctx.strokeStyle =
        rd.kind === 'footway'
          ? snowy
            ? '#e2ded2'
            : '#dfd5bf'
          : snowy
            ? '#dcd8cc'
            : '#cbc3b2';
      ctx.lineWidth = (rd.width / (ISLAND_HALF * 2)) * size;
      ctx.stroke();
      ctx.restore();
    }
  } else if (region.waterLayout === 'harbour_bay') {
    // Golden Sydney sandstone promenade & headland path
    drawStoneRoad(
      [
        [-10.8, -3.2],
        [-3.6, -2.8],
        [1.8, -1.0],
        [7.4, -2.0],
      ],
      1.75,
    );
    drawStoneRoad(
      [
        [-5.2, -2.8],
        [-5.6, 5.2],
      ],
      1.35,
    );

    // Warm crescent sandy beach curve along SE cove
    ctx.fillStyle = snowy ? '#dcd8cc' : '#ebd6a3';
    ctx.beginPath();
    ctx.moveTo(toPx(-4.0), toPx(11.2));
    ctx.quadraticCurveTo(toPx(-3.4), toPx(1.7), toPx(2.8), toPx(1.25));
    ctx.quadraticCurveTo(toPx(7.4), toPx(1.05), toPx(11.2), toPx(1.45));
    ctx.lineTo(toPx(11.2), toPx(11.2));
    ctx.closePath();
    ctx.fill();

    // Rich turquoise cove seabed (matches 3D water shape)
    ctx.fillStyle = snowy ? '#a3bdc4' : '#3a98ad';
    ctx.beginPath();
    ctx.moveTo(toPx(-3.2), toPx(11.2));
    ctx.quadraticCurveTo(toPx(-2.7), toPx(2.5), toPx(2.8), toPx(2.0));
    ctx.quadraticCurveTo(toPx(7.2), toPx(1.8), toPx(11.2), toPx(2.1));
    ctx.lineTo(toPx(11.2), toPx(11.2));
    ctx.closePath();
    ctx.fill();

    // Scattered Jacaranda violet petals along Kirribilli avenue & lawns in spring/summer
    if (season === 'summer' || season === 'spring') {
      const petalSpots: Array<[number, number]> = [
        [-8.4, -5.8],
        [-3.8, -7.8],
        [0.8, -4.4],
        [-5.2, 1.4],
        [7.6, -5.6],
        [8.4, -0.6],
      ];
      for (const [jx, jz] of petalSpots) {
        for (let p = 0; p < 24; p++) {
          const ang = p * 2.39996;
          const rad = 0.25 + ((p * 37) % 100) * 0.015;
          const px = toPx(jx + Math.cos(ang) * rad);
          const pz = toPx(jz + Math.sin(ang) * rad);
          ctx.fillStyle = p % 2 === 0 ? 'rgba(154, 123, 224, 0.38)' : 'rgba(182, 152, 240, 0.34)';
          ctx.beginPath();
          ctx.arc(px, pz, 2.2 + (p % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else {
    // Otaru stone wharf quays flanking straight canal x=0
    ctx.fillStyle = snowy ? '#cbd0d4' : '#aeb3b8';
    ctx.fillRect(toPx(-4.2), 0, (8.4 / (ISLAND_HALF * 2)) * size, size);
    ctx.fillStyle = '#6c7c88';
    ctx.fillRect(toPx(-1.55), 0, (3.1 / (ISLAND_HALF * 2)) * size, size);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function buildCliffTexture(region: RegionBlueprint): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = region.palette.cliffSoil;
  ctx.fillRect(0, 0, 512, 128);

  // Top overhanging rock strata + lower soil bands
  ctx.fillStyle = region.palette.cliffRock;
  ctx.fillRect(0, 0, 512, 52);

  let s = 421;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 64; i++) {
    const x = rnd() * 512;
    const y = rnd() * 44;
    const w = 18 + rnd() * 48;
    const h = 8 + rnd() * 14;
    ctx.fillStyle = rnd() > 0.5 ? '#8e887d' : '#656058';
    ctx.fillRect(x, y, w, h);
  }
  for (let i = 0; i < 42; i++) {
    const x = rnd() * 512;
    const y = 54 + rnd() * 68;
    ctx.fillStyle = rnd() > 0.5 ? '#544537' : '#6f5c4a';
    ctx.fillRect(x, y, 22 + rnd() * 55, 6 + rnd() * 10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function buildOsmFacadeTexture(wallHex: string, isHighrise: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 128, 128);

  // Subtle floor stringcourse bands & architectural ink window panes
  ctx.fillStyle = 'rgba(92, 82, 72, 0.14)';
  for (let y = 0; y < 128; y += 32) {
    ctx.fillRect(0, y, 128, 2);
  }

  for (let row = 0; row < 4; row++) {
    const wy = row * 32 + 8;
    for (let col = 0; col < 4; col++) {
      const wx = col * 32 + 7;
      ctx.fillStyle = isHighrise ? '#6c8599' : '#657a8a';
      ctx.fillRect(wx, wy, 18, 16);
      ctx.fillStyle = 'rgba(232, 240, 246, 0.36)';
      ctx.fillRect(wx + 2, wy + 2, 6, 12);
      ctx.strokeStyle = 'rgba(42, 36, 30, 0.42)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx, wy, 18, 16);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.32, 0.36);
  tex.needsUpdate = true;
  return tex;
}

export class DioramaEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly spaceScene = new THREE.Scene();
  readonly interiorScene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly groundCamera: THREE.PerspectiveCamera;
  readonly spaceCamera: THREE.PerspectiveCamera;
  readonly interiorCamera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly spaceControls: OrbitControls;
  private pipeline = new InkPipeline();
  private models = new ModelLibrary();
  private groundBackdrop: GroundBackdropWorld;
  private spaceWorld: SpaceWorld;
  private interiorWorld: InteriorWorld;

  private uniforms: WorldShaderUniforms = {
    uSnowCoverage: { value: 1.0 },
    uWindowGlow: { value: 0.0 },
    uUmbraOffset: { value: -24.0 },
    uUmbraWidth: { value: 6.8 },
    uUmbraStrength: { value: 0.0 },
    uSkyTint: { value: new THREE.Color('#ffffff') },
  };

  private hemiLight = new THREE.HemisphereLight('#d6e5f2', '#9b8d79', 1.18);
  private sunLight = new THREE.DirectionalLight('#fff2da', 1.65);
  private spaceHemi = new THREE.HemisphereLight('#d8e8f8', '#526074', 0.85);
  private spaceSun = new THREE.DirectionalLight('#fff4de', 2.05);

  private islandGroup = new THREE.Group();
  private placedGroup = new THREE.Group();
  private festiveGroup = new THREE.Group();
  private fxGroup = new THREE.Group();
  private ghostGroup = new THREE.Group();
  private waterMeshes: THREE.Mesh[] = [];
  private icicleGroup = new THREE.Group();
  private cascadeGroup = new THREE.Group();
  private groundMesh: THREE.Mesh | null = null;
  private cliffMesh: THREE.Mesh | null = null;
  private groundMat: THREE.MeshLambertMaterial | null = null;
  private cliffMat: THREE.MeshLambertMaterial | null = null;
  private waterMat: THREE.MeshLambertMaterial | null = null;
  private cliffTex: THREE.CanvasTexture | null = null;
  private groundTex: THREE.CanvasTexture | null = null;
  private osmTextures: THREE.CanvasTexture[] = [];

  private breezeRibbons: BreezeRibbon[] = [];
  private smokePuffs: SmokePuff[] = [];
  private weatherPoints: THREE.Points | null = null;
  private weatherPositions = new Float32Array(520 * 3);
  private weatherGeo: THREE.BufferGeometry | null = null;
  private weatherMat: THREE.PointsMaterial | null = null;

  private placedEntries: LivePlacedEntry[] = [];
  private festiveEntries: LivePlacedEntry[] = [];
  private raycaster = new THREE.Raycaster();
  private pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);

  // Public reactive state
  private viewMode: ViewMode = 'ground';
  private groundPreset: GroundLookPreset = 'street';
  private interiorKind: InteriorKind = 'tavern';
  private fpYaw = 0.04;
  private targetFpYaw = 0.04;
  private fpPitch = 0.14;
  private targetFpPitch = 0.14;
  private groundCamDist = 4.6;
  private targetGroundCamDist = 4.6;
  private walkTime = 0;

  private inYaw = 0.22;
  private targetInYaw = 0.22;
  private inPitch = 0.08;
  private targetInPitch = 0.08;
  private inCamDist = 2.65;
  private targetInCamDist = 2.65;

  private player: PlayerController;
  private outdoorColliders: Collider2D[] = [];
  private outdoorSavedPos = new THREE.Vector2(-0.4, 2.2);
  private nearbyDoor: DoorwayTarget | null = null;
  private readonly outdoorBounds: RoomBounds = { minX: -118, maxX: 118, minZ: -165, maxZ: 85 };

  private region: RegionBlueprint = cloneBlueprint(PRESET_REGIONS.sydney);
  private season: SeasonId = 'summer';
  private timeMode: TimeMode = 'day';
  private weather: WeatherId = 'breeze';
  private renderStyle: RenderStyleId = 'pocket';
  private activeSpecialSceneId: string | null = null;
  private cameraTween: { targetAz: number; targetPol: number; targetZoom: number } | null = null;

  private toolMode: BuildToolMode = 'view';
  private selectedCatalogId = 'jacaranda_tree';
  private previewRotY = 0;
  private hoverValid = false;
  private hoverPoint = new THREE.Vector3();
  private deleteHighlightEntry: LivePlacedEntry | null = null;
  private customSavedPositions = new Map<string, PlacedItemData[]>();

  private simTime = 0;
  private manualEclipseOffset: number | null = null;
  private modelsLoaded = false;
  private readyFired = false;
  private frustumSize = 23.5;
  private skyTopHex = '#47688a';
  private skyBotHex = '#a8c2d4';

  constructor(
    private canvas: HTMLCanvasElement,
    private onStateChanged?: () => void,
    private onModelsReady?: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor('#13161e', 1);
    this.scene.background = new THREE.Color('#13161e');

    const aspect = Math.max(0.4, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.5,
      120,
    );
    this.camera.position.set(18.5, 16.5, 18.5);
    this.camera.lookAt(0, 0.3, 0);

    this.groundCamera = new THREE.PerspectiveCamera(aspect < 1.0 ? 68 : 58, aspect, 0.25, 1800);
    this.groundCamera.rotation.order = 'YXZ';
    this.groundCamera.position.set(0, 1.8, 7.6);
    this.groundCamera.lookAt(-0.4, 1.4, 2.2);

    this.spaceCamera = new THREE.PerspectiveCamera(aspect < 1.0 ? 54 : 44, aspect, 0.5, 1200);
    this.spaceCamera.position.set(42, 16, 68);
    this.spaceCamera.lookAt(0, 0, 0);

    this.interiorCamera = new THREE.PerspectiveCamera(aspect < 1.0 ? 70 : 62, aspect, 0.1, 80);
    this.interiorCamera.rotation.order = 'YXZ';
    this.interiorCamera.position.set(0.8, 1.6, 4.1);
    this.interiorCamera.lookAt(0.2, 1.4, 2.1);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minZoom = 0.65;
    this.controls.maxZoom = 2.6;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.24;
    this.controls.target.set(0, 0.35, 0);
    this.controls.enabled = this.viewMode === 'plot';
    this.controls.update();
    this.controls.addEventListener('start', () => {
      this.cameraTween = null;
    });

    this.spaceControls = new OrbitControls(this.spaceCamera, canvas);
    this.spaceControls.enableDamping = true;
    this.spaceControls.dampingFactor = 0.07;
    this.spaceControls.enablePan = false;
    this.spaceControls.minDistance = 24;
    this.spaceControls.maxDistance = 135;
    this.spaceControls.target.set(0, 0, 0);
    this.spaceControls.enabled = this.viewMode === 'space';
    this.spaceControls.update();

    this.sunLight.position.set(16, 22, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 65;
    const sh = 14.5;
    this.sunLight.shadow.camera.left = -sh;
    this.sunLight.shadow.camera.right = sh;
    this.sunLight.shadow.camera.top = sh;
    this.sunLight.shadow.camera.bottom = -sh;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.03;

    this.scene.add(this.hemiLight);
    this.scene.add(this.sunLight);
    this.scene.add(this.islandGroup);
    this.scene.add(this.placedGroup);
    this.scene.add(this.festiveGroup);
    this.scene.add(this.fxGroup);
    this.scene.add(this.ghostGroup);

    this.groundBackdrop = new GroundBackdropWorld(this.scene, this.uniforms);

    this.player = new PlayerController(this.uniforms);
    const [initX, initZ] = this.getRegionSpawn(this.region.id);
    this.outdoorSavedPos.set(initX, initZ);
    this.player.teleport(initX, initZ, groundBowlY(initX, initZ), Math.PI);
    this.scene.add(this.player.avatar.root);

    this.spaceSun.position.set(55, 40, 38);
    this.spaceScene.add(this.spaceHemi, this.spaceSun);
    this.spaceWorld = new SpaceWorld(this.spaceScene, this.uniforms);

    this.interiorWorld = new InteriorWorld(this.interiorScene, this.uniforms);

    this.initWeatherAndFx();
    this.rebuildIslandGeometry();
    this.rebuildPlayerColliders();
    this.applyAtmosphere();
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);

    void this.models.loadAll().then(() => {
      this.modelsLoaded = true;
      this.loadRegionPlacementsFromStorage();
      this.rebuildPlacedModels();
      this.rebuildGhostPreview();
      this.onModelsReady?.();
      this.onStateChanged?.();
    });
  }

  isSnowyGround(): boolean {
    if (this.weather === 'snow') return true;
    if (this.season !== 'winter') return false;
    return !this.region.mildWinter;
  }

  getState() {
    let buildings = this.region.osmData?.buildings.length ?? 0;
    let nature = 0;
    let living = 0;
    for (const e of [...this.placedEntries, ...this.festiveEntries]) {
      const cat = CATALOG_MAP.get(e.data.catalogId)?.category;
      if (cat === 'building') buildings += 1;
      else if (cat === 'living') living += 1;
      else if (cat === 'nature') nature += 1;
    }

    const pSnap = this.player.getSnapshot();
    return {
      viewMode: this.viewMode,
      groundPreset: this.groundPreset,
      interiorKind: this.interiorKind,
      fpYaw: this.fpYaw,
      fpPitch: this.fpPitch,
      inYaw: this.inYaw,
      inPitch: this.inPitch,
      playerX: pSnap.x,
      playerY: pSnap.y,
      playerZ: pSnap.z,
      playerFacing: pSnap.facingYaw,
      playerSpeed: pSnap.speed,
      grounded: pSnap.grounded,
      isGliding: pSnap.isGliding,
      isSprinting: pSnap.isSprinting || this.player.isSprintToggled(),
      sprintToggled: this.player.isSprintToggled(),
      heightAboveGround: pSnap.heightAboveGround,
      nearbyDoor: this.nearbyDoor,
      region: this.region,
      season: this.season,
      timeMode: this.timeMode,
      weather: this.weather,
      renderStyle: this.renderStyle,
      mildWinter: Boolean(this.region.mildWinter),
      isSnowyGround: this.isSnowyGround(),
      activeSpecialSceneId: this.activeSpecialSceneId,
      toolMode: this.toolMode,
      selectedCatalogId: this.selectedCatalogId,
      previewRotY: this.previewRotY,
      modelsLoaded: this.modelsLoaded,
      placedCount: this.placedEntries.length,
      osmBuildingCount: this.region.osmData?.buildings.length ?? 0,
      osmRoadCount: this.region.osmData?.roads.length ?? 0,
      osmWaterCount: this.region.osmData?.waters.length ?? 0,
      legendCounts: { buildings, nature, living },
      cameraAzimuth: this.controls.getAzimuthalAngle(),
      cameraPolar: this.controls.getPolarAngle(),
      cameraZoom: this.camera.zoom,
    };
  }

  private initWeatherAndFx(): void {
    // 520 snow/rain/petal particles
    this.weatherGeo = new THREE.BufferGeometry();
    for (let i = 0; i < 520; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 23;
      this.weatherPositions[i * 3 + 1] = Math.random() * 11;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 23;
    }
    this.weatherGeo.setAttribute('position', new THREE.BufferAttribute(this.weatherPositions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.17,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.weatherPoints = new THREE.Points(this.weatherGeo, this.weatherMat);
    this.fxGroup.add(this.weatherPoints);

    // 4 Quack-style translucent white curving wind breeze ribbons
    const windMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.6, 0.0, 0.3),
        new THREE.Vector3(-0.8, 0.25, -0.2),
        new THREE.Vector3(0.9, 0.55, 0.15),
        new THREE.Vector3(2.4, 0.35, -0.3),
      ]);
      const geo = new THREE.TubeGeometry(curve, 18, 0.032, 5, false);
      const mesh = new THREE.Mesh(geo, windMat);
      mesh.position.set(-4 + i * 2.5, 2.05 + (i % 2) * 0.85, -4 + i * 2.3);
      this.fxGroup.add(mesh);
      this.breezeRibbons.push({
        mesh,
        baseX: mesh.position.x,
        baseZ: mesh.position.z,
        phase: i * 1.6,
        speed: 0.55 + i * 0.08,
      });
    }
  }

  private rebuildIslandGeometry(): void {
    while (this.islandGroup.children.length > 0) {
      const ch = this.islandGroup.children[0];
      this.islandGroup.remove(ch);
    }
    this.fxGroup.remove(this.cascadeGroup);
    this.fxGroup.remove(this.icicleGroup);
    this.waterMeshes = [];
    this.groundTex?.dispose();
    this.cliffTex?.dispose();
    for (const tex of this.osmTextures) tex.dispose();
    this.osmTextures = [];

    const snowy = this.isSnowyGround();
    this.groundBackdrop.rebuildForRegion(this.region, this.season, snowy);
    this.groundBackdrop.root.visible = this.viewMode === 'ground';
    this.groundTex = buildIslandGroundTexture(this.region, this.season, snowy);
    this.cliffTex = buildCliffTexture(this.region);

    this.groundMat = new THREE.MeshLambertMaterial({
      map: this.groundTex,
      flatShading: true,
    });
    attachStorybookSurfaceShader(this.groundMat, this.uniforms, { snowCap: false, isWindow: false });

    this.cliffMat = new THREE.MeshLambertMaterial({
      map: this.cliffTex,
      flatShading: true,
    });
    attachStorybookSurfaceShader(this.cliffMat, this.uniforms, { snowCap: false, isWindow: false });

    // Top Turf Slab (22 x 22)
    const topGeo = new THREE.BoxGeometry(ISLAND_HALF * 2, 0.28, ISLAND_HALF * 2);
    this.groundMesh = new THREE.Mesh(topGeo, this.groundMat);
    this.groundMesh.position.set(0, -0.14, 0);
    this.groundMesh.receiveShadow = true;
    this.groundMesh.castShadow = true;
    this.islandGroup.add(this.groundMesh);

    // Carved Layered Cliff Base (21.65 x 2.75 x 21.65) so turf edge slightly overhangs cleanly in plot mode!
    const baseGeo = new THREE.BoxGeometry(ISLAND_HALF * 2 - 0.34, 2.75, ISLAND_HALF * 2 - 0.34);
    const baseMesh = new THREE.Mesh(baseGeo, this.cliffMat);
    baseMesh.position.set(0, -1.65, 0);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    baseMesh.visible = this.viewMode === 'plot';
    this.cliffMesh = baseMesh;
    this.islandGroup.add(baseMesh);

    // Translucent Ice / Water Overlay + Waterfall Cascade & Hanging Winter Icicles
    const isFrozen = snowy;
    this.waterMat = new THREE.MeshLambertMaterial({
      color: isFrozen ? this.region.palette.iceTop : this.region.palette.waterTop,
      transparent: true,
      opacity: isFrozen ? 0.88 : 0.78,
      flatShading: true,
    });
    attachStorybookSurfaceShader(this.waterMat, this.uniforms, { snowCap: false, isWindow: false });

    this.icicleGroup = new THREE.Group();
    this.cascadeGroup = new THREE.Group();

    const addWaterStrip = (w: number, d: number, x: number, z: number, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), this.waterMat!);
      m.position.set(x, 0.015, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      this.islandGroup.add(m);
      this.waterMeshes.push(m);
    };

    let fallX = -0.8;
    if (this.region.waterLayout === 'brook_pond') {
      addWaterStrip(1.55, 9.8, 2.8, -5.8, -0.35);
      addWaterStrip(1.55, 8.8, 0.0, 2.0, -0.25);
      const pondGeo = new THREE.CylinderGeometry(2.85, 2.85, 0.04, 20);
      const pond = new THREE.Mesh(pondGeo, this.waterMat);
      pond.scale.set(1.05, 1, 0.82);
      pond.position.set(-1.5, 0.015, 6.6);
      pond.receiveShadow = true;
      this.islandGroup.add(pond);
      this.waterMeshes.push(pond);
      addWaterStrip(2.1, 3.6, -0.8, 9.2, 0.05);
      fallX = -0.8;
    } else if (this.region.waterLayout === 'canal_pond') {
      addWaterStrip(1.75, 22.0, 1.1, 0, 0);
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.04, 20), this.waterMat);
      pond.scale.set(1.18, 1, 0.84);
      pond.position.set(-5.6, 0.015, 6.8);
      pond.receiveShadow = true;
      this.islandGroup.add(pond);
      this.waterMeshes.push(pond);
      fallX = 1.1;
    } else if (this.region.waterLayout === 'osm_custom' && this.region.osmData) {
      const osm = this.region.osmData;
      // 3D OSM Waterbodies (canal/river/lake)
      for (const w of osm.waters) {
        if (w.isPolygon && w.points.length >= 3) {
          const shape = new THREE.Shape();
          w.points.forEach(([x, z], idx) => {
            if (idx === 0) shape.moveTo(x, -z);
            else shape.lineTo(x, -z);
          });
          shape.closePath();
          const wGeo = new THREE.ShapeGeometry(shape);
          wGeo.rotateX(-Math.PI / 2);
          const wm = new THREE.Mesh(wGeo, this.waterMat);
          wm.position.y = 0.02;
          wm.receiveShadow = true;
          this.islandGroup.add(wm);
          this.waterMeshes.push(wm);
        } else if (w.points.length >= 2) {
          for (let i = 0; i < w.points.length - 1; i++) {
            const [ax, az] = w.points[i];
            const [bx, bz] = w.points[i + 1];
            const segLen = Math.hypot(bx - ax, bz - az);
            if (segLen < 0.08) continue;
            const wm = new THREE.Mesh(
              new THREE.BoxGeometry(segLen + w.width * 0.35, 0.04, w.width),
              this.waterMat,
            );
            wm.position.set((ax + bx) * 0.5, 0.018, (az + bz) * 0.5);
            wm.rotation.y = -Math.atan2(bz - az, bx - ax);
            wm.receiveShadow = true;
            this.islandGroup.add(wm);
            this.waterMeshes.push(wm);
          }
        }
      }
      if (osm.waters.length > 0 && osm.waters[0].points.length > 0) {
        fallX = Math.max(-7.5, Math.min(7.5, osm.waters[0].points[0][0]));
      }

      // 3D Extruded Real-World Architectural Buildings from OSM footprints
      if (osm.buildings.length > 0) {
        const wallHexes = ['#ece4d4', '#dfbeab', '#d5dcd0', '#e7d5b0'];
        const wallMats = wallHexes.map((hex, idx) => {
          const tex = buildOsmFacadeTexture(hex, idx === 2);
          this.osmTextures.push(tex);
          const m = new THREE.MeshLambertMaterial({ map: tex, flatShading: true });
          attachStorybookSurfaceShader(m, this.uniforms, { snowCap: true, isWindow: false });
          return m;
        });
        const roofHexes = [this.region.palette.roofTone, '#b86e54', '#5c6a78', '#7d7a72'];
        const roofMats = roofHexes.map((hex) => {
          const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true });
          attachStorybookSurfaceShader(m, this.uniforms, { snowCap: true, isWindow: false });
          return m;
        });
        const glowWinMat = new THREE.MeshLambertMaterial({ color: '#6b7d8e', flatShading: true });
        attachStorybookSurfaceShader(glowWinMat, this.uniforms, { snowCap: false, isWindow: true });

        osm.buildings.forEach((b, bIdx) => {
          if (b.points.length < 3) return;
          const shape = new THREE.Shape();
          b.points.forEach(([x, z], idx) => {
            if (idx === 0) shape.moveTo(x, -z);
            else shape.lineTo(x, -z);
          });
          shape.closePath();

          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: b.height,
            bevelEnabled: false,
            curveSegments: 1,
          });
          geo.rotateX(-Math.PI / 2);

          const wMat = wallMats[bIdx % wallMats.length];
          const rMat = roofMats[bIdx % roofMats.length];
          const mesh = new THREE.Mesh(geo, [rMat, wMat]);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.islandGroup.add(mesh);

          // Low-rise pitched roof crown on smaller houses for Pocket City silhouette charm
          if (b.levels <= 4 && b.width > 0.7 && b.depth > 0.7 && b.width < 4.5 && b.depth < 4.5) {
            const major = Math.max(b.width, b.depth) * 0.72;
            const minor = Math.min(b.width, b.depth) * 0.62;
            const pitchMesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.45, minor * 0.62), Math.min(0.65, major * 0.25), 4), rMat);
            pitchMesh.position.set(b.cx, b.height + Math.min(0.3, major * 0.12), b.cz);
            pitchMesh.rotation.y = b.rotY + Math.PI * 0.25;
            pitchMesh.castShadow = true;
            this.islandGroup.add(pitchMesh);
          }

          // Night-time lit window accent collar hugging exact OSM footprint
          if (b.width > 0.6 && b.depth > 0.6) {
            const winShape = new THREE.Shape();
            b.points.forEach(([x, z], idx) => {
              const sx = b.cx + (x - b.cx) * 1.012;
              const sz = b.cz + (z - b.cz) * 1.012;
              if (idx === 0) winShape.moveTo(sx, -sz);
              else winShape.lineTo(sx, -sz);
            });
            winShape.closePath();
            const bandDepth = Math.min(0.28, b.height * 0.22);
            const winGeo = new THREE.ExtrudeGeometry(winShape, {
              depth: bandDepth,
              bevelEnabled: false,
              curveSegments: 1,
            });
            winGeo.rotateX(-Math.PI / 2);
            const winBand = new THREE.Mesh(winGeo, glowWinMat);
            winBand.position.y = Math.min(b.height * 0.44, 1.15);
            this.islandGroup.add(winBand);
          }
        });
      }
    } else if (this.region.waterLayout === 'harbour_bay') {
      // Smooth curved translucent 3D turquoise harbour cove
      const bayShape = new THREE.Shape();
      bayShape.moveTo(-3.2, -11.0);
      bayShape.quadraticCurveTo(-2.7, -2.5, 2.8, -2.0);
      bayShape.quadraticCurveTo(7.2, -1.8, 11.0, -2.1);
      bayShape.lineTo(11.0, -11.0);
      bayShape.closePath();
      const bayGeo = new THREE.ShapeGeometry(bayShape);
      bayGeo.rotateX(-Math.PI / 2);
      const bayMesh = new THREE.Mesh(bayGeo, this.waterMat);
      bayMesh.position.y = 0.02;
      bayMesh.receiveShadow = true;
      this.islandGroup.add(bayMesh);
      this.waterMeshes.push(bayMesh);

      // 3D wooden ferry pier / jetty extending into cove (x = -1.6, z = 1.8..6.4)
      const deckMat = new THREE.MeshLambertMaterial({ color: '#9c7651', flatShading: true });
      const pilingMat = new THREE.MeshLambertMaterial({ color: '#5b4432', flatShading: true });
      const pierLampMat = new THREE.MeshLambertMaterial({ color: '#ffe594', flatShading: true });
      attachStorybookSurfaceShader(deckMat, this.uniforms, { snowCap: true, isWindow: false });
      attachStorybookSurfaceShader(pilingMat, this.uniforms, { snowCap: false, isWindow: false });
      attachStorybookSurfaceShader(pierLampMat, this.uniforms, {
        snowCap: false,
        isWindow: false,
        isLantern: true,
      });

      const beamGeo = new THREE.BoxGeometry(0.11, 0.08, 4.65);
      for (const bx of [-1.96, -1.24]) {
        const beam = new THREE.Mesh(beamGeo, pilingMat);
        beam.position.set(bx, 0.09, 4.1);
        beam.castShadow = true;
        this.islandGroup.add(beam);
      }

      const plankGeo = new THREE.BoxGeometry(1.12, 0.06, 0.32);
      for (let pz = 1.9; pz <= 6.35; pz += 0.39) {
        const plank = new THREE.Mesh(plankGeo, deckMat);
        plank.position.set(-1.6, 0.145, pz);
        plank.castShadow = true;
        plank.receiveShadow = true;
        this.islandGroup.add(plank);
      }

      const pilingGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.38, 6);
      for (const pz of [2.4, 3.8, 5.1, 6.25]) {
        for (const px of [-2.02, -1.18]) {
          const post = new THREE.Mesh(pilingGeo, pilingMat);
          post.position.set(px, 0.14, pz);
          post.castShadow = true;
          this.islandGroup.add(post);
        }
      }
      const pierLamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 0.14), pierLampMat);
      pierLamp.position.set(-1.18, 0.42, 6.25);
      this.islandGroup.add(pierLamp);

      fallX = 3.8;
    } else {
      addWaterStrip(2.6, 22.0, 0, 0, 0);
      fallX = 0.0;
    }

    const hasSurfaceWater =
      this.region.waterLayout !== 'osm_custom' || (this.region.osmData?.waters.length ?? 0) > 0;

    // Waterfall cascading off the front cliff (or hanging crystalline icicles in winter!)
    const cascMat = new THREE.MeshLambertMaterial({
      color: '#a8d9e8',
      transparent: true,
      opacity: 0.72,
      flatShading: true,
    });
    const cascMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.05, 0.16), cascMat);
    cascMesh.position.set(fallX, -1.50, ISLAND_HALF + 0.02);
    this.cascadeGroup.add(cascMesh);
    for (let f = -0.65; f <= 0.65; f += 0.32) {
      const foam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), new THREE.MeshLambertMaterial({ color: '#eef7fb' }));
      foam.position.set(fallX + f, -2.95, ISLAND_HALF + 0.12);
      this.cascadeGroup.add(foam);
    }

    const iceMat = new THREE.MeshLambertMaterial({
      color: '#d8eef7',
      transparent: true,
      opacity: 0.86,
      flatShading: true,
    });
    for (let i = 0; i < 12; i++) {
      const ix = fallX - 0.9 + (i / 11) * 1.8;
      const len = 0.85 + ((i * 37) % 10) * 0.16;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, len, 5), iceMat);
      cone.rotation.x = Math.PI;
      cone.position.set(ix, -0.24 - len * 0.5, ISLAND_HALF + 0.04);
      this.icicleGroup.add(cone);
    }

    this.cascadeGroup.visible = hasSurfaceWater && !isFrozen;
    this.icicleGroup.visible = hasSurfaceWater && isFrozen;
    this.fxGroup.add(this.cascadeGroup);
    this.fxGroup.add(this.icicleGroup);

    // 3D Terraced Rice Paddy Bunds & Crop Rows when hasPaddies is active (Wangshi!)
    if (this.region.hasPaddies) {
      const bundMat = new THREE.MeshLambertMaterial({
        color: isFrozen ? '#b8b09c' : '#857c5e',
        flatShading: true,
      });
      attachStorybookSurfaceShader(bundMat, this.uniforms, { snowCap: true, isWindow: false });

      const riceCol =
        this.season === 'autumn'
          ? '#d6b64c'
          : this.season === 'spring'
            ? '#8ec258'
            : '#a8ca54';
      const cropMat = new THREE.MeshLambertMaterial({ color: riceCol, flatShading: true });
      attachStorybookSurfaceShader(cropMat, this.uniforms, { snowCap: true, isWindow: false });

      const plots: Array<[number, number, number, number]> = [
        [4.2, -8.8, 4.8, 3.6],
        [4.2, -4.6, 4.8, 3.6],
        [4.2, -0.4, 4.8, 3.6],
        [4.2, 3.8, 4.8, 4.4],
      ];
      const bundGeoH = new THREE.BoxGeometry(5.1, 0.14, 0.24);
      const bundGeoV = new THREE.BoxGeometry(0.24, 0.14, 3.8);
      const tuftGeo = new THREE.BoxGeometry(0.42, 0.24, 0.36);

      for (const [px, pz, pw, ph] of plots) {
        const cx = px + pw * 0.5;
        const cz = pz + ph * 0.5;
        const bTop = new THREE.Mesh(bundGeoH, bundMat);
        bTop.position.set(cx, 0.05, pz);
        bTop.castShadow = true;
        bTop.receiveShadow = true;
        this.islandGroup.add(bTop);

        const bBot = new THREE.Mesh(bundGeoH, bundMat);
        bBot.position.set(cx, 0.05, pz + ph);
        bBot.castShadow = true;
        bBot.receiveShadow = true;
        this.islandGroup.add(bBot);

        const bLeft = new THREE.Mesh(bundGeoV, bundMat);
        bLeft.position.set(px, 0.05, cz);
        bLeft.castShadow = true;
        bLeft.receiveShadow = true;
        this.islandGroup.add(bLeft);

        const bRight = new THREE.Mesh(bundGeoV, bundMat);
        bRight.position.set(px + pw, 0.05, cz);
        bRight.castShadow = true;
        bRight.receiveShadow = true;
        this.islandGroup.add(bRight);

        if (!isFrozen) {
          for (let rx = 0.65; rx < pw - 0.5; rx += 0.72) {
            for (let rz = 0.55; rz < ph - 0.45; rz += 0.68) {
              const tuft = new THREE.Mesh(tuftGeo, cropMat);
              tuft.position.set(px + rx, 0.11, pz + rz);
              tuft.rotation.y = ((rx * 7 + rz * 13) % 10) * 0.25;
              tuft.castShadow = true;
              tuft.receiveShadow = true;
              this.islandGroup.add(tuft);
            }
          }
        }
      }
    }
  }

  private storageKey(id: RegionId): string {
    if (id === 'custom') {
      return `${STORAGE_PREFIX}custom_${this.region.lat.toFixed(3)}_${this.region.lon.toFixed(3)}_${this.region.waterLayout}`;
    }
    return `${STORAGE_PREFIX}${id}`;
  }

  private loadRegionPlacementsFromStorage(): void {
    const key = this.storageKey(this.region.id);
    const inMem = this.customSavedPositions.get(key);
    if (inMem) {
      this.region.placements = inMem.map((p) => ({ ...p }));
      return;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as PlacedItemData[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.region.placements = parsed;
        }
      }
    } catch {
      // Ignore storage failures
    }
  }

  private savePlacements(): void {
    const key = this.storageKey(this.region.id);
    const snapshot = this.placedEntries.map((e) => ({ ...e.data }));
    this.region.placements = snapshot;
    this.customSavedPositions.set(key, snapshot);
    try {
      window.localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures
    }
  }

  private rebuildPlacedModels(): void {
    while (this.placedGroup.children.length > 0) {
      this.placedGroup.remove(this.placedGroup.children[0]);
    }
    this.placedEntries = [];
    this.smokePuffs = [];
    if (!this.modelsLoaded) return;

    const smokeGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: '#f2f0eb',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    for (const p of this.region.placements) {
      if (!CATALOG_MAP.has(p.catalogId)) continue;
      const asset = this.models.createInstance(
        p.catalogId,
        this.region,
        this.season,
        this.uniforms,
        this.isSnowyGround(),
      );
      asset.root.position.set(p.x, 0, p.z);
      asset.root.rotation.y = p.rotY;
      asset.root.userData.placementId = p.id;
      this.placedGroup.add(asset.root);

      this.placedEntries.push({
        data: { ...p },
        asset,
        popAnim: 1.0,
        baseY: p.catalogId === 'duck' || p.catalogId === 'lilypad' || p.catalogId === 'sailboat' ? 0.025 : 0,
      });

      if (
        p.catalogId === 'house_1' ||
        p.catalogId === 'inn' ||
        p.catalogId === 'wangshi_house' ||
        p.catalogId === 'tea_stall'
      ) {
        for (let k = 0; k < 2; k++) {
          const puff = new THREE.Mesh(smokeGeo, smokeMat);
          this.fxGroup.add(puff);
          this.smokePuffs.push({
            mesh: puff,
            origin: new THREE.Vector3(p.x - 0.3, 2.15, p.z - 0.2),
            phase: k * 0.5 + Math.abs(p.x * 0.13),
          });
        }
      }
    }
    this.rebuildPlayerColliders();
    this.applyAtmosphere();
  }

  private getRegionSpawn(regionId: string): [number, number] {
    switch (regionId) {
      case 'sydney':
        return [-0.4, 1.35];
      case 'darrowby':
        return [-0.4, 2.8];
      case 'wangshi':
        return [-3.2, 4.6];
      case 'otaru':
        return [0.0, 4.8];
      default:
        return [0.0, 6.2];
    }
  }

  private rebuildPlayerColliders(): void {
    const out: Collider2D[] = [...this.groundBackdrop.getColliders()];
    const footprintRadius: Record<string, number> = {
      harbour_sails: 1.55,
      inn: 1.32,
      house_1: 1.12,
      house_2: 1.08,
      wangshi_house: 1.12,
      stable: 1.15,
      mill: 1.15,
      greenhouse: 1.05,
      coastal_lighthouse: 0.85,
      tea_stall: 0.85,
      well: 0.55,
      jacaranda_tree: 0.36,
      tree_common: 0.36,
      tree_birch: 0.35,
      tree_willow: 0.38,
      tree_pine: 0.36,
      sedan: 0.55,
      rock_moss: 0.42,
      bench: 0.38,
      hay: 0.36,
      barrel: 0.32,
      crate: 0.32,
      beehive: 0.36,
    };

    for (const e of this.placedEntries) {
      const r = footprintRadius[e.data.catalogId];
      if (r) {
        out.push({ kind: 'circle', x: e.data.x, z: e.data.z, r });
      }
    }

    if (this.region.osmData?.buildings) {
      for (const b of this.region.osmData.buildings) {
        if (b.points.length < 3) continue;
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const [px, pz] of b.points) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (pz < minZ) minZ = pz;
          if (pz > maxZ) maxZ = pz;
        }
        if (maxX - minX > 0.3 && maxZ - minZ > 0.3) {
          out.push({
            kind: 'box',
            minX: minX + 0.12,
            maxX: maxX - 0.12,
            minZ: minZ + 0.12,
            maxZ: maxZ - 0.12,
          });
        }
      }
    }

    this.outdoorColliders = out;
  }

  private rebuildGhostPreview(): void {
    while (this.ghostGroup.children.length > 0) {
      this.ghostGroup.remove(this.ghostGroup.children[0]);
    }
    if (!this.modelsLoaded || this.toolMode !== 'place') return;
    if (!CATALOG_MAP.has(this.selectedCatalogId)) return;

    const ghostAsset = this.models.createInstance(
      this.selectedCatalogId,
      this.region,
      this.season,
      this.uniforms,
      this.isSnowyGround(),
    );
    ghostAsset.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.material = new THREE.MeshBasicMaterial({
          color: '#7ce8a4',
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        });
      }
    });
    this.ghostGroup.add(ghostAsset.root);
    this.ghostGroup.visible = this.hoverValid;
  }

  private applyAtmosphere(): void {
    const isSnowy = this.isSnowyGround();
    this.uniforms.uSnowCoverage.value = isSnowy ? 1.0 : 0.0;

    let sunCol = '#fff1d8';
    let sunInt = 1.68;
    let hemiSky = '#d7e6f5';
    let hemiGnd = '#998975';
    let hemiInt = 1.2;
    let sunPos: [number, number, number] = [16, 22, 12];
    let bgHex = '#141720';
    let skyTopHex = '#47688a';
    let skyBotHex = '#a8c2d4';
    let windowGlow = 0.05;
    let lightInt = 0.0;
    let skyTint = '#ffffff';

    if (this.timeMode === 'morning') {
      sunCol = '#ffe2bf';
      sunInt = 1.48;
      hemiSky = '#dce6f7';
      hemiGnd = '#9c8b7e';
      hemiInt = 1.15;
      sunPos = [19, 13, 14];
      bgHex = '#171b26';
      skyTopHex = '#536991';
      skyBotHex = '#e3b59b';
      windowGlow = 0.18;
      lightInt = 0.35;
      skyTint = '#ffeede';
    } else if (this.timeMode === 'sunset') {
      sunCol = '#ffb372';
      sunInt = 1.45;
      hemiSky = '#d2b4c9';
      hemiGnd = '#876b5c';
      hemiInt = 1.05;
      sunPos = [-20, 10, 14];
      bgHex = '#181421';
      skyTopHex = '#342347';
      skyBotHex = '#d67d62';
      windowGlow = 0.65;
      lightInt = 1.35;
      skyTint = '#ffd3ba';
    } else if (this.timeMode === 'night') {
      sunCol = '#7595d6';
      sunInt = 0.46;
      hemiSky = '#3c4c70';
      hemiGnd = '#2b303c';
      hemiInt = 0.72;
      sunPos = [-12, 19, -10];
      bgHex = '#0d111a';
      skyTopHex = '#0b1122';
      skyBotHex = '#233454';
      windowGlow = 1.0;
      lightInt = 2.4;
      skyTint = '#9fb4e0';
    } else if (this.timeMode === 'eclipse') {
      sunCol = '#ffe0b8';
      sunInt = 1.55;
      hemiSky = '#b8c8e0';
      hemiGnd = '#786e66';
      hemiInt = 1.05;
      sunPos = [16, 20, 12];
      bgHex = '#101420';
      skyTopHex = '#151c30';
      skyBotHex = '#3f4b66';
      windowGlow = 0.25;
      lightInt = 0.4;
      skyTint = '#e8ecf8';
      this.uniforms.uUmbraStrength.value = 1.0;
    } else {
      // crisp sunlit daytime
      this.uniforms.uUmbraStrength.value = 0.0;
    }

    if (this.timeMode !== 'eclipse') {
      this.uniforms.uUmbraStrength.value = 0.0;
    }

    this.skyTopHex = skyTopHex;
    this.skyBotHex = skyBotHex;
    const isDarkSky = this.timeMode === 'night' || this.timeMode === 'eclipse';

    if (this.renderStyle === 'pocket') {
      if (!isDarkSky) {
        sunInt *= 0.86;
        hemiInt *= 1.24;
      }
      bgHex = isDarkSky ? '#1e2534' : '#f2ede0';
    } else if (this.renderStyle === 'hd') {
      sunInt *= 1.16;
      hemiInt *= 0.96;
      bgHex = skyBotHex;
    }

    this.sunLight.color.set(sunCol);
    this.sunLight.intensity = sunInt;
    this.sunLight.position.set(...sunPos);
    this.hemiLight.color.set(hemiSky);
    this.hemiLight.groundColor.set(hemiGnd);
    this.hemiLight.intensity = hemiInt;
    this.scene.background = new THREE.Color(bgHex);
    this.renderer.setClearColor(bgHex, 1);

    this.uniforms.uWindowGlow.value = windowGlow;
    this.uniforms.uSkyTint.value.set(skyTint);

    // Aerial perspective haze exclusively in first-person ground view so overhead cities stay crisp yet atmospheric
    const groundHazeHex = isDarkSky
      ? '#10182b'
      : this.timeMode === 'sunset'
        ? '#dfb59a'
        : this.renderStyle === 'hd'
          ? '#bfe0ef'
          : '#cfe3ee';
    if (this.viewMode === 'ground') {
      this.scene.background = new THREE.Color(groundHazeHex);
      this.scene.fog = new THREE.Fog(groundHazeHex, 210, 1220);
    } else {
      this.scene.fog = null;
    }

    this.groundBackdrop.applyAtmosphere(this.timeMode, this.renderStyle);
    this.spaceWorld.applyAtmosphere(this.timeMode);
    this.interiorWorld.applyAtmosphere(this.timeMode);

    this.spaceSun.color.set(this.timeMode === 'sunset' ? '#ffbc8a' : '#fff4de');
    this.spaceSun.intensity = isDarkSky ? 0.55 : 2.1;
    this.spaceHemi.intensity = isDarkSky ? 0.42 : 0.88;

    for (const e of [...this.placedEntries, ...this.festiveEntries]) {
      if (e.asset.pointLight) {
        const isEclipse = this.timeMode === 'eclipse';
        const uProj = e.data.x * 0.8944 + e.data.z * 0.4472;
        const distU = Math.abs(uProj - this.uniforms.uUmbraOffset.value);
        const inUmbra = isEclipse && distU < this.uniforms.uUmbraWidth.value ? 1.0 : 0.0;
        e.asset.pointLight.intensity = Math.max(lightInt, inUmbra * 2.2);
      }
    }

    // Weather visuals (scale particles down in perspective ground view so blossoms/flakes stay delicate)
    if (this.weatherPoints && this.weatherMat) {
      const pScale = this.viewMode === 'ground' ? 0.34 : 1.0;
      const isJacarandaBreeze =
        this.region.id === 'sydney' &&
        (this.season === 'summer' || this.season === 'spring') &&
        this.weather === 'breeze';
      if (this.weather === 'snow') {
        this.weatherPoints.visible = true;
        this.weatherMat.color.set('#ffffff');
        this.weatherMat.size = 0.19 * pScale;
        this.weatherMat.opacity = 0.88;
      } else if (this.weather === 'rain') {
        this.weatherPoints.visible = true;
        this.weatherMat.color.set('#a8d4eb');
        this.weatherMat.size = 0.14 * pScale;
        this.weatherMat.opacity = 0.72;
      } else if (isJacarandaBreeze) {
        this.weatherPoints.visible = true;
        this.weatherMat.color.set('#bca0f5');
        this.weatherMat.size = 0.16 * pScale;
        this.weatherMat.opacity = 0.8;
      } else if (isSnowy && this.weather === 'breeze') {
        this.weatherPoints.visible = true;
        this.weatherMat.color.set('#ffffff');
        this.weatherMat.size = 0.16 * pScale;
        this.weatherMat.opacity = 0.62;
      } else if (this.season === 'autumn' && this.weather === 'breeze') {
        this.weatherPoints.visible = true;
        this.weatherMat.color.set('#e08a42');
        this.weatherMat.size = 0.16 * pScale;
        this.weatherMat.opacity = 0.75;
      } else if (this.season === 'spring' && this.weather === 'breeze') {
        this.weatherPoints.visible = true;
        this.weatherMat.color.set('#f8d7df');
        this.weatherMat.size = 0.15 * pScale;
        this.weatherMat.opacity = 0.7;
      } else {
        this.weatherPoints.visible = false;
      }
    }
    for (const r of this.breezeRibbons) {
      r.mesh.visible = this.weather === 'breeze' || this.weather === 'clear';
    }
  }

  private clearSpecialSceneLayer(): void {
    while (this.festiveGroup.children.length > 0) {
      this.festiveGroup.remove(this.festiveGroup.children[0]);
    }
    this.festiveEntries = [];
    this.activeSpecialSceneId = null;
  }

  // Public API
  setRegion(bp: RegionBlueprint): void {
    this.clearSpecialSceneLayer();
    this.region = cloneBlueprint(bp);
    this.season = bp.defaultSeason;
    this.weather = bp.defaultWeather;
    this.timeMode = bp.defaultTime;
    this.manualEclipseOffset = null;
    this.loadRegionPlacementsFromStorage();
    this.rebuildIslandGeometry();
    this.rebuildPlacedModels();
    this.rebuildGhostPreview();
    const [sx, sz] = this.getRegionSpawn(bp.id);
    this.outdoorSavedPos.set(sx, sz);
    if (this.viewMode !== 'interior') {
      this.player.teleport(sx, sz, groundBowlY(sx, sz), Math.PI);
    }
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  resetRegionToDefault(): void {
    this.clearSpecialSceneLayer();
    const key = this.storageKey(this.region.id);
    this.customSavedPositions.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    if (this.region.id !== 'custom') {
      this.region = cloneBlueprint(PRESET_REGIONS[this.region.id]);
    }
    this.rebuildPlacedModels();
    this.onStateChanged?.();
  }

  setSeason(season: SeasonId): void {
    this.clearSpecialSceneLayer();
    this.season = season;
    this.rebuildIslandGeometry();
    this.rebuildPlacedModels();
    this.rebuildGhostPreview();
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setTimeMode(mode: TimeMode): void {
    this.clearSpecialSceneLayer();
    this.timeMode = mode;
    if (mode !== 'eclipse') this.manualEclipseOffset = null;
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setEclipseOffset(offset: number): void {
    this.clearSpecialSceneLayer();
    this.timeMode = 'eclipse';
    this.manualEclipseOffset = offset;
    this.uniforms.uUmbraOffset.value = offset;
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setWeather(w: WeatherId): void {
    this.clearSpecialSceneLayer();
    const prevSnowy = this.isSnowyGround();
    this.weather = w;
    if (this.isSnowyGround() !== prevSnowy) {
      this.rebuildIslandGeometry();
      this.rebuildPlacedModels();
      this.rebuildGhostPreview();
    }
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  applyLiveWeather(live: LiveWeatherReport): void {
    this.clearSpecialSceneLayer();
    const prevSeason = this.season;
    const prevSnowy = this.isSnowyGround();

    this.weather = live.weather;
    this.season = live.suggestedSeason;
    this.region.liveTempC = live.tempC;
    if (this.region.id === 'custom') {
      this.region.mildWinter = computeMildWinter(this.region.lat, live);
    }
    this.region.badgeText = `${this.region.lat.toFixed(2)}, ${this.region.lon.toFixed(2)} · 实况 ${live.summary}`;

    if (this.season !== prevSeason || this.isSnowyGround() !== prevSnowy) {
      this.rebuildIslandGeometry();
      this.rebuildPlacedModels();
      this.rebuildGhostPreview();
    }
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setSpecialScene(sceneId: string | null): void {
    if (!sceneId || this.activeSpecialSceneId === sceneId) {
      this.clearSpecialSceneLayer();
      this.applyAtmosphere();
      this.onStateChanged?.();
      return;
    }

    const sp = this.region.specialScenes.find((s) => s.id === sceneId);
    if (!sp) {
      this.clearSpecialSceneLayer();
      this.onStateChanged?.();
      return;
    }

    while (this.festiveGroup.children.length > 0) {
      this.festiveGroup.remove(this.festiveGroup.children[0]);
    }
    this.festiveEntries = [];
    this.activeSpecialSceneId = sp.id;

    const seasonChanged = this.season !== sp.season;
    const prevSnowy = this.isSnowyGround();
    this.season = sp.season;
    this.timeMode = sp.timeMode;
    this.weather = sp.weather;
    this.manualEclipseOffset = null;

    if (seasonChanged || this.isSnowyGround() !== prevSnowy) {
      this.rebuildIslandGeometry();
      this.rebuildPlacedModels();
      this.rebuildGhostPreview();
    }

    if (this.modelsLoaded && sp.extraPlacements) {
      for (const ep of sp.extraPlacements) {
        if (!CATALOG_MAP.has(ep.catalogId)) continue;
        const asset = this.models.createInstance(
          ep.catalogId,
          this.region,
          this.season,
          this.uniforms,
          this.isSnowyGround(),
        );
        asset.root.position.set(ep.x, 0, ep.z);
        asset.root.rotation.y = ep.rotY;
        asset.root.scale.setScalar(0.25);
        this.festiveGroup.add(asset.root);
        this.festiveEntries.push({
          data: { ...ep },
          asset,
          popAnim: 0.05,
          baseY: ep.catalogId === 'duck' || ep.catalogId === 'lilypad' || ep.catalogId === 'sailboat' ? 0.025 : 0,
        });
      }
    }

    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setViewMode(mode: ViewMode): void {
    const prevMode = this.viewMode;
    if (prevMode === 'ground' && mode !== 'ground') {
      this.outdoorSavedPos.set(this.player.pos.x, this.player.pos.z);
    }

    this.viewMode = mode;
    this.controls.enabled = mode === 'plot';
    this.spaceControls.enabled = mode === 'space';
    this.groundBackdrop.root.visible = mode === 'ground';
    if (this.cliffMesh) this.cliffMesh.visible = mode === 'plot';

    if (mode !== 'plot') {
      this.ghostGroup.visible = false;
      this.hoverValid = false;
    } else {
      this.rebuildGhostPreview();
    }

    this.player.setMoveInput(0, 0, false);

    if (mode === 'interior') {
      this.player.avatar.root.visible = true;
      this.player.avatar.root.scale.setScalar(1.05);
      if (this.player.avatar.root.parent !== this.interiorScene) {
        this.interiorScene.add(this.player.avatar.root);
      }
      const autoRoom: InteriorKind = this.region.id === 'darrowby' ? 'greenhouse' : 'tavern';
      this.setInteriorKind(autoRoom);
    } else if (mode === 'ground') {
      this.player.avatar.root.visible = this.groundPreset !== 'sky';
      this.player.avatar.root.scale.setScalar(1.0);
      if (this.player.avatar.root.parent !== this.scene) {
        this.scene.add(this.player.avatar.root);
      }
      if (prevMode !== 'ground') {
        const sx = this.outdoorSavedPos.x;
        const sz = this.outdoorSavedPos.y;
        this.player.teleport(sx, sz, groundBowlY(sx, sz), this.player.facingYaw, false);
      }
      this.walkTime = 0;
    } else {
      this.player.avatar.root.visible = false;
    }

    this.nearbyDoor = null;
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setGroundLookPreset(preset: GroundLookPreset): void {
    this.groundPreset = preset;
    this.player.avatar.root.visible = this.viewMode === 'ground' && preset !== 'sky';
    if (preset === 'street') {
      this.targetFpPitch = 0.14;
      this.targetGroundCamDist = 4.6;
    } else if (preset === 'sky') {
      this.targetFpYaw = 0.0;
      this.targetFpPitch = 0.44;
    } else {
      this.walkTime = 0;
    }
    this.onStateChanged?.();
  }

  setInteriorKind(kind: InteriorKind): void {
    this.interiorKind = kind;
    this.interiorWorld.setRoom(kind);
    if (kind === 'tavern') {
      this.player.teleport(0.25, 1.35, 0, Math.PI * 0.92, true);
      this.inYaw = 0.22;
      this.targetInYaw = 0.22;
    } else {
      this.player.teleport(0.05, 1.35, 0, Math.PI * 0.98, true);
      this.inYaw = 0.05;
      this.targetInYaw = 0.05;
    }
    this.inPitch = 0.08;
    this.targetInPitch = 0.08;
    this.inCamDist = 2.65;
    this.targetInCamDist = 2.65;
    this.nearbyDoor = null;
    this.onStateChanged?.();
  }

  handleFirstPersonDrag(dx: number, dy: number): void {
    if (this.viewMode === 'ground') {
      if (this.groundPreset === 'walk') {
        this.groundPreset = 'street';
        this.onStateChanged?.();
      }
      this.targetFpYaw += dx * 0.0046;
      this.targetFpPitch = Math.max(-0.38, Math.min(1.05, this.targetFpPitch + dy * 0.0042));
    } else if (this.viewMode === 'interior') {
      this.targetInYaw += dx * 0.0048;
      this.targetInPitch = Math.max(-0.45, Math.min(0.65, this.targetInPitch + dy * 0.0044));
    }
  }

  setMoveInput(right: number, forward: number, sprint = false): void {
    if ((Math.abs(right) > 0.05 || Math.abs(forward) > 0.05) && this.viewMode === 'ground') {
      if (this.groundPreset === 'walk' || this.groundPreset === 'sky') {
        this.groundPreset = 'street';
        this.player.avatar.root.visible = true;
        this.targetFpPitch = Math.min(0.28, this.targetFpPitch);
        this.onStateChanged?.();
      }
    }
    this.player.setMoveInput(right, forward, sprint);
  }

  setSprintToggle(on: boolean): void {
    this.player.setSprintToggle(on);
    this.onStateChanged?.();
  }

  triggerJumpOrGlide(): 'jump' | 'glide_open' | 'glide_close' | 'none' {
    if (this.viewMode === 'ground' && this.groundPreset === 'sky') {
      this.groundPreset = 'street';
      this.player.avatar.root.visible = true;
      this.targetFpPitch = 0.14;
      this.onStateChanged?.();
    }
    if (this.viewMode === 'ground' || this.viewMode === 'interior') {
      return this.player.triggerJumpOrGlide(this.viewMode === 'ground');
    }
    return 'none';
  }

  interactNearbyDoor(): boolean {
    if (!this.nearbyDoor) return false;
    const act = this.nearbyDoor.action;
    if (act === 'enter_tavern') {
      this.setViewMode('interior');
      this.setInteriorKind('tavern');
      return true;
    }
    if (act === 'enter_greenhouse') {
      this.setViewMode('interior');
      this.setInteriorKind('greenhouse');
      return true;
    }
    if (act === 'exit_interior') {
      this.setViewMode('ground');
      return true;
    }
    return false;
  }

  teleportPlayer(x: number, z: number): void {
    if (this.viewMode === 'interior') {
      const b = this.interiorWorld.getRoomBounds(this.interiorKind);
      const cx = Math.max(b.minX, Math.min(b.maxX, x));
      const cz = Math.max(b.minZ, Math.min(b.maxZ, z));
      this.player.teleport(cx, cz, 0, this.player.facingYaw);
      return;
    }
    const cx = Math.max(this.outdoorBounds.minX, Math.min(this.outdoorBounds.maxX, x));
    const cz = Math.max(this.outdoorBounds.minZ, Math.min(this.outdoorBounds.maxZ, z));
    this.outdoorSavedPos.set(cx, cz);
    this.player.teleport(cx, cz, groundBowlY(cx, cz), Math.atan2(-cx, -cz));
    this.fpYaw = Math.atan2(cx, cz);
    this.targetFpYaw = this.fpYaw;
  }

  moveFirstPerson(forward: number, right: number): void {
    const dtStep = 0.16;
    if (this.viewMode === 'ground') {
      if (this.groundPreset === 'walk') {
        this.groundPreset = 'street';
        this.onStateChanged?.();
      }
      this.player.setMoveInput(right, forward, false);
      this.player.step(
        dtStep,
        this.fpYaw,
        this.outdoorBounds,
        groundBowlY,
        groundBowlSlopeTilt,
        this.outdoorColliders,
        true,
        false,
        this.simTime,
      );
      this.player.setMoveInput(0, 0, false);
    } else if (this.viewMode === 'interior') {
      const b = this.interiorWorld.getRoomBounds(this.interiorKind);
      this.player.setMoveInput(right, forward, false);
      this.player.step(
        dtStep,
        this.inYaw,
        b,
        () => 0,
        () => 0,
        this.interiorWorld.getColliders(this.interiorKind),
        false,
        true,
        this.simTime,
      );
      this.player.setMoveInput(0, 0, false);
    }
  }

  handleFirstPersonWheel(deltaY: number): void {
    if (this.viewMode === 'ground') {
      this.targetGroundCamDist = Math.max(
        2.8,
        Math.min(11.5, this.targetGroundCamDist + deltaY * 0.0055),
      );
    } else if (this.viewMode === 'interior') {
      this.targetInCamDist = Math.max(
        1.8,
        Math.min(4.4, this.targetInCamDist + deltaY * 0.004),
      );
    }
  }

  handleInteriorTap(clientX: number, clientY: number): boolean {
    if (this.viewMode !== 'interior') return false;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.interiorCamera);
    return this.interiorWorld.pickDoor(this.raycaster);
  }

  getProjectedSpacePins(): SpaceSectorPin[] {
    if (this.viewMode !== 'space') return [];
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    return this.spaceWorld.getProjectedPins(this.spaceCamera, w, h);
  }

  setCameraPreset(preset: CameraPresetId): void {
    const map: Record<CameraPresetId, { targetAz: number; targetPol: number; targetZoom: number }> = {
      cinematic: { targetAz: Math.PI * 0.25, targetPol: 0.9, targetZoom: 1.0 },
      closeup: { targetAz: 0.48, targetPol: 1.06, targetZoom: 1.65 },
      street: { targetAz: -0.62, targetPol: 1.12, targetZoom: 1.55 },
      bird: { targetAz: Math.PI * 0.25, targetPol: 0.42, targetZoom: 0.92 },
    };
    this.cameraTween = { ...map[preset] };
  }

  setRenderStyle(style: RenderStyleId): void {
    this.renderStyle = style;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.pipeline.resize(w, h, window.devicePixelRatio || 1, style);
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setToolMode(tool: BuildToolMode, catalogId?: string): void {
    this.toolMode = tool;
    if (catalogId && CATALOG_MAP.has(catalogId)) {
      this.selectedCatalogId = catalogId;
    }
    if (tool !== 'delete' && this.deleteHighlightEntry) {
      this.deleteHighlightEntry = null;
    }
    this.rebuildGhostPreview();
    this.onStateChanged?.();
  }

  rotatePreview90(): void {
    this.previewRotY = (this.previewRotY + Math.PI * 0.5) % (Math.PI * 2);
    this.ghostGroup.rotation.y = this.previewRotY;
    this.onStateChanged?.();
  }

  orbitRotateBy(deltaAzimuthRad: number): void {
    if (this.viewMode === 'space') {
      const offset = this.spaceCamera.position.clone().sub(this.spaceControls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaAzimuthRad);
      this.spaceCamera.position.copy(this.spaceControls.target).add(offset);
      this.spaceControls.update();
      return;
    }
    if (this.viewMode === 'ground') {
      if (this.groundPreset === 'walk') this.groundPreset = 'street';
      this.targetFpYaw += deltaAzimuthRad;
      this.onStateChanged?.();
      return;
    }
    if (this.viewMode === 'interior') {
      this.targetInYaw += deltaAzimuthRad;
      return;
    }
    const offset = this.camera.position.clone().sub(this.controls.target);
    const axis = new THREE.Vector3(0, 1, 0);
    offset.applyAxisAngle(axis, deltaAzimuthRad);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  setCameraOrbit(azimuthRad: number, polarRad: number, zoom = 1.0): void {
    const dist = 30.8;
    const sinP = Math.sin(polarRad);
    this.camera.position.set(
      dist * sinP * Math.sin(azimuthRad),
      dist * Math.cos(polarRad),
      dist * sinP * Math.cos(azimuthRad),
    );
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0.35, 0);
    this.controls.update();
  }

  resetCamera(): void {
    if (this.viewMode === 'space') {
      this.spaceCamera.position.set(42, 16, 68);
      this.spaceControls.target.set(0, 0, 0);
      this.spaceControls.update();
      return;
    }
    if (this.viewMode === 'ground') {
      const [sx, sz] = this.getRegionSpawn(this.region.id);
      this.outdoorSavedPos.set(sx, sz);
      this.player.teleport(sx, sz, groundBowlY(sx, sz), Math.PI);
      this.targetFpYaw = 0.04;
      this.targetFpPitch = 0.14;
      this.targetGroundCamDist = 4.6;
      this.setGroundLookPreset('street');
      return;
    }
    if (this.viewMode === 'interior') {
      this.setInteriorKind(this.interiorKind);
      return;
    }
    this.setCameraOrbit(Math.PI * 0.25, 0.88, 1.0);
  }

  updateHover(clientX: number, clientY: number): void {
    if (!this.modelsLoaded) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    if (this.toolMode === 'place') {
      const hit = new THREE.Vector3();
      const ok = this.raycaster.ray.intersectPlane(this.pickPlane, hit);
      if (ok && Math.abs(hit.x) <= 9.6 && Math.abs(hit.z) <= 9.6) {
        const snapX = Math.round(hit.x * 2) / 2;
        const snapZ = Math.round(hit.z * 2) / 2;
        this.hoverPoint.set(snapX, 0, snapZ);
        this.hoverValid = true;
        this.ghostGroup.position.set(snapX, 0, snapZ);
        this.ghostGroup.rotation.y = this.previewRotY;
        this.ghostGroup.visible = true;
      } else {
        this.hoverValid = false;
        this.ghostGroup.visible = false;
      }
    } else {
      this.ghostGroup.visible = false;
      this.hoverValid = false;
    }
  }

  handleTap(clientX: number, clientY: number): boolean {
    if (!this.modelsLoaded) return false;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    if (this.toolMode === 'place') {
      const hit = new THREE.Vector3();
      const ok = this.raycaster.ray.intersectPlane(this.pickPlane, hit);
      if (!ok || Math.abs(hit.x) > 9.6 || Math.abs(hit.z) > 9.6) return false;
      const sx = Math.round(hit.x * 2) / 2;
      const sz = Math.round(hit.z * 2) / 2;
      this.placeCatalogItem(this.selectedCatalogId, sx, sz, this.previewRotY);
      playPlaceSound();
      return true;
    }

    if (this.toolMode === 'delete') {
      const hits = this.raycaster.intersectObjects(this.placedGroup.children, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.placementId) {
          obj = obj.parent;
        }
        const pid = obj?.userData.placementId as string | undefined;
        if (pid) {
          const idx = this.placedEntries.findIndex((e) => e.data.id === pid);
          if (idx >= 0) {
            const removed = this.placedEntries.splice(idx, 1)[0];
            this.placedGroup.remove(removed.asset.root);
            this.savePlacements();
            this.rebuildPlayerColliders();
            playRemoveSound();
            this.onStateChanged?.();
            return true;
          }
        }
      }
    }
    return false;
  }

  placeCatalogItem(catalogId: string, x: number, z: number, rotY = 0): PlacedItemData | null {
    if (!this.modelsLoaded || !CATALOG_MAP.has(catalogId)) return null;
    const data: PlacedItemData = {
      id: makePlacementId(catalogId),
      catalogId,
      x,
      z,
      rotY,
    };
    const asset = this.models.createInstance(
      catalogId,
      this.region,
      this.season,
      this.uniforms,
      this.isSnowyGround(),
    );
    asset.root.position.set(x, 0, z);
    asset.root.rotation.y = rotY;
    asset.root.userData.placementId = data.id;
    asset.root.scale.setScalar(0.2);
    this.placedGroup.add(asset.root);

    this.placedEntries.push({
      data,
      asset,
      popAnim: 0.05,
      baseY: catalogId === 'duck' || catalogId === 'lilypad' || catalogId === 'sailboat' ? 0.025 : 0,
    });
    this.savePlacements();
    this.rebuildPlayerColliders();
    this.applyAtmosphere();
    this.onStateChanged?.();
    return data;
  }

  undoLastPlacement(): boolean {
    if (this.placedEntries.length === 0) return false;
    const removed = this.placedEntries.pop()!;
    this.placedGroup.remove(removed.asset.root);
    this.savePlacements();
    this.rebuildPlayerColliders();
    playRemoveSound();
    this.onStateChanged?.();
    return true;
  }

  resize(cssWidth: number, cssHeight: number): void {
    const w = Math.max(2, cssWidth);
    const h = Math.max(2, cssHeight);
    const aspect = w / h;
    const f = aspect < 1.0 ? Math.max(this.frustumSize, 30.8 / aspect) : this.frustumSize;
    this.camera.left = (-f * aspect) / 2;
    this.camera.right = (f * aspect) / 2;
    this.camera.top = f / 2;
    this.camera.bottom = -f / 2;
    this.camera.updateProjectionMatrix();

    this.groundCamera.aspect = aspect;
    this.groundCamera.fov = aspect < 1.0 ? 68 : 58;
    this.groundCamera.updateProjectionMatrix();

    this.spaceCamera.aspect = aspect;
    this.spaceCamera.fov = aspect < 1.0 ? 54 : 44;
    this.spaceCamera.updateProjectionMatrix();

    this.interiorCamera.aspect = aspect;
    this.interiorCamera.fov = aspect < 1.0 ? 70 : 62;
    this.interiorCamera.updateProjectionMatrix();

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.pipeline.resize(w, h, dpr, this.renderStyle);
  }

  step(dt: number): void {
    this.simTime += dt;

    const nightWarmth =
      this.timeMode === 'night'
        ? 1.0
        : this.timeMode === 'sunset'
          ? 0.6
          : this.timeMode === 'eclipse'
            ? 0.45
            : 0.0;
    const isDarkSky = this.timeMode === 'night' || this.timeMode === 'eclipse';

    if (this.viewMode === 'space') {
      this.spaceControls.update();
      this.spaceWorld.update(dt, this.simTime);

      this.pipeline.render(
        this.renderer,
        this.spaceScene,
        this.spaceCamera,
        nightWarmth,
        true,
        '#070c18',
        '#0c1428',
        () => {},
        true,
      );

      if (!this.readyFired) {
        this.readyFired = true;
        (window as unknown as { __renderReady?: boolean }).__renderReady = true;
      }
      return;
    }

    if (this.viewMode === 'interior') {
      const easeIn = Math.min(1, dt * 10);
      this.inYaw += (this.targetInYaw - this.inYaw) * easeIn;
      this.inPitch += (this.targetInPitch - this.inPitch) * easeIn;
      this.inCamDist += (this.targetInCamDist - this.inCamDist) * easeIn;

      const b = this.interiorWorld.getRoomBounds(this.interiorKind);
      this.player.step(
        dt,
        this.inYaw,
        b,
        () => 0,
        () => 0,
        this.interiorWorld.getColliders(this.interiorKind),
        false,
        true,
        this.simTime,
      );

      // Clamped spring-arm behind character inside interior room walls
      const tx = this.player.pos.x;
      const ty = this.player.pos.y + 1.05;
      const tz = this.player.pos.z;
      const dx = Math.sin(this.inYaw) * Math.cos(this.inPitch);
      const dy = -Math.sin(this.inPitch);
      const dz = Math.cos(this.inYaw) * Math.cos(this.inPitch);
      let maxT = this.inCamDist;
      const margin = 0.32;
      if (dx > 1e-4) maxT = Math.min(maxT, (b.maxX - margin - tx) / dx);
      else if (dx < -1e-4) maxT = Math.min(maxT, (b.minX + margin - tx) / dx);
      if (dy > 1e-4) maxT = Math.min(maxT, (b.height - margin - ty) / dy);
      else if (dy < -1e-4) maxT = Math.min(maxT, (0.45 - ty) / dy);
      if (dz > 1e-4) maxT = Math.min(maxT, (b.maxZ + 0.35 - tz) / dz);
      else if (dz < -1e-4) maxT = Math.min(maxT, (b.minZ + margin - tz) / dz);
      const effDist = Math.max(1.25, maxT);

      this.interiorCamera.position.set(tx + dx * effDist, Math.max(0.9, ty + dy * effDist + 0.38), tz + dz * effDist);
      this.interiorCamera.lookAt(tx, ty + 0.12, tz);

      const exitTarget = this.interiorWorld.getExitTarget(this.interiorKind);
      const exitDist = Math.hypot(this.player.pos.x - exitTarget.x, this.player.pos.z - exitTarget.z);
      const nextDoor = exitDist < 1.55 ? exitTarget : null;
      if (Boolean(nextDoor) !== Boolean(this.nearbyDoor) || nextDoor?.label !== this.nearbyDoor?.label) {
        this.nearbyDoor = nextDoor;
        this.onStateChanged?.();
      }

      this.interiorWorld.update(this.simTime);

      this.pipeline.render(
        this.renderer,
        this.interiorScene,
        this.interiorCamera,
        nightWarmth,
        isDarkSky,
        this.skyTopHex,
        this.skyBotHex,
        (hide) => {
          this.player.avatar.shadowMesh.visible = !hide;
        },
      );

      if (!this.readyFired) {
        this.readyFired = true;
        (window as unknown as { __renderReady?: boolean }).__renderReady = true;
      }
      return;
    }

    if (this.viewMode === 'ground') {
      const easeFp = Math.min(1, dt * 10);
      if (this.groundPreset === 'walk') {
        this.walkTime += dt;
        this.player.setMoveInput(Math.sin(this.walkTime * 0.45) * 0.25, 0.48, false);
        this.targetFpYaw += dt * 0.22;
        this.targetFpPitch = 0.15 + Math.sin(this.walkTime * 0.5) * 0.06;
      }

      this.fpYaw += (this.targetFpYaw - this.fpYaw) * easeFp;
      this.fpPitch += (this.targetFpPitch - this.fpPitch) * easeFp;
      this.groundCamDist += (this.targetGroundCamDist - this.groundCamDist) * easeFp;

      this.player.step(
        dt,
        this.fpYaw,
        this.outdoorBounds,
        groundBowlY,
        groundBowlSlopeTilt,
        this.outdoorColliders,
        true,
        false,
        this.simTime,
      );

      if (this.groundPreset === 'sky') {
        this.player.avatar.root.visible = false;
        this.groundCamera.position.set(this.player.pos.x, this.player.pos.y + 2.05, this.player.pos.z);
        this.groundCamera.rotation.set(this.fpPitch, this.fpYaw, 0);
      } else {
        this.player.avatar.root.visible = true;
        const baseTx = this.player.pos.x;
        const baseTy = this.player.pos.y + 1.38;
        const baseTz = this.player.pos.z;
        const cx = baseTx + Math.sin(this.fpYaw) * Math.cos(this.fpPitch) * this.groundCamDist;
        const cz = baseTz + Math.cos(this.fpYaw) * Math.cos(this.fpPitch) * this.groundCamDist;
        const desiredCy = baseTy - Math.sin(this.fpPitch) * this.groundCamDist;
        const cy = Math.max(groundBowlY(cx, cz) + 0.48, desiredCy);
        // When clamped near terrain looking skyward, raise look-target smoothly so pitch up to +60° stays responsive
        const lookTy = cy + Math.sin(this.fpPitch) * this.groundCamDist;
        this.groundCamera.position.set(cx, cy, cz);
        this.groundCamera.lookAt(baseTx, lookTy, baseTz);
      }

      const doorTarget = this.groundBackdrop.getDoorwayTarget();
      const doorDist = Math.hypot(this.player.pos.x - doorTarget.x, this.player.pos.z - doorTarget.z);
      const nextDoor = doorDist < 3.6 ? doorTarget : null;
      if (Boolean(nextDoor) !== Boolean(this.nearbyDoor) || nextDoor?.label !== this.nearbyDoor?.label) {
        this.nearbyDoor = nextDoor;
        this.onStateChanged?.();
      }

      this.groundBackdrop.update(dt, this.simTime);
    }

    // Smooth camera preset tweening (plot view only)
    if (this.viewMode === 'plot' && this.cameraTween) {
      const k = Math.min(1, dt * 6.5);
      const curAz = this.controls.getAzimuthalAngle();
      const curPol = this.controls.getPolarAngle();
      const dAz = Math.atan2(
        Math.sin(this.cameraTween.targetAz - curAz),
        Math.cos(this.cameraTween.targetAz - curAz),
      );
      const dPol = this.cameraTween.targetPol - curPol;
      const dZoom = this.cameraTween.targetZoom - this.camera.zoom;

      const nextAz = curAz + dAz * k;
      const nextPol = Math.max(0.35, Math.min(1.24, curPol + dPol * k));
      const nextZoom = Math.max(0.65, Math.min(2.6, this.camera.zoom + dZoom * k));
      this.setCameraOrbit(nextAz, nextPol, nextZoom);

      if (Math.abs(dAz) < 0.008 && Math.abs(dPol) < 0.008 && Math.abs(dZoom) < 0.008) {
        this.setCameraOrbit(
          this.cameraTween.targetAz,
          this.cameraTween.targetPol,
          this.cameraTween.targetZoom,
        );
        this.cameraTween = null;
      }
    }

    if (this.viewMode === 'plot') {
      this.controls.update();
    }

    // Update Eclipse Umbra sweep
    if (this.timeMode === 'eclipse') {
      const offset =
        this.manualEclipseOffset !== null
          ? this.manualEclipseOffset
          : Math.sin(this.simTime * 0.36) * 14.5;
      this.uniforms.uUmbraOffset.value = offset;
      for (const e of [...this.placedEntries, ...this.festiveEntries]) {
        if (e.asset.pointLight) {
          const uProj = e.data.x * 0.8944 + e.data.z * 0.4472;
          const distU = Math.abs(uProj - offset);
          e.asset.pointLight.intensity = distU < this.uniforms.uUmbraWidth.value ? 2.2 : 0.35;
        }
      }
    }

    // Pop-in spring + windmills + animals + ducks
    for (const e of [...this.placedEntries, ...this.festiveEntries]) {
      if (e.popAnim < 1.0) {
        e.popAnim = Math.min(1.0, e.popAnim + dt * 4.5);
        const s = 1 - Math.pow(1 - e.popAnim, 3);
        const over = 1 + Math.sin(e.popAnim * Math.PI) * 0.14;
        e.asset.root.scale.setScalar(s * over);
      } else {
        e.asset.root.scale.setScalar(1.0);
      }

      if (e.asset.millBlades) {
        const spinSpeed = this.weather === 'breeze' ? 1.55 : 0.82;
        e.asset.millBlades.rotation.z += dt * spinSpeed;
      }
      if (e.asset.mixer) {
        e.asset.mixer.update(dt * 0.85);
      }
      if (e.asset.duckPhase !== undefined) {
        e.asset.root.position.y = e.baseY + Math.sin(this.simTime * 2.4 + e.asset.duckPhase) * 0.025;
        e.asset.root.rotation.z = Math.sin(this.simTime * 2.0 + e.asset.duckPhase) * 0.06;
      }
    }

    // Smoke puffs rising from chimneys
    for (const sp of this.smokePuffs) {
      const p = (this.simTime * 0.32 + sp.phase) % 1;
      sp.mesh.position.set(
        sp.origin.x + Math.sin(p * 6 + sp.phase) * 0.25 + p * 0.45,
        sp.origin.y + p * 1.9,
        sp.origin.z + Math.cos(p * 5) * 0.15,
      );
      const sc = 0.55 + p * 0.95;
      sp.mesh.scale.setScalar(sc);
      sp.mesh.visible = p < 0.94;
    }

    // Drifting wind breeze ribbons
    for (const r of this.breezeRibbons) {
      if (!r.mesh.visible) continue;
      const t = (this.simTime * r.speed + r.phase) % 6.283;
      r.mesh.position.x = r.baseX + Math.sin(t) * 2.4;
      r.mesh.position.z = r.baseZ + Math.cos(t * 0.7) * 1.2;
      r.mesh.rotation.y = Math.sin(t * 0.5) * 0.25;
    }

    // Weather particles
    if (this.weatherPoints && this.weatherPoints.visible && this.weatherGeo) {
      const pos = this.weatherPositions;
      const fall = this.weather === 'rain' ? 11.5 : 1.75;
      const driftX = this.weather === 'breeze' || this.weather === 'snow' ? 0.65 : 0.15;
      for (let i = 0; i < 520; i++) {
        let x = pos[i * 3] + driftX * dt;
        let y = pos[i * 3 + 1] - fall * dt;
        let z = pos[i * 3 + 2] + Math.sin(this.simTime * 1.5 + i) * 0.18 * dt;
        if (y < 0.05) {
          y = 9.5 + (i % 7) * 0.3;
          x = ((i * 37.3) % 22) - 11;
          z = ((i * 53.7) % 22) - 11;
        }
        if (x > 11.5) x -= 23;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
      }
      this.weatherGeo.attributes.position.needsUpdate = true;
    }

    this.pipeline.render(
      this.renderer,
      this.scene,
      this.viewMode === 'ground' ? this.groundCamera : this.camera,
      nightWarmth,
      isDarkSky,
      this.skyTopHex,
      this.skyBotHex,
      (hide) => {
        this.fxGroup.visible = !hide;
        this.player.avatar.shadowMesh.visible = !hide;
        this.ghostGroup.visible =
          !hide && this.viewMode === 'plot' && this.toolMode === 'place' && this.hoverValid;
        for (const wm of this.waterMeshes) {
          wm.visible = !hide;
        }
      },
    );

    if (!this.readyFired) {
      this.readyFired = true;
      (window as unknown as { __renderReady?: boolean }).__renderReady = true;
    }
  }

  dispose(): void {
    this.controls.dispose();
    this.spaceControls.dispose();
    this.groundBackdrop.dispose();
    this.spaceWorld.dispose();
    this.interiorWorld.dispose();
    this.player.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
  }
}
