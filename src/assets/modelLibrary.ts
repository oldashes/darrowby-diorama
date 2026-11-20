import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RegionBlueprint, SeasonId } from '../world/regions';

export interface CatalogItem {
  id: string;
  label: string;
  category: 'building' | 'nature' | 'living';
  icon: string;
  defaultScaleHeight: number;
  kind: 'glb' | 'bespoke';
  glbKey?: string;
}

export interface WorldShaderUniforms {
  uSnowCoverage: { value: number };
  uWindowGlow: { value: number };
  uUmbraOffset: { value: number };
  uUmbraWidth: { value: number };
  uUmbraStrength: { value: number };
  uSkyTint: { value: THREE.Color };
}

export const CATALOG: CatalogItem[] = [
  { id: 'house_1', label: '石墙农舍', category: 'building', icon: '🏡', defaultScaleHeight: 2.3, kind: 'glb', glbKey: 'house_1' },
  { id: 'house_2', label: '尖顶谷仓', category: 'building', icon: '🏠', defaultScaleHeight: 2.2, kind: 'glb', glbKey: 'house_2' },
  { id: 'inn', label: '老镇酒馆', category: 'building', icon: '🍺', defaultScaleHeight: 2.7, kind: 'glb', glbKey: 'inn' },
  { id: 'mill', label: '风车磨坊', category: 'building', icon: '🌬️', defaultScaleHeight: 3.1, kind: 'glb', glbKey: 'mill' },
  { id: 'stable', label: '牧场马厩', category: 'building', icon: '🐴', defaultScaleHeight: 2.0, kind: 'glb', glbKey: 'stable' },
  { id: 'greenhouse', label: '玻璃温室', category: 'building', icon: '🌿', defaultScaleHeight: 1.85, kind: 'bespoke' },
  { id: 'wangshi_house', label: '马头墙屋', category: 'building', icon: '🏮', defaultScaleHeight: 2.25, kind: 'bespoke' },
  { id: 'tea_stall', label: '红灯茶摊', category: 'building', icon: '🍵', defaultScaleHeight: 1.75, kind: 'bespoke' },
  { id: 'bridge_stone', label: '石拱小桥', category: 'building', icon: '🌉', defaultScaleHeight: 1.05, kind: 'bespoke' },
  { id: 'well', label: '古石水井', category: 'building', icon: '🪣', defaultScaleHeight: 1.45, kind: 'glb', glbKey: 'well' },

  { id: 'tree_common', label: '落叶乔木', category: 'nature', icon: '🌳', defaultScaleHeight: 2.7, kind: 'glb', glbKey: 'tree_common' },
  { id: 'tree_birch', label: '白桦树', category: 'nature', icon: '🌲', defaultScaleHeight: 2.8, kind: 'glb', glbKey: 'tree_birch' },
  { id: 'tree_willow', label: '水岸垂柳', category: 'nature', icon: '🪴', defaultScaleHeight: 2.6, kind: 'glb', glbKey: 'tree_willow' },
  { id: 'tree_pine', label: '高山云杉', category: 'nature', icon: '🎄', defaultScaleHeight: 2.9, kind: 'glb', glbKey: 'tree_pine' },
  { id: 'lantern', label: '铸铁街灯', category: 'nature', icon: '💡', defaultScaleHeight: 1.25, kind: 'glb', glbKey: 'lantern' },
  { id: 'bench', label: '木制长椅', category: 'nature', icon: '🪑', defaultScaleHeight: 0.58, kind: 'glb', glbKey: 'bench' },
  { id: 'beehive', label: '养蜂木箱', category: 'nature', icon: '🍯', defaultScaleHeight: 0.72, kind: 'bespoke' },
  { id: 'sedan', label: '复古小车', category: 'nature', icon: '🚙', defaultScaleHeight: 0.96, kind: 'glb', glbKey: 'sedan' },
  { id: 'hay', label: '干草垛', category: 'nature', icon: '🌾', defaultScaleHeight: 0.65, kind: 'glb', glbKey: 'hay' },
  { id: 'wheat', label: '稻麦田簇', category: 'nature', icon: '🌿', defaultScaleHeight: 0.62, kind: 'glb', glbKey: 'wheat' },
  { id: 'crate', label: '木箱杂物', category: 'nature', icon: '📦', defaultScaleHeight: 0.52, kind: 'glb', glbKey: 'crate' },
  { id: 'barrel', label: '橡木酒桶', category: 'nature', icon: '🛢️', defaultScaleHeight: 0.62, kind: 'glb', glbKey: 'barrel' },
  { id: 'rock_moss', label: '青苔溪石', category: 'nature', icon: '🪨', defaultScaleHeight: 0.68, kind: 'glb', glbKey: 'rock_moss' },
  { id: 'lilypad', label: '池塘睡莲', category: 'nature', icon: '🪷', defaultScaleHeight: 0.16, kind: 'glb', glbKey: 'lilypad' },

  { id: 'alpaca', label: '绵羊羊驼', category: 'living', icon: '🐑', defaultScaleHeight: 0.92, kind: 'glb', glbKey: 'alpaca' },
  { id: 'cow', label: '奶牛', category: 'living', icon: '🐄', defaultScaleHeight: 1.05, kind: 'glb', glbKey: 'cow' },
  { id: 'horse', label: '牧场骏马', category: 'living', icon: '🐎', defaultScaleHeight: 1.18, kind: 'glb', glbKey: 'horse' },
  { id: 'shiba', label: '乡村小狗', category: 'living', icon: '🐕', defaultScaleHeight: 0.62, kind: 'glb', glbKey: 'shiba' },
  { id: 'fox', label: '林间小狐', category: 'living', icon: '🦊', defaultScaleHeight: 0.58, kind: 'glb', glbKey: 'fox' },
  { id: 'duck', label: '戏水鸭子', category: 'living', icon: '🦆', defaultScaleHeight: 0.34, kind: 'bespoke' },
];

