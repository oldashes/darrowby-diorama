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
  PRESET_REGIONS,
  PlacedItemData,
  RegionBlueprint,
  RegionId,
  RenderStyleId,
  SeasonId,
  TimeMode,
  WeatherId,
  cloneBlueprint,
  makePlacementId,
} from './regions';

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
): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  const grassHex =
    season === 'spring'
      ? region.palette.grassSpring
      : season === 'autumn'
        ? region.palette.grassAutumn
        : season === 'winter'
          ? region.palette.grassWinter
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
    if (season === 'winter') {
      ctx.fillStyle = rand() > 0.45 ? 'rgba(225,222,212,0.55)' : 'rgba(255,253,247,0.55)';
    } else if (season === 'autumn') {
      ctx.fillStyle = rand() > 0.4 ? 'rgba(164,132,74,0.34)' : 'rgba(220,188,118,0.28)';
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
    ctx.strokeStyle = season === 'winter' ? '#beb5a2' : '#9c8f76';
    ctx.lineWidth = ((widthUnits + 0.35) / (ISLAND_HALF * 2)) * size;
    ctx.beginPath();
    pts.forEach(([wx, wz], idx) => {
      if (idx === 0) ctx.moveTo(toPx(wx), toPx(wz));
      else ctx.lineTo(toPx(wx), toPx(wz));
    });
    ctx.stroke();

    // Inner road bed
    ctx.strokeStyle = season === 'winter' ? '#ded8c8' : region.palette.dirtPath;
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
    ctx.strokeStyle = season === 'winter' ? '#a5b5b8' : '#7b897a';
    ctx.lineWidth = (2.2 / (ISLAND_HALF * 2)) * size;
    ctx.beginPath();
    ctx.moveTo(toPx(4.8), toPx(-11.2));
    ctx.quadraticCurveTo(toPx(2.2), toPx(-3.0), toPx(0.2), toPx(1.8));
    ctx.quadraticCurveTo(toPx(-1.8), toPx(6.2), toPx(-0.8), toPx(11.2));
    ctx.stroke();

    ctx.fillStyle = season === 'winter' ? '#a5b5b8' : '#7b897a';
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
        ctx.fillStyle = season === 'winter' ? '#b8d0d6' : season === 'autumn' ? '#d4b85b' : '#b7cb66';
        ctx.fillRect(
          toPx(px),
          toPx(pz),
          (pw / (ISLAND_HALF * 2)) * size,
          (ph / (ISLAND_HALF * 2)) * size,
        );
      }
    }
  } else {
    // Otaru stone wharf quays flanking straight canal x=0
    ctx.fillStyle = season === 'winter' ? '#cbd0d4' : '#aeb3b8';
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

export class DioramaEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly controls: OrbitControls;
  private pipeline = new InkPipeline();
  private models = new ModelLibrary();

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

  private islandGroup = new THREE.Group();
  private placedGroup = new THREE.Group();
  private fxGroup = new THREE.Group();
  private ghostGroup = new THREE.Group();
  private waterMeshes: THREE.Mesh[] = [];
  private icicleGroup = new THREE.Group();
  private cascadeGroup = new THREE.Group();
  private groundMesh: THREE.Mesh | null = null;
  private groundMat: THREE.MeshLambertMaterial | null = null;
  private cliffMat: THREE.MeshLambertMaterial | null = null;
  private waterMat: THREE.MeshLambertMaterial | null = null;
  private cliffTex: THREE.CanvasTexture | null = null;
  private groundTex: THREE.CanvasTexture | null = null;

  private breezeRibbons: BreezeRibbon[] = [];
  private smokePuffs: SmokePuff[] = [];
  private weatherPoints: THREE.Points | null = null;
  private weatherPositions = new Float32Array(520 * 3);
  private weatherGeo: THREE.BufferGeometry | null = null;
  private weatherMat: THREE.PointsMaterial | null = null;

  private placedEntries: LivePlacedEntry[] = [];
  private raycaster = new THREE.Raycaster();
  private pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);

  // Public reactive state
  private region: RegionBlueprint = cloneBlueprint(PRESET_REGIONS.darrowby);
  private season: SeasonId = 'winter';
  private timeMode: TimeMode = 'day';
  private weather: WeatherId = 'breeze';
  private renderStyle: RenderStyleId = 'pixel';

  private toolMode: BuildToolMode = 'view';
  private selectedCatalogId = 'greenhouse';
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

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minZoom = 0.65;
    this.controls.maxZoom = 2.6;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.24;
    this.controls.target.set(0, 0.35, 0);
    this.controls.update();

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
    this.scene.add(this.fxGroup);
    this.scene.add(this.ghostGroup);

    this.initWeatherAndFx();
    this.rebuildIslandGeometry();
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

  getState() {
    return {
      region: this.region,
      season: this.season,
      timeMode: this.timeMode,
      weather: this.weather,
      renderStyle: this.renderStyle,
      toolMode: this.toolMode,
      selectedCatalogId: this.selectedCatalogId,
      previewRotY: this.previewRotY,
      modelsLoaded: this.modelsLoaded,
      placedCount: this.placedEntries.length,
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

    this.groundTex = buildIslandGroundTexture(this.region, this.season);
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

    // Carved Layered Cliff Base (21.65 x 2.75 x 21.65) so turf edge slightly overhangs cleanly!
    const baseGeo = new THREE.BoxGeometry(ISLAND_HALF * 2 - 0.34, 2.75, ISLAND_HALF * 2 - 0.34);
    const baseMesh = new THREE.Mesh(baseGeo, this.cliffMat);
    baseMesh.position.set(0, -1.65, 0);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    this.islandGroup.add(baseMesh);

    // Translucent Ice / Water Overlay + Waterfall Cascade & Hanging Winter Icicles
    const isFrozen = this.season === 'winter';
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
    } else {
      addWaterStrip(2.6, 22.0, 0, 0, 0);
      fallX = 0.0;
    }

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

    this.cascadeGroup.visible = !isFrozen;
    this.icicleGroup.visible = isFrozen;
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
    return `${STORAGE_PREFIX}${id}`;
  }

  private loadRegionPlacementsFromStorage(): void {
    const inMem = this.customSavedPositions.get(this.region.id);
    if (inMem) {
      this.region.placements = inMem.map((p) => ({ ...p }));
      return;
    }
    try {
      const raw = window.localStorage.getItem(this.storageKey(this.region.id));
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
    const snapshot = this.placedEntries.map((e) => ({ ...e.data }));
    this.region.placements = snapshot;
    this.customSavedPositions.set(this.region.id, snapshot);
    try {
      window.localStorage.setItem(this.storageKey(this.region.id), JSON.stringify(snapshot));
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
      const asset = this.models.createInstance(p.catalogId, this.region, this.season, this.uniforms);
      asset.root.position.set(p.x, 0, p.z);
      asset.root.rotation.y = p.rotY;
      asset.root.userData.placementId = p.id;
      this.placedGroup.add(asset.root);

      this.placedEntries.push({
        data: { ...p },
        asset,
        popAnim: 1.0,
        baseY: p.catalogId === 'duck' || p.catalogId === 'lilypad' ? 0.02 : 0,
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
    this.applyAtmosphere();
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
    const isWinter = this.season === 'winter';
    this.uniforms.uSnowCoverage.value = isWinter ? 1.0 : 0.0;

    let sunCol = '#fff1d8';
    let sunInt = 1.68;
    let hemiSky = '#d7e6f5';
    let hemiGnd = '#998975';
    let hemiInt = 1.2;
    let sunPos: [number, number, number] = [16, 22, 12];
    let bgHex = '#141720';
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

    for (const e of this.placedEntries) {
      if (e.asset.pointLight) {
        const isEclipse = this.timeMode === 'eclipse';
        const uProj = e.data.x * 0.8944 + e.data.z * 0.4472;
        const distU = Math.abs(uProj - this.uniforms.uUmbraOffset.value);
        const inUmbra = isEclipse && distU < this.uniforms.uUmbraWidth.value ? 1.0 : 0.0;
        e.asset.pointLight.intensity = Math.max(lightInt, inUmbra * 2.2);
      }
    }

    // Weather visuals
    if (this.weatherPoints && this.weatherMat) {
      const showPart = this.weather === 'snow' || this.weather === 'rain' || isWinter || this.season === 'autumn' || this.season === 'spring';
      this.weatherPoints.visible = showPart && (this.weather !== 'clear' || this.season !== 'summer');
      if (this.weather === 'snow') {
        this.weatherMat.color.set('#ffffff');
        this.weatherMat.size = 0.19;
        this.weatherMat.opacity = 0.88;
      } else if (this.weather === 'rain') {
        this.weatherMat.color.set('#a8d4eb');
        this.weatherMat.size = 0.14;
        this.weatherMat.opacity = 0.72;
      } else if (this.season === 'autumn') {
        this.weatherMat.color.set('#e08a42');
        this.weatherMat.size = 0.16;
        this.weatherMat.opacity = 0.75;
      } else {
        this.weatherMat.color.set('#f8d7df');
        this.weatherMat.size = 0.15;
        this.weatherMat.opacity = 0.70;
      }
    }
    for (const r of this.breezeRibbons) {
      r.mesh.visible = this.weather === 'breeze' || this.weather === 'clear';
    }
  }

  // Public API
  setRegion(bp: RegionBlueprint): void {
    this.region = cloneBlueprint(bp);
    this.season = bp.defaultSeason;
    this.weather = bp.defaultWeather;
    this.timeMode = bp.defaultTime;
    this.manualEclipseOffset = null;
    this.loadRegionPlacementsFromStorage();
    this.rebuildIslandGeometry();
    this.rebuildPlacedModels();
    this.rebuildGhostPreview();
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  resetRegionToDefault(): void {
    this.customSavedPositions.delete(this.region.id);
    try {
      window.localStorage.removeItem(this.storageKey(this.region.id));
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
    this.season = season;
    this.rebuildIslandGeometry();
    this.rebuildPlacedModels();
    this.rebuildGhostPreview();
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setTimeMode(mode: TimeMode): void {
    this.timeMode = mode;
    if (mode !== 'eclipse') this.manualEclipseOffset = null;
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setEclipseOffset(offset: number): void {
    this.timeMode = 'eclipse';
    this.manualEclipseOffset = offset;
    this.uniforms.uUmbraOffset.value = offset;
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setWeather(w: WeatherId): void {
    this.weather = w;
    this.applyAtmosphere();
    this.onStateChanged?.();
  }

  setRenderStyle(style: RenderStyleId): void {
    this.renderStyle = style;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.pipeline.resize(w, h, window.devicePixelRatio || 1, style);
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
    const asset = this.models.createInstance(catalogId, this.region, this.season, this.uniforms);
    asset.root.position.set(x, 0, z);
    asset.root.rotation.y = rotY;
    asset.root.userData.placementId = data.id;
    asset.root.scale.setScalar(0.2);
    this.placedGroup.add(asset.root);

    this.placedEntries.push({
      data,
      asset,
      popAnim: 0.05,
      baseY: catalogId === 'duck' || catalogId === 'lilypad' ? 0.02 : 0,
    });
    this.savePlacements();
    this.applyAtmosphere();
    this.onStateChanged?.();
    return data;
  }

  undoLastPlacement(): boolean {
    if (this.placedEntries.length === 0) return false;
    const removed = this.placedEntries.pop()!;
    this.placedGroup.remove(removed.asset.root);
    this.savePlacements();
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

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.pipeline.resize(w, h, dpr, this.renderStyle);
  }

  step(dt: number): void {
    this.simTime += dt;
    this.controls.update();

    // Update Eclipse Umbra sweep
    if (this.timeMode === 'eclipse') {
      const offset =
        this.manualEclipseOffset !== null
          ? this.manualEclipseOffset
          : Math.sin(this.simTime * 0.36) * 14.5;
      this.uniforms.uUmbraOffset.value = offset;
      for (const e of this.placedEntries) {
        if (e.asset.pointLight) {
          const uProj = e.data.x * 0.8944 + e.data.z * 0.4472;
          const distU = Math.abs(uProj - offset);
          e.asset.pointLight.intensity = distU < this.uniforms.uUmbraWidth.value ? 2.2 : 0.35;
        }
      }
    }

    // Pop-in spring + windmills + animals + ducks
    for (const e of this.placedEntries) {
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

    const nightWarmth =
      this.timeMode === 'night'
        ? 1.0
        : this.timeMode === 'sunset'
          ? 0.6
          : this.timeMode === 'eclipse'
            ? 0.45
            : 0.0;

    this.pipeline.render(this.renderer, this.scene, this.camera, nightWarmth, (hide) => {
      this.fxGroup.visible = !hide;
      this.ghostGroup.visible = !hide && this.toolMode === 'place' && this.hoverValid;
      for (const wm of this.waterMeshes) {
        wm.visible = !hide;
      }
    });

    if (!this.readyFired) {
      this.readyFired = true;
      (window as unknown as { __renderReady?: boolean }).__renderReady = true;
    }
  }

  dispose(): void {
    this.controls.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
  }
}
