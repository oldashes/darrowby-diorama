import * as THREE from 'three';
import { WorldShaderUniforms, attachStorybookSurfaceShader } from '../assets/modelLibrary';
import { TimeMode } from './regions';
import type { ContinentStripId } from './cylinderWorld';

export interface SpaceSectorPin {
  id: string;
  label: string;
  subLabel: string;
  strip: ContinentStripId;
  regionId: 'sydney' | 'wangshi' | 'darrowby';
  x: number;
  y: number;
  visible: boolean;
}

function buildStarfieldTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#070c18');
  g.addColorStop(0.5, '#0c1428');
  g.addColorStop(1.0, '#070b15');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Faint Milky Way galactic dust ribbon
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-0.22);
  const mw = ctx.createLinearGradient(0, -110, 0, 110);
  mw.addColorStop(0, 'rgba(65, 96, 152, 0)');
  mw.addColorStop(0.5, 'rgba(72, 108, 168, 0.22)');
  mw.addColorStop(1, 'rgba(65, 96, 152, 0)');
  ctx.fillStyle = mw;
  ctx.fillRect(-w, -110, w * 2, 220);
  ctx.restore();

  let seed = 3137;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 1100; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const big = rnd() > 0.93;
    const r = big ? 1.9 + rnd() * 1.1 : 0.7 + rnd() * 0.8;
    const tint = rnd();
    ctx.fillStyle =
      tint > 0.82
        ? 'rgba(255, 228, 178, 0.95)'
        : tint > 0.62
          ? 'rgba(186, 218, 255, 0.9)'
          : 'rgba(246, 248, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildEarthTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#eef4f8');
  g.addColorStop(0.14, '#2f6a9e');
  g.addColorStop(0.5, '#255a8f');
  g.addColorStop(0.86, '#2f6a9e');
  g.addColorStop(1, '#e6eef5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Stylized storybook continents
  ctx.fillStyle = '#6da665';
  const blobs: Array<[number, number, number, number]> = [
    [130, 100, 48, 30],
    [165, 145, 28, 38],
    [290, 95, 62, 34],
    [350, 130, 42, 26],
    [400, 170, 26, 18],
  ];
  for (const [bx, by, rx, ry] of blobs) {
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Swirled atmospheric cloud bands
  ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.ellipse(
      (i * 47 + 20) % w,
      40 + ((i * 31) % 175),
      28 + (i % 4) * 14,
      7 + (i % 3) * 4,
      0.15,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildInteriorMiniContinentTexture(stripIdx: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (stripIdx === 0) {
    g.addColorStop(0, '#e8e4d8');
    g.addColorStop(0.32, '#9ec16e');
    g.addColorStop(1, '#79a658');
  } else if (stripIdx === 1) {
    g.addColorStop(0, '#eae6dc');
    g.addColorStop(0.34, '#9cc06e');
    g.addColorStop(1, '#b5a86b');
  } else {
    g.addColorStop(0, '#e4dfd3');
    g.addColorStop(0.35, '#99bf6d');
    g.addColorStop(0.75, '#82b45d');
    g.addColorStop(1, '#44b6cb');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Winding turquoise river & tiny golden/terracotta town grids visible through hull windows
  ctx.strokeStyle = '#4bbbd0';
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = w * 0.52 + Math.sin(t * 9 + stripIdx) * 22;
    const y = t * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  let seed = 211 + stripIdx * 71;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 160; i++) {
    const x = 18 + rnd() * (w - 36);
    const y = 18 + rnd() * (h - 36);
    ctx.fillStyle =
      stripIdx === 2 && y > h * 0.68
        ? '#9d7fe2'
        : i % 3 === 0
          ? '#c46f55'
          : i % 3 === 1
            ? '#f0e7d4'
            : '#5c6e7e';
    ctx.fillRect(x, y, 5 + rnd() * 6, 5 + rnd() * 6);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildCurvedExteriorArc(
  thetaCenter: number,
  arcHalf: number,
  length: number,
  radius: number,
  inward: boolean,
): THREE.BufferGeometry {
  const segAng = 16;
  const segZ = 16;
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
      normals.push(inward ? -s : s, inward ? c : -c, 0);
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
      if (inward) {
        indices.push(a, d, b, b, d, e);
      } else {
        indices.push(a, b, d, b, e, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Outer space orbital scene showing the full Island Three O'Neill Cylinder
 * floating beside Earth & Moon with 3 hinged 45° solar reflection mirrors,
 * 3 transparent window bays revealing internal continents, and an external zero-G agricultural ring.
 */
export class SpaceWorld {
  readonly root = new THREE.Group();
  private hullPivot = new THREE.Group();
  private spinGroup = new THREE.Group();
  private agriRing: THREE.Group | null = null;
  private shuttles: Array<{ mesh: THREE.Mesh; radius: number; speed: number; phase: number }> = [];
  private pinAnchors: Array<{
    id: string;
    label: string;
    subLabel: string;
    strip: ContinentStripId;
    regionId: 'sydney' | 'wangshi' | 'darrowby';
    anchor: THREE.Object3D;
  }> = [];

  private starTex: THREE.CanvasTexture;
  private earthTex: THREE.CanvasTexture;
  private stripTexs: THREE.CanvasTexture[] = [];
  private mirrorMat: THREE.MeshLambertMaterial;
  private earthGroup = new THREE.Group();

  constructor(
    parentScene: THREE.Scene,
    private uniforms: WorldShaderUniforms,
  ) {
    this.starTex = buildStarfieldTexture();
    this.earthTex = buildEarthTexture();
    this.mirrorMat = new THREE.MeshLambertMaterial({
      color: '#dceaf6',
      side: THREE.DoubleSide,
      flatShading: true,
    });
    attachStorybookSurfaceShader(this.mirrorMat, this.uniforms, { snowCap: false, isWindow: false });

    this.buildCosmos();
    this.buildStation();

    this.hullPivot.rotation.set(0.16, -0.36, 0.34);
    this.hullPivot.position.set(2.5, -2.5, 0);
    this.hullPivot.scale.setScalar(0.86);
    this.hullPivot.add(this.spinGroup);
    this.root.add(this.hullPivot);
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

  private buildCosmos(): void {
    const starDome = new THREE.Mesh(
      new THREE.SphereGeometry(420, 32, 20),
      new THREE.MeshBasicMaterial({ map: this.starTex, side: THREE.BackSide }),
    );
    this.root.add(starDome);

    // Sunlit Earth in distant cosmos
    const earthMat = new THREE.MeshLambertMaterial({ map: this.earthTex, flatShading: false });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(28, 28, 20), earthMat);
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(29.1, 24, 16),
      new THREE.MeshBasicMaterial({
        color: '#8cc9f5',
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide,
      }),
    );
    this.earthGroup.add(earth, atmo);
    this.earthGroup.position.set(-64, 15, -180);
    this.root.add(this.earthGroup);

    // Distant Moon
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(5.8, 16, 12),
      this.mkMat('#d8d4ca'),
    );
    moon.position.set(-34, 27, -155);
    this.root.add(moon);
  }

  private buildStation(): void {
    const R = 12.6;
    const LEN = 64;
    const ARC_LAND = (36 * Math.PI) / 180; // 72° opaque armor strips flanking 48° sunlit window bays

    const hullMat = this.mkMat('#dfd8c7');
    const frameMat = this.mkMat('#525c69');
    const brassRing = this.mkMat('#c79f62');
    const beaconMat = this.mkMat('#94ecff', { isLantern: true });
    const warmWindowMat = this.mkMat('#ffe69a', { isLantern: true });

    // 3 Opaque Exterior Armor Strips & 3 Visible Inner Continents + 3 Hinged 45° Mirrors
    const sectorMeta: Array<{
      id: string;
      label: string;
      subLabel: string;
      regionId: 'sydney' | 'wangshi' | 'darrowby';
    }> = [
      { id: 'space_asia', label: '🇨🇳 广州 / 网市镇', subLabel: '东亚水乡大陆带', regionId: 'wangshi' },
      { id: 'space_europe', label: '🇬🇧 约克郡 · 达罗比', subLabel: '欧陆田园大陆带', regionId: 'darrowby' },
      { id: 'space_oceania', label: '🇦🇺 悉尼蓝花楹海湾', subLabel: '大洋海岸大陆带', regionId: 'sydney' },
    ];

    for (let i = 0; i < 3; i++) {
      const stripTheta = (i * Math.PI * 2) / 3;
      const winTheta = stripTheta + Math.PI / 3;

      // Exterior champagne cladding over land strip
      const extGeo = buildCurvedExteriorArc(stripTheta, ARC_LAND, LEN, R, false);
      const extMesh = new THREE.Mesh(extGeo, hullMat);
      this.spinGroup.add(extMesh);

      // Inner DoubleSide miniature continent directly visible from outside through window bays!
      const tex = buildInteriorMiniContinentTexture(i);
      this.stripTexs.push(tex);
      const inGeo = buildCurvedExteriorArc(stripTheta, ARC_LAND - 0.03, LEN - 1, R - 0.55, true);
      const inMat = new THREE.MeshLambertMaterial({
        map: tex,
        side: THREE.DoubleSide,
        flatShading: true,
      });
      attachStorybookSurfaceShader(inMat, this.uniforms, { snowCap: false, isWindow: false });
      const inMesh = new THREE.Mesh(inGeo, inMat);
      this.spinGroup.add(inMesh);

      // Anchor point for clickable orbital sector tag
      const anchor = new THREE.Object3D();
      anchor.position.set(
        (R + 1.2) * Math.sin(stripTheta),
        -(R + 1.2) * Math.cos(stripTheta),
        i === 2 ? 12 : 0,
      );
      this.spinGroup.add(anchor);
      this.pinAnchors.push({
        ...sectorMeta[i],
        strip: i as ContinentStripId,
        anchor,
      });

      // Longitudinal girder framing window bays
      for (const edge of [-ARC_LAND, ARC_LAND]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, LEN), frameMat);
        const bt = stripTheta + edge;
        beam.position.set(R * Math.sin(bt), -R * Math.cos(bt), 0);
        beam.rotation.z = bt;
        this.spinGroup.add(beam);
      }

      // 42° Hinged Giant Solar Reflection Mirror hinged at aft ring (z = +LEN*0.48), fanning outward
      const mirrorPivot = new THREE.Group();
      mirrorPivot.position.set(
        (R + 0.3) * Math.sin(winTheta),
        -(R + 0.3) * Math.cos(winTheta),
        LEN * 0.46,
      );
      mirrorPivot.rotation.z = winTheta;

      const mirrorWing = new THREE.Group();
      mirrorWing.rotation.x = -0.72; // opens ~41° radially outward (-Y local points away from cylinder center when rotation.z aligns)
      // Wait: local +Y points INWARD; so rotating around X by +0.72 pushes +Z into -Y (OUTWARD)!
      mirrorWing.rotation.x = 0.72;

      const panelGeo = new THREE.PlaneGeometry(11.4, 48);
      const panel = new THREE.Mesh(panelGeo, this.mirrorMat);
      panel.rotation.x = Math.PI * 0.5;
      panel.position.set(0, 0, 24);

      const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 48.5), frameMat);
      frameLeft.position.set(-5.7, 0, 24);
      const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 48.5), frameMat);
      frameRight.position.set(5.7, 0, 24);
      const tipBar = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.55, 0.65), brassRing);
      tipBar.position.set(0, 0, 48.2);

      mirrorWing.add(panel, frameLeft, frameRight, tipBar);
      mirrorPivot.add(mirrorWing);
      this.spinGroup.add(mirrorPivot);
    }

    // Structural Circumferential Hull Rings along cylinder length
    for (let z = -LEN * 0.5; z <= LEN * 0.5; z += 8) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.14, 0.2, 6, 48), frameMat);
      ring.position.z = z;
      this.spinGroup.add(ring);
    }

    // North Hemispherical Geodesic Endcap (z = -LEN*0.5)
    const domeMat = this.mkMat('#bcd2e0');
    const northDome = new THREE.Mesh(
      new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      domeMat,
    );
    northDome.rotation.x = -Math.PI * 0.5;
    northDome.position.z = -LEN * 0.5;
    this.spinGroup.add(northDome);

    const northSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.8, 9, 8), frameMat);
    northSpire.rotation.x = -Math.PI * 0.5;
    northSpire.position.z = -LEN * 0.5 - R - 2.5;
    const beaconBulb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), beaconMat);
    beaconBulb.position.z = -LEN * 0.5 - R - 7.5;
    this.spinGroup.add(northSpire, beaconBulb);

    // Aft Docking Hub Endcap (z = +LEN*0.5)
    const aftCap = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.85, 4.5, 24), frameMat);
    aftCap.rotation.x = Math.PI * 0.5;
    aftCap.position.z = LEN * 0.5 + 2.2;
    const dockHub = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, 6.0, 12), brassRing);
    dockHub.rotation.x = Math.PI * 0.5;
    dockHub.position.z = LEN * 0.5 + 6.5;
    const dockRingLight = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.35, 6, 24), warmWindowMat);
    dockRingLight.position.z = LEN * 0.5 + 9.4;
    this.spinGroup.add(aftCap, dockHub, dockRingLight);

    // External Zero-G Agricultural Ring encircling aft station
    const agri = new THREE.Group();
    agri.position.z = LEN * 0.36;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(18.6, 1.35, 8, 36), this.mkMat('#87b462'));
    const torusFrame = new THREE.Mesh(new THREE.TorusGeometry(19.6, 0.28, 6, 36), frameMat);
    agri.add(torus, torusFrame);
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.45, 37.2, 0.45), frameMat);
      spoke.rotation.z = (s * Math.PI) / 3;
      agri.add(spoke);
    }
    this.agriRing = agri;
    this.spinGroup.add(agri);

    // Tiny glowing transit shuttles orbiting the station
    for (let i = 0; i < 4; i++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 1.2), beaconMat);
      this.hullPivot.add(sh);
      this.shuttles.push({
        mesh: sh,
        radius: 22 + i * 2.5,
        speed: 0.25 + i * 0.08,
        phase: i * 1.6,
      });
    }
  }

  getProjectedPins(
    camera: THREE.PerspectiveCamera,
    cssWidth: number,
    cssHeight: number,
  ): SpaceSectorPin[] {
    const out: SpaceSectorPin[] = [];
    const wp = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    this.root.updateMatrixWorld(true);
    for (const p of this.pinAnchors) {
      p.anchor.getWorldPosition(wp);
      const toPin = wp.clone().sub(camera.position);
      if (toPin.dot(camDir) <= 1.0) continue;
      const ndc = wp.clone().project(camera);
      if (Math.abs(ndc.x) > 0.94 || Math.abs(ndc.y) > 0.90 || ndc.z > 1) continue;

      out.push({
        id: p.id,
        label: p.label,
        subLabel: p.subLabel,
        strip: p.strip,
        regionId: p.regionId,
        x: (ndc.x * 0.5 + 0.5) * cssWidth,
        y: (-ndc.y * 0.5 + 0.5) * cssHeight,
        visible: true,
      });
    }
    return out;
  }

  applyAtmosphere(timeMode: TimeMode): void {
    const isNight = timeMode === 'night' || timeMode === 'eclipse';
    this.mirrorMat.color.set(
      isNight ? '#3c5076' : timeMode === 'sunset' ? '#ffd9bc' : '#dceaf6',
    );
  }

  update(dt: number, simTime: number): void {
    // Classic slow artificial-gravity station spin (~2 min/rev visual rotation)
    this.spinGroup.rotation.z += dt * 0.045;
    if (this.agriRing) {
      this.agriRing.rotation.z -= dt * 0.02;
    }
    this.earthGroup.rotation.y += dt * 0.012;

    for (const s of this.shuttles) {
      const a = simTime * s.speed + s.phase;
      s.mesh.position.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius, 36 + Math.sin(a * 0.5) * 6);
      s.mesh.rotation.z = a;
    }
  }

  dispose(): void {
    this.starTex.dispose();
    this.earthTex.dispose();
    for (const t of this.stripTexs) t.dispose();
  }
}