export const CATALOG_MAP = new Map<string, CatalogItem>(CATALOG.map((c) => [c.id, c]));

const GLB_URLS: Record<string, string> = {
  house_1: './models/House_1.glb',
  house_2: './models/House_2.glb',
  inn: './models/Inn.glb',
  mill: './models/Mill.glb',
  stable: './models/Stable.glb',
  well: './models/Well.glb',
  lantern: './models/lantern.glb',
  bench: './models/Bench_1.glb',
  hay: './models/Hay.glb',
  wheat: './models/Wheat.glb',
  crate: './models/Crate.glb',
  barrel: './models/Barrel.glb',
  rock_moss: './models/Rock_Moss_1.glb',
  lilypad: './models/Lilypad.glb',
  sedan: './models/sedan.glb',

  tree_common_summer: './models/CommonTree_1.glb',
  tree_common_autumn: './models/CommonTree_Autumn_1.glb',
  tree_common_winter: './models/CommonTree_Dead_Snow_1.glb',
  tree_birch_summer: './models/BirchTree_1.glb',
  tree_birch_autumn: './models/BirchTree_Autumn_1.glb',
  tree_birch_winter: './models/BirchTree_Dead_Snow_1.glb',
  tree_willow_summer: './models/Willow_1.glb',
  tree_willow_autumn: './models/Willow_Autumn_1.glb',
  tree_willow_winter: './models/Willow_Dead_Snow_1.glb',
  tree_pine_summer: './models/PineTree_1.glb',
  tree_pine_winter: './models/PineTree_Snow_1.glb',

  alpaca: './models/Alpaca.glb',
  cow: './models/Cow.glb',
  horse: './models/Horse.glb',
  shiba: './models/ShibaInu.glb',
  fox: './models/Fox.glb',
};

const ANIMATED_KEYS = new Set(['alpaca', 'cow', 'horse', 'shiba', 'fox']);

export interface InstantiatedAsset {
  root: THREE.Group;
  mixer?: THREE.AnimationMixer;
  millBlades?: THREE.Object3D;
  pointLight?: THREE.PointLight;
  duckPhase?: number;
}

export function attachStorybookSurfaceShader(
  mat: THREE.MeshLambertMaterial,
  uniforms: WorldShaderUniforms,
  opts: { snowCap: boolean; isWindow: boolean; isLantern?: boolean },
): void {
  const key = `sb-${opts.snowCap ? 's1' : 's0'}-${opts.isWindow ? 'w1' : 'w0'}-${opts.isLantern ? 'l1' : 'l0'}`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowCoverage = uniforms.uSnowCoverage;
    shader.uniforms.uWindowGlow = uniforms.uWindowGlow;
    shader.uniforms.uUmbraOffset = uniforms.uUmbraOffset;
    shader.uniforms.uUmbraWidth = uniforms.uUmbraWidth;
    shader.uniforms.uUmbraStrength = uniforms.uUmbraStrength;
    shader.uniforms.uSkyTint = uniforms.uSkyTint;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSbWorldPos;
        varying vec3 vSbWorldNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 sbWp = modelMatrix * vec4(transformed, 1.0);
        vSbWorldPos = sbWp.xyz;
        vSbWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSbWorldPos;
        varying vec3 vSbWorldNormal;
        uniform float uSnowCoverage;
        uniform float uWindowGlow;
        uniform float uUmbraOffset;
        uniform float uUmbraWidth;
        uniform float uUmbraStrength;
        uniform vec3 uSkyTint;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float sbUProj = dot(vSbWorldPos.xz, vec2(0.8944, 0.4472));
        float sbUmbra = uUmbraStrength * (1.0 - smoothstep(uUmbraWidth * 0.45, uUmbraWidth, abs(sbUProj - uUmbraOffset)));
        ${
          opts.snowCap
            ? `
        float sbUp = smoothstep(0.42, 0.78, normalize(vSbWorldNormal).y);
        float sbSnowNoise = fract(sin(dot(floor(vSbWorldPos.xz * 7.0), vec2(12.9898, 78.233))) * 43758.5453);
        float sbSnow = sbUp * uSnowCoverage * (0.86 + 0.14 * sbSnowNoise);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.92, 0.88), sbSnow * 0.86);`
            : ''
        }
        ${
          opts.isWindow || opts.isLantern
            ? `
        float sbWindowTrigger = max(uWindowGlow, sbUmbra * 0.95);
        vec3 sbLitCol = ${opts.isLantern ? 'vec3(1.0, 0.86, 0.48)' : 'vec3(1.0, 0.72, 0.30)'};
        diffuseColor.rgb = mix(diffuseColor.rgb, sbLitCol, clamp(sbWindowTrigger, 0.0, 1.0) * 0.85);`
            : ''
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float sbUProjE = dot(vSbWorldPos.xz, vec2(0.8944, 0.4472));
        float sbUmbraE = uUmbraStrength * (1.0 - smoothstep(uUmbraWidth * 0.45, uUmbraWidth, abs(sbUProjE - uUmbraOffset)));
        ${
          opts.isWindow
            ? `
        float sbGlow = max(uWindowGlow, sbUmbraE * 0.98);
        totalEmissiveRadiance += vec3(1.32, 0.84, 0.30) * sbGlow;`
            : opts.isLantern
              ? `
        float sbGlowL = max(uWindowGlow, sbUmbraE * 0.98);
        totalEmissiveRadiance += vec3(1.45, 0.98, 0.42) * (0.34 + 1.05 * sbGlowL);`
              : `
        totalEmissiveRadiance *= 1.0;
        diffuseColor.rgb *= mix(1.0, 0.34, sbUmbraE);`
        }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float sbUProjL = dot(vSbWorldPos.xz, vec2(0.8944, 0.4472));
        float sbUmbraL = uUmbraStrength * (1.0 - smoothstep(uUmbraWidth * 0.45, uUmbraWidth, abs(sbUProjL - uUmbraOffset)));
        reflectedLight.directDiffuse *= mix(1.0, 0.14, sbUmbraL);
        reflectedLight.indirectDiffuse *= mix(1.0, 0.62, sbUmbraL);
        reflectedLight.indirectDiffuse *= uSkyTint;`,
      );
  };
}

function recolorCarTexture(
  tex: THREE.Texture,
  style: 'green' | 'blue' | 'cream',
): THREE.CanvasTexture | null {
  const img = tex.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
  if (!img || !('width' in img) || !img.width) return null;
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img as CanvasImageSource, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const py = Math.floor(i / 4 / w);
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (py < h * 0.65 && r > 95 && r > g * 1.35 && r > b * 1.35) {
      if (style === 'green') {
        px[i] = Math.round(r * 0.24);
        px[i + 1] = Math.round(Math.min(255, r * 0.48 + g * 0.18));
        px[i + 2] = Math.round(Math.min(255, r * 0.34 + b * 0.14));
      } else if (style === 'blue') {
        px[i] = Math.round(r * 0.28);
        px[i + 1] = Math.round(Math.min(255, r * 0.56 + g * 0.15));
        px[i + 2] = Math.round(Math.min(255, r * 0.78 + b * 0.2));
      } else {
        px[i] = Math.round(Math.min(255, r * 0.92));
        px[i + 1] = Math.round(Math.min(255, r * 0.88 + 14));
        px[i + 2] = Math.round(Math.min(255, r * 0.76 + 18));
      }
    }
  }
  ctx.putImageData(data, 0, 0);

  const out = new THREE.CanvasTexture(canvas);
  out.colorSpace = THREE.SRGBColorSpace;
  out.flipY = tex.flipY;
  out.minFilter = THREE.NearestFilter;
  out.magFilter = THREE.NearestFilter;
  out.needsUpdate = true;
  return out;
}

function harmonizeStorybookColor(col: THREE.Color, satMul: number, lightLift = 0.03): void {
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  hsl.s = THREE.MathUtils.clamp(hsl.s * satMul, 0, 0.78);
  hsl.l = THREE.MathUtils.clamp(hsl.l + lightLift, 0.08, 0.94);
  col.setHSL(hsl.h, hsl.s, hsl.l);
}

export class ModelLibrary {
  private gltfCache = new Map<string, GLTF>();
  private carMaps = new Map<'green' | 'blue' | 'cream', THREE.Texture>();

  async loadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();
    const entries = Object.entries(GLB_URLS);
    let done = 0;

    await Promise.all([
      ...entries.map(async ([key, url]) => {
        const gltf = await loader.loadAsync(url);
        this.gltfCache.set(key, gltf);
        done += 1;
        onProgress?.(done, entries.length);
      }),
      (async () => {
        const baseCar = await texLoader.loadAsync('./models/car_colormap.png');
        baseCar.flipY = false;
        baseCar.colorSpace = THREE.SRGBColorSpace;
        baseCar.minFilter = THREE.NearestFilter;
        baseCar.magFilter = THREE.NearestFilter;
        baseCar.needsUpdate = true;
        for (const st of ['green', 'blue', 'cream'] as const) {
          this.carMaps.set(st, recolorCarTexture(baseCar, st) ?? baseCar);
        }
      })(),
    ]);
  }

  private resolveGlbKey(catalogId: string, season: SeasonId): string | null {
    const item = CATALOG_MAP.get(catalogId);
    if (!item || item.kind !== 'glb' || !item.glbKey) return null;
    if (catalogId === 'tree_common' || catalogId === 'tree_birch' || catalogId === 'tree_willow') {
      const sfx = season === 'winter' ? 'winter' : season === 'autumn' ? 'autumn' : 'summer';
      return `${catalogId}_${sfx}`;
    }
    if (catalogId === 'tree_pine') {
      return season === 'winter' ? 'tree_pine_winter' : 'tree_pine_summer';
    }
    return item.glbKey;
  }

  createInstance(
    catalogId: string,
    region: RegionBlueprint,
    season: SeasonId,
    uniforms: WorldShaderUniforms,
  ): InstantiatedAsset {
    const item = CATALOG_MAP.get(catalogId);
    if (!item) throw new Error(`Unknown catalog item: ${catalogId}`);

    if (item.kind === 'bespoke') {
      return this.createBespoke(catalogId, region, season, uniforms, item.defaultScaleHeight);
    }

    const glbKey = this.resolveGlbKey(catalogId, season);
    if (!glbKey) throw new Error(`Missing glbKey for ${catalogId}`);
    const gltf = this.gltfCache.get(glbKey);
    if (!gltf) throw new Error(`Missing cached GLB: ${glbKey}`);

    const isAnimated = ANIMATED_KEYS.has(catalogId);
    const inner = isAnimated ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);

    if (catalogId === 'sedan') {
      const carMap = this.carMaps.get(region.palette.carStyle);
      inner.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          const m = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: carMap ?? null,
            flatShading: true,
          });
          attachStorybookSurfaceShader(m, uniforms, { snowCap: true, isWindow: false });
          obj.material = m;
        }
      });
      inner.rotation.y = Math.PI * 0.5;
    } else {
      const isTree = catalogId.startsWith('tree_');
      const isLanternProp = catalogId === 'lantern';
      const isFloraOrAnimal = isTree || isAnimated || catalogId === 'lilypad' || catalogId === 'hay';
      const snowCap = !isAnimated && catalogId !== 'lantern' && catalogId !== 'lilypad';
      this.stylizeHierarchy(inner, region, season, uniforms, {
        snowCap,
        glowWindows: !isFloraOrAnimal,
        isLanternProp,
        satMul: isFloraOrAnimal ? 0.86 : 0.78,
        isSkinned: isAnimated,
      });
    }

    let mixer: THREE.AnimationMixer | undefined;
    if (isAnimated && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(inner);
      const idle =
        gltf.animations.find((c) => c.name.toLowerCase().includes('idle')) ?? gltf.animations[0];
      const act = mixer.clipAction(idle);
      act.play();
      mixer.update(0.02);
    }

    inner.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.frustumCulled = false;
      }
    });

    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scale = item.defaultScaleHeight / Math.max(0.001, size.y);
    inner.scale.multiplyScalar(scale);
    inner.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

    const root = new THREE.Group();
    root.add(inner);

    let millBlades: THREE.Object3D | undefined;
    if (catalogId === 'mill') {
      millBlades = inner.getObjectByName('Mill_Blades') ?? undefined;
    }

    let pointLight: THREE.PointLight | undefined;
    if (catalogId === 'lantern' || catalogId === 'inn' || catalogId === 'house_1') {
      pointLight = new THREE.PointLight(
        '#ffb454',
        0.0,
        catalogId === 'lantern' ? 4.4 : 4.0,
        1.7,
      );
      pointLight.position.set(0, catalogId === 'lantern' ? 1.08 : 0.9, catalogId === 'lantern' ? 0 : 0.65);
      root.add(pointLight);
    }

    return { root, mixer, millBlades, pointLight };
  }

  private stylizeHierarchy(
    objRoot: THREE.Object3D,
    region: RegionBlueprint,
    season: SeasonId,
    uniforms: WorldShaderUniforms,
    opts: {
      snowCap: boolean;
      glowWindows: boolean;
      isLanternProp: boolean;
      satMul: number;
      isSkinned: boolean;
    },
  ): void {
    const cache = new Map<THREE.Material, THREE.Material>();
    objRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;

      const conv = (src: THREE.Material): THREE.Material => {
        const hit = cache.get(src);
        if (hit) return hit;

        const std = src as THREE.MeshStandardMaterial;
        const nameLower = `${std.name || ''} ${obj.name || ''}`.toLowerCase();
        const isWin =
          opts.glowWindows &&
          (nameLower.includes('window') ||
            nameLower.includes('glass') ||
            nameLower.includes('pane'));
        const isBulb =
          opts.isLanternProp &&
          (nameLower.includes('light') ||
            nameLower.includes('bulb') ||
            nameLower.includes('glass') ||
            nameLower.includes('emissive') ||
            nameLower.includes('lantern_1'));

        const col = std.color ? std.color.clone() : new THREE.Color(0xffffff);
        if (isWin) {
          col.set('#303d4d');
        } else if (isBulb) {
          col.set('#ffe499');
        } else {
          harmonizeStorybookColor(col, opts.satMul, 0.03);
          if (season === 'spring' && obj.name.toLowerCase().includes('leaf')) {
            col.lerp(new THREE.Color('#a4cb7a'), 0.25);
          }
          if (region.id === 'otaru' && (nameLower.includes('roof') || nameLower.includes('brick'))) {
            col.lerp(new THREE.Color(region.palette.roofTone), 0.25);
          }
        }

        const next = new THREE.MeshLambertMaterial({
          color: col,
          map: std.map ?? null,
          vertexColors: std.vertexColors,
          transparent: std.transparent,
          opacity: std.opacity,
          alphaTest: std.alphaTest,
          side: std.side,
          flatShading: true,
        });

        if (next.map) {
          next.map.minFilter = THREE.NearestFilter;
          next.map.magFilter = THREE.NearestFilter;
          next.map.needsUpdate = true;
        }

        if (!opts.isSkinned) {
          attachStorybookSurfaceShader(next, uniforms, {
            snowCap: opts.snowCap && !isWin && !isBulb,
            isWindow: isWin,
            isLantern: isBulb,
          });
        }
        cache.set(src, next);
        return next;
      };

      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(conv);
      } else if (obj.material) {
        obj.material = conv(obj.material);
      }
    });
  }

  private createBespoke(
    id: string,
    region: RegionBlueprint,
    _season: SeasonId,
    uniforms: WorldShaderUniforms,
    targetHeight: number,
  ): InstantiatedAsset {
    const raw = new THREE.Group();
    let pointLight: THREE.PointLight | undefined;
    let duckPhase: number | undefined;

    const mkMat = (
      hex: string | number,
      opts: { snowCap?: boolean; isWindow?: boolean; isLantern?: boolean; transparent?: boolean; opacity?: number } = {},
    ) => {
      const m = new THREE.MeshLambertMaterial({
        color: hex,
        flatShading: true,
        transparent: opts.transparent ?? false,
        opacity: opts.opacity ?? 1,
      });
      if (opts.transparent) {
        m.depthWrite = false;
      }
      attachStorybookSurfaceShader(m, uniforms, {
        snowCap: opts.snowCap ?? true,
        isWindow: opts.isWindow ?? false,
        isLantern: opts.isLantern ?? false,
      });
      return m;
    };

    const addBox = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      rz = 0,
      rx = 0,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      mesh.castShadow = !(mat as THREE.MeshLambertMaterial).transparent;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    if (id === 'greenhouse') {
      const frame = mkMat('#4f5c52', { snowCap: true });
      const plinth = mkMat('#999284', { snowCap: true });
      const soil = mkMat('#6d5846', { snowCap: false });
      const pot = mkMat('#b86f52', { snowCap: false });
      const leaf = mkMat('#6f9c54', { snowCap: false });
      const glass = mkMat('#bce0df', { snowCap: true, transparent: true, opacity: 0.42 });
      const lamp = mkMat('#ffe699', { snowCap: false, isLantern: true });

      addBox(raw, 1.5, 0.28, 2.35, 0, 0.14, 0, plinth);
      addBox(raw, 1.15, 0.14, 1.9, 0, 0.42, 0, soil);
      for (let k = -0.65; k <= 0.65; k += 0.43) {
        addBox(raw, 0.18, 0.16, 0.18, -0.32, 0.56, k, pot);
        addBox(raw, 0.24, 0.22, 0.24, -0.32, 0.72, k, leaf);
        addBox(raw, 0.18, 0.16, 0.18, 0.32, 0.56, k, pot);
        addBox(raw, 0.24, 0.22, 0.24, 0.32, 0.72, k, leaf);
      }
      addBox(raw, 0.16, 0.18, 0.16, 0, 1.16, 0, lamp);
      addBox(raw, 1.44, 0.92, 2.26, 0, 0.74, 0, glass);
      addBox(raw, 0.98, 0.05, 2.32, -0.37, 1.42, 0, glass, 0.56);
      addBox(raw, 0.98, 0.05, 2.32, 0.37, 1.42, 0, glass, -0.56);
      // Crisp Victorian iron ribs
      for (const px of [-0.73, 0.73]) {
        for (const pz of [-1.14, -0.38, 0.38, 1.14]) {
          addBox(raw, 0.06, 0.95, 0.06, px, 0.75, pz, frame);
        }
        addBox(raw, 0.06, 0.06, 2.32, px, 1.21, 0, frame);
      }
      addBox(raw, 0.08, 0.08, 2.34, 0, 1.66, 0, frame);
      for (const pz of [-1.14, -0.38, 0.38, 1.14]) {
        addBox(raw, 0.88, 0.05, 0.05, -0.37, 1.43, pz, frame, 0.56);
        addBox(raw, 0.88, 0.05, 0.05, 0.37, 1.43, pz, frame, -0.56);
      }
      pointLight = new THREE.PointLight('#ffbf69', 0, 4.0, 1.7);
      pointLight.position.set(0, 1.12, 0);
      raw.add(pointLight);
    } else if (id === 'wangshi_house') {
      const plaster = mkMat(region.palette.wallTone, { snowCap: false });
      const plinth = mkMat('#7e7b74', { snowCap: true });
      const tile = mkMat(region.palette.roofTone, { snowCap: true });
      const timber = mkMat('#5a4332', { snowCap: false });
      const winMat = mkMat('#2d3a49', { snowCap: false, isWindow: true });
      const lanternMat = mkMat('#ff7a52', { snowCap: false, isLantern: true });

      addBox(raw, 2.4, 0.24, 1.85, 0, 0.12, 0, plinth);
      addBox(raw, 2.28, 1.48, 1.72, 0, 0.98, 0, plaster);
      // Stepped Jiangnan horse-head gable walls (马头墙)
      for (const gx of [-1.16, 1.16]) {
        addBox(raw, 0.14, 1.85, 1.76, gx, 1.16, 0, plaster);
        addBox(raw, 0.16, 0.36, 1.12, gx, 2.08, 0, plaster);
        addBox(raw, 0.18, 0.10, 1.82, gx, 2.02, 0, tile);
        addBox(raw, 0.18, 0.10, 1.18, gx, 2.28, 0, tile);
      }
      // Curved Qing tiled pitched roof
      addBox(raw, 2.18, 0.10, 1.12, 0, 1.94, 0.48, tile, 0, 0.44);
      addBox(raw, 2.18, 0.10, 1.12, 0, 1.94, -0.48, tile, 0, -0.44);
      addBox(raw, 2.22, 0.14, 0.22, 0, 2.18, 0, tile);
      // Doorway timber & red signage plaque
      addBox(raw, 0.56, 0.88, 0.06, -0.45, 0.68, 0.88, timber);
      addBox(raw, 0.58, 0.48, 0.06, 0.42, 0.72, 0.88, winMat);
      addBox(raw, 0.48, 0.42, 0.06, -0.45, 1.42, 0.88, winMat);
      addBox(raw, 0.48, 0.42, 0.06, 0.45, 1.42, 0.88, winMat);
      addBox(raw, 1.85, 0.08, 0.30, 0, 1.12, 0.96, timber);
      // Roof tile ribs for crisp silhouette lines
      for (let rx = -0.8; rx <= 0.8; rx += 0.4) {
        addBox(raw, 0.06, 0.06, 1.12, rx, 1.98, 0.48, tile, 0, 0.44);
        addBox(raw, 0.06, 0.06, 1.12, rx, 1.98, -0.48, tile, 0, -0.44);
      }
      // Hanging warm red lantern
      addBox(raw, 0.14, 0.18, 0.14, -0.02, 0.96, 1.04, lanternMat);
      pointLight = new THREE.PointLight('#ff9848', 0, 3.8, 1.7);
      pointLight.position.set(0, 0.95, 1.18);
      raw.add(pointLight);
    } else if (id === 'tea_stall') {
      const timber = mkMat('#694b36', { snowCap: false });
      const tile = mkMat(region.palette.roofTone, { snowCap: true });
      const awningR = mkMat('#c96858', { snowCap: true });
      const awningW = mkMat('#ebe2d0', { snowCap: true });
      const brick = mkMat('#8a6856', { snowCap: false });
      const redLantern = mkMat('#ff5c44', { snowCap: false, isLantern: true });

      addBox(raw, 2.1, 0.12, 1.65, 0, 0.06, 0, brick);
      for (const px of [-0.9, 0.9]) {
        for (const pz of [-0.68, 0.68]) {
          addBox(raw, 0.10, 1.28, 0.10, px, 0.70, pz, timber);
        }
      }
      addBox(raw, 2.25, 0.10, 1.05, 0, 1.50, -0.35, tile, 0, -0.32);
      addBox(raw, 2.25, 0.10, 1.05, 0, 1.50, 0.35, tile, 0, 0.32);
      // Striped shop awning over front
      for (let s = 0; s < 5; s++) {
        addBox(raw, 0.42, 0.06, 0.82, -0.84 + s * 0.42, 1.16, 0.92, s % 2 === 0 ? awningR : awningW, 0, 0.35);
      }
      // Brick steamer stove + chimney + counter + stools
      addBox(raw, 0.55, 0.56, 0.55, -0.62, 0.40, -0.25, brick);
      addBox(raw, 0.14, 1.1, 0.14, -0.72, 1.22, -0.38, brick);
      addBox(raw, 1.15, 0.46, 0.42, 0.32, 0.35, 0.18, timber);
      addBox(raw, 0.32, 0.24, 0.28, 0.18, 0.24, 0.85, timber);
      addBox(raw, 0.32, 0.24, 0.28, 0.65, 0.24, 0.85, timber);
      for (const lx of [-0.88, 0.0, 0.88]) {
        addBox(raw, 0.15, 0.18, 0.15, lx, 0.96, 1.22, redLantern);
      }
      pointLight = new THREE.PointLight('#ff8444', 0, 4.4, 1.7);
      pointLight.position.set(0, 0.95, 1.1);
      raw.add(pointLight);
    } else if (id === 'bridge_stone') {
      const stone = mkMat('#a9a295', { snowCap: true });
      const archStone = mkMat('#8a847a', { snowCap: false });
      const lanternGlass = mkMat('#ffe088', { snowCap: false, isLantern: true });
      const iron = mkMat('#3c4148', { snowCap: false });

      const steps = 11;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const x = (t - 0.5) * 3.1;
        const h = Math.cos((t - 0.5) * Math.PI) * 0.52 + 0.18;
        const pitch = Math.sin((t - 0.5) * Math.PI) * -0.45;
        addBox(raw, 0.38, 0.18, 1.35, x, h, 0, stone, pitch);
        addBox(raw, 0.38, 0.42, 0.14, x, h + 0.26, 0.62, archStone, pitch);
        addBox(raw, 0.38, 0.42, 0.14, x, h + 0.26, -0.62, archStone, pitch);
      }
      for (const sx of [-1.42, 1.42]) {
        for (const sz of [-0.62, 0.62]) {
          addBox(raw, 0.28, 0.52, 0.24, sx, 0.26, sz, archStone);
          addBox(raw, 0.07, 0.26, 0.07, sx, 0.65, sz, iron);
          addBox(raw, 0.14, 0.16, 0.14, sx, 0.84, sz, lanternGlass);
        }
      }
      pointLight = new THREE.PointLight('#ffb85c', 0, 3.8, 1.7);
      pointLight.position.set(0, 0.85, 0);
      raw.add(pointLight);
    } else if (id === 'beehive') {
      const wood = mkMat('#dfcfad', { snowCap: true });
      const cap = mkMat('#6d7d6e', { snowCap: true });
      for (const [bx, bz, sc] of [
        [-0.22, 0.10, 1.0],
        [0.24, -0.06, 0.92],
        [0.02, 0.28, 0.85],
      ]) {
        addBox(raw, 0.34 * sc, 0.44 * sc, 0.34 * sc, bx, 0.22 * sc, bz, wood);
        addBox(raw, 0.40 * sc, 0.09 * sc, 0.40 * sc, bx, 0.46 * sc, bz, cap, 0.04);
      }
    } else if (id === 'duck') {
      const body = mkMat('#f3efe4', { snowCap: false });
      const wing = mkMat('#b8a890', { snowCap: false });
      const beak = mkMat('#e5943c', { snowCap: false });
      addBox(raw, 0.22, 0.16, 0.30, 0, 0.09, 0, body);
      addBox(raw, 0.24, 0.10, 0.18, 0, 0.11, -0.02, wing);
      addBox(raw, 0.13, 0.13, 0.13, 0, 0.22, 0.12, body);
      addBox(raw, 0.08, 0.05, 0.10, 0, 0.20, 0.22, beak);
      duckPhase = Math.random() * Math.PI * 2;
    }

    raw.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scale = targetHeight / Math.max(0.001, size.y);
    raw.scale.multiplyScalar(scale);
    raw.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

    const root = new THREE.Group();
    root.add(raw);
    if (pointLight) {
      root.add(pointLight);
    }
    return { root, pointLight, duckPhase };
  }
}
