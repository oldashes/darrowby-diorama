import * as THREE from 'three';
import { WorldShaderUniforms, attachStorybookSurfaceShader } from '../assets/modelLibrary';
import { TimeMode } from './regions';
import { Collider2D, DoorwayTarget, RoomBounds } from './playerController';

export type InteriorKind = 'tavern' | 'greenhouse';

function buildPlankFloorTexture(kind: InteriorKind): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  if (kind === 'tavern') {
    ctx.fillStyle = '#9c714c';
    ctx.fillRect(0, 0, size, size);
    const plankH = 32;
    for (let y = 0; y < size; y += plankH) {
      const row = Math.floor(y / plankH);
      ctx.fillStyle = row % 2 === 0 ? '#a67b54' : '#946a45';
      ctx.fillRect(0, y, size, plankH - 2);
      ctx.fillStyle = '#6c492d';
      ctx.fillRect(0, y + plankH - 2, size, 2);
      const jointX = (row * 173 + 90) % size;
      ctx.fillRect(jointX, y, 2, plankH);
    }
  } else {
    // Terracotta & pale flagstone conservatory pavers
    ctx.fillStyle = '#d4cbb8';
    ctx.fillRect(0, 0, size, size);
    const tile = 64;
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        const checker = ((x / tile + y / tile) | 0) % 2 === 0;
        ctx.fillStyle = checker ? '#d8b798' : '#e2d7c2';
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return tex;
}

function buildBlueprintWallTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#203652';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(180, 218, 255, 0.22)';
  ctx.lineWidth = 1;
  for (let x = 16; x < 512; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 16; y < 256; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Hand-drafted Cooper Station cross-section diagram
  ctx.strokeStyle = '#e8f3ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(110, 62, 220, 128);
  ctx.beginPath();
  ctx.arc(400, 126, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(400, 126, 36, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffe29c';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('ISLAND III · COOPER ARCH', 24, 34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildInteriorPanoramaTexture(isNight: boolean): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (isNight) {
    g.addColorStop(0.0, '#091124');
    g.addColorStop(0.6, '#142442');
    g.addColorStop(1.0, '#1e304c');
  } else {
    g.addColorStop(0.0, '#7ab8df');
    g.addColorStop(0.55, '#b8ddf0');
    g.addColorStop(1.0, '#e8f1eb');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (isNight) {
    for (let i = 0; i < 95; i++) {
      const sx = ((i * 73) % 500) + 6;
      const sy = ((i * 41) % 165) + 8;
      ctx.fillStyle = i % 5 === 0 ? '#ffe194' : '#e6f0ff';
      ctx.fillRect(sx, sy, 2, 2);
    }
  } else {
    // Soft cumulus clouds across skylight bay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (const [cx, cy, rx, ry] of [
      [150, 58, 52, 16],
      [350, 72, 64, 18],
      [256, 44, 42, 12],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Distant rotating Endcap wheel silhouette in the upper center horizon
  ctx.strokeStyle = isNight ? 'rgba(130, 175, 230, 0.35)' : 'rgba(105, 130, 148, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * 0.5, 118, 42, 0, Math.PI * 2);
  ctx.stroke();

  // Signature O'Neill Cylinder upward-curving green valley flanks seen through window!
  ctx.fillStyle = isNight ? '#1b2d2c' : '#76a65a';
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.quadraticCurveTo(w * 0.24, 175, w * 0.5, 198);
  ctx.quadraticCurveTo(w * 0.76, 175, w, 18);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // River ribbon curving along center valley floor
  ctx.fillStyle = isNight ? '#274c66' : '#5bb4cb';
  ctx.beginPath();
  ctx.moveTo(w * 0.44, 195);
  ctx.lineTo(w * 0.56, 195);
  ctx.lineTo(w * 0.61, h);
  ctx.lineTo(w * 0.39, h);
  ctx.closePath();
  ctx.fill();

  // Tiny village & terrace dots climbing both curved slopes
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const x = t < 0.5 ? 24 + t * 240 : w - 24 - (1 - t) * 240;
    const u = Math.abs(x - w * 0.5) / (w * 0.5);
    const y = 192 - u * u * 150;
    ctx.fillStyle = isNight ? '#ffd478' : i % 2 === 0 ? '#ebe2cc' : '#c9765e';
    ctx.fillRect(x, y - 6, 8, 6);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Walkable MMORPG-style 3D room interiors ("观海驿站酒馆" & "玻璃温室花房").
 * Feels completely grounded like a normal room on Earth while looking out onto the curving O'Neill valley.
 */
export class InteriorWorld {
  readonly root = new THREE.Group();
  private tavernGroup = new THREE.Group();
  private greenhouseGroup = new THREE.Group();
  private kind: InteriorKind = 'tavern';

  private doorMeshes: THREE.Mesh[] = [];
  private flameCones: THREE.Mesh[] = [];
  private hearthLight = new THREE.PointLight('#ff9a42', 2.4, 14, 1.4);
  private sunBeamLight = new THREE.DirectionalLight('#fff2d8', 1.45);
  private ambHemi = new THREE.HemisphereLight('#f2e8d4', '#8f7054', 1.05);

  private skyPaneMat: THREE.MeshBasicMaterial;
  private winDayTex: THREE.CanvasTexture;
  private winNightTex: THREE.CanvasTexture;
  private texs: THREE.CanvasTexture[] = [];

  constructor(
    parentScene: THREE.Scene,
    private uniforms: WorldShaderUniforms,
  ) {
    this.winDayTex = buildInteriorPanoramaTexture(false);
    this.winNightTex = buildInteriorPanoramaTexture(true);
    this.texs.push(this.winDayTex, this.winNightTex);
    this.skyPaneMat = new THREE.MeshBasicMaterial({ map: this.winDayTex, color: '#ffffff' });
    this.sunBeamLight.position.set(2.5, 6.2, -7.5);
    this.sunBeamLight.castShadow = true;
    this.sunBeamLight.shadow.mapSize.set(1024, 1024);

    parentScene.add(this.ambHemi, this.sunBeamLight);
    this.buildTavern();
    this.buildGreenhouse();

    this.root.add(this.tavernGroup, this.greenhouseGroup);
    parentScene.add(this.root);
    this.setRoom('tavern');
  }

  private mkMat(
    hex: string | number,
    opts: { isLantern?: boolean; transparent?: boolean; opacity?: number } = {},
  ): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({
      color: hex,
      flatShading: true,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    if (opts.transparent) m.depthWrite = false;
    attachStorybookSurfaceShader(m, this.uniforms, {
      snowCap: false,
      isWindow: false,
      isLantern: opts.isLantern ?? false,
    });
    return m;
  }

  private buildTavern(): void {
    const g = this.tavernGroup;
    const W = 10.2;
    const D = 8.6;
    const H = 4.2;

    const floorTex = buildPlankFloorTexture('tavern');
    const bpTex = buildBlueprintWallTexture();
    this.texs.push(floorTex, bpTex);

    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex, flatShading: true });
    attachStorybookSurfaceShader(floorMat, this.uniforms, { snowCap: false, isWindow: false });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    g.add(floor);

    const plaster = this.mkMat('#efe7d4');
    const oak = this.mkMat('#6c4b32');
    const oakDark = this.mkMat('#4e3522');
    const brick = this.mkMat('#9b6553');
    const rugMat = this.mkMat('#b65a48');
    const rugTrim = this.mkMat('#e6c88a');
    const lampMat = this.mkMat('#ffe594', { isLantern: true });
    const emberMat = this.mkMat('#ff7a32', { isLantern: true });

    // South, West, East, Ceiling + Framed North Wall with 3 Window Openings
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.25, D + 0.4), oakDark);
    ceiling.position.y = H + 0.12;
    g.add(ceiling);

    // Timber rafters overhead
    for (let z = -3.4; z <= 3.4; z += 1.7) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.28, 0.26), oak);
      beam.position.set(0, H - 0.14, z);
      g.add(beam);
    }

    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.28, H, D), plaster);
    wallW.position.set(-W * 0.5, H * 0.5, 0);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.28, H, D), plaster);
    wallE.position.set(W * 0.5, H * 0.5, 0);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.28), plaster);
    wallS.position.set(0, H * 0.5, D * 0.5);
    g.add(wallW, wallE, wallS);

    // Timber wainscoting along side walls
    for (const [x, rot] of [
      [-W * 0.5 + 0.18, 0],
      [W * 0.5 - 0.18, 0],
    ] as Array<[number, number]>) {
      const wain = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, D - 0.2), oak);
      wain.position.set(x, 0.58, 0);
      wain.rotation.y = rot;
      g.add(wain);
    }

    // North Wall Pillars framing 3 large live-sky windows + Exterior sky backdrop plane
    const skyOutside = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, H + 2), this.skyPaneMat);
    skyOutside.position.set(0, H * 0.5, -D * 0.5 - 1.2);
    g.add(skyOutside);

    const northBottom = new THREE.Mesh(new THREE.BoxGeometry(W, 1.05, 0.28), oak);
    northBottom.position.set(0, 0.52, -D * 0.5);
    const northTop = new THREE.Mesh(new THREE.BoxGeometry(W, 0.7, 0.28), plaster);
    northTop.position.set(0, H - 0.35, -D * 0.5);
    g.add(northBottom, northTop);
    for (const px of [-4.6, -1.6, 1.6, 4.6]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.7, H, 0.34), oak);
      pil.position.set(px, H * 0.5, -D * 0.5);
      g.add(pil);
    }

    // Center Woven Rug
    const rugBase = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.03, 3.3), rugMat);
    rugBase.position.set(-0.2, 0.015, 0.1);
    rugBase.receiveShadow = true;
    const rugIn = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.034, 2.6), rugTrim);
    rugIn.position.set(-0.2, 0.018, 0.1);
    g.add(rugBase, rugIn);

    // West Wall Brick Fireplace & Animated Flickering Flame
    const hearthBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 2.5), brick);
    hearthBase.position.set(-W * 0.5 + 0.55, 0.12, -0.3);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.85, H, 1.85), brick);
    chimney.position.set(-W * 0.5 + 0.42, H * 0.5, -0.3);
    const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.05, 1.2), oakDark);
    firebox.position.set(-W * 0.5 + 0.72, 0.75, -0.3);
    g.add(hearthBase, chimney, firebox);

    for (let f = 0; f < 3; f++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 5), emberMat);
      fl.position.set(-W * 0.5 + 0.85, 0.52, -0.55 + f * 0.25);
      this.flameCones.push(fl);
      g.add(fl);
    }
    this.hearthLight.position.set(-W * 0.5 + 1.35, 1.05, -0.3);
    g.add(this.hearthLight);

    // Framed O'Neill Cylinder Blueprint Poster mounted prominently above the brick fireplace mantel
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 1.75), oakDark);
    frame.position.set(-W * 0.5 + 0.87, 2.38, -0.3);
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(1.62, 1.02),
      new THREE.MeshBasicMaterial({ map: bpTex }),
    );
    poster.rotation.y = Math.PI * 0.5;
    poster.position.set(-W * 0.5 + 0.93, 2.38, -0.3);
    g.add(frame, poster);

    // East Tea & Café Bar Counter + Ketlle + Hanging Lanterns + Barrels
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 4.4), oak);
    counter.position.set(3.2, 0.52, -0.6);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.1, 4.55), this.mkMat('#d8ccb2'));
    counterTop.position.set(3.2, 1.08, -0.6);
    g.add(counter, counterTop);

    // Espresso teapot & mugs on counter
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 8), this.mkMat('#c96b4b'));
    pot.position.set(3.15, 1.28, -1.2);
    g.add(pot);
    for (let s = 0; s < 3; s++) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.65, 8), oak);
      stool.position.set(2.25, 0.32, -1.8 + s * 1.15);
      g.add(stool);
    }

    // Oak Dining Table + Candle Lamp + Bookshelf + Indoor Jacaranda Tree
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 12), oak);
    tableTop.position.set(-0.8, 0.78, -0.8);
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.76, 8), oakDark);
    tableLeg.position.set(-0.8, 0.38, -0.8);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 8), lampMat);
    candle.position.set(-0.8, 0.94, -0.8);
    g.add(tableTop, tableLeg, candle);

    for (const lx of [-2.4, 0.6, 3.2]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5), oakDark);
      cord.position.set(lx, H - 0.5, -0.5);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.28, 8), lampMat);
      shade.position.set(lx, H - 1.05, -0.5);
      g.add(cord, shade);
    }

    // Bookshelf by North-East corner
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.6, 0.55), oak);
    shelf.position.set(3.4, 1.3, -3.7);
    g.add(shelf);
    const bookColors = ['#c9624e', '#4b7992', '#dfb15b', '#6d9b62'];
    for (let b = 0; b < 8; b++) {
      const bk = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.36, 0.34),
        this.mkMat(bookColors[b % bookColors.length]),
      );
      bk.position.set(2.8 + b * 0.18, 1.75 + (b % 2) * 0.55, -3.55);
      g.add(bk);
    }

    // Cozy Shiba Companion resting near hearth
    const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.42), this.mkMat('#d98c4a'));
    dogBody.position.set(-2.6, 0.2, 0.4);
    const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.36), this.mkMat('#e6a260'));
    dogHead.position.set(-2.3, 0.42, 0.4);
    g.add(dogBody, dogHead);

    // Clickable South Exit Door
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.55, 0.34), oakDark);
    doorFrame.position.set(0, 1.28, D * 0.5 - 0.05);
    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.22, 2.35, 0.38), this.mkMat('#7c5234'));
    doorLeaf.position.set(0, 1.22, D * 0.5 - 0.05);
    doorLeaf.userData.action = 'exit';
    const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), lampMat);
    doorKnob.position.set(0.42, 1.1, D * 0.5 - 0.25);
    g.add(doorFrame, doorLeaf, doorKnob);
    this.doorMeshes.push(doorLeaf);
  }

  private buildGreenhouse(): void {
    const g = this.greenhouseGroup;
    const W = 9.8;
    const D = 8.4;
    const H = 4.3;

    const paverTex = buildPlankFloorTexture('greenhouse');
    this.texs.push(paverTex);
    const floorMat = new THREE.MeshLambertMaterial({ map: paverTex, flatShading: true });
    attachStorybookSurfaceShader(floorMat, this.uniforms, { snowCap: false, isWindow: false });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    g.add(floor);

    const iron = this.mkMat('#475a4e');
    const stone = this.mkMat('#c9c1af');
    const cedar = this.mkMat('#9b734e');
    const leafGreen = this.mkMat('#689e52');
    const bloomViolet = this.mkMat('#9d7be0');
    const potCol = this.mkMat('#c07152');
    const lampMat = this.mkMat('#ffe796', { isLantern: true });

    // Exterior Live Sky Box wrapping glass house
    const skyBackN = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), this.skyPaneMat);
    skyBackN.position.set(0, 3.2, -D * 0.5 - 1.4);
    const skyRoof = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), this.skyPaneMat);
    skyRoof.rotation.x = Math.PI * 0.5;
    skyRoof.position.set(0, H + 1.0, 0);
    g.add(skyBackN, skyRoof);

    // Stone Knee Walls + Slender Victorian Conservatory Iron Ribs
    for (const [x, z, w, d] of [
      [-W * 0.5, 0, 0.28, D],
      [W * 0.5, 0, 0.28, D],
      [0, -D * 0.5, W, 0.28],
    ] as Array<[number, number, number, number]>) {
      const knee = new THREE.Mesh(new THREE.BoxGeometry(w, 0.95, d), stone);
      knee.position.set(x, 0.48, z);
      g.add(knee);
    }

    for (let z = -D * 0.5 + 0.5; z <= D * 0.5 - 0.5; z += 1.8) {
      const colL = new THREE.Mesh(new THREE.BoxGeometry(0.14, H, 0.14), iron);
      colL.position.set(-W * 0.5 + 0.08, H * 0.5, z);
      const colR = new THREE.Mesh(new THREE.BoxGeometry(0.14, H, 0.14), iron);
      colR.position.set(W * 0.5 - 0.08, H * 0.5, z);
      const rafterL = new THREE.Mesh(new THREE.BoxGeometry(W * 0.54, 0.12, 0.12), iron);
      rafterL.position.set(-W * 0.25, H + 0.4, z);
      rafterL.rotation.z = 0.25;
      const rafterR = new THREE.Mesh(new THREE.BoxGeometry(W * 0.54, 0.12, 0.12), iron);
      rafterR.position.set(W * 0.25, H + 0.4, z);
      rafterR.rotation.z = -0.25;
      g.add(colL, colR, rafterL, rafterR);
    }

    // Cedar Potting Benches packed with Lush Ferns & Potted Jacaranda Saplings
    for (const bx of [-3.3, 3.3]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 5.4), cedar);
      bench.position.set(bx, 0.45, -0.4);
      g.add(bench);

      for (let i = 0; i < 4; i++) {
        const pz = -2.3 + i * 1.3;
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.34, 8), potCol);
        pot.position.set(bx, 1.08, pz);
        const foliage = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.42, 1),
          i % 2 === 0 ? bloomViolet : leafGreen,
        );
        foliage.position.set(bx, 1.48, pz);
        g.add(pot, foliage);
      }
    }

    // Center Ornamental Indoor Jacaranda Tree + Timber Garden Bench + Hanging Lanterns
    const planPot = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.58, 0.65, 10), stone);
    planPot.position.set(0, 0.32, -1.6);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.4, 7), cedar);
    trunk.position.set(0, 1.25, -1.6);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), bloomViolet);
    crown.scale.set(1.25, 0.78, 1.25);
    crown.position.set(0, 2.2, -1.6);
    g.add(planPot, trunk, crown);

    for (const [lx, lz] of [
      [-1.8, -1.4],
      [1.8, -1.4],
      [0, 1.4],
    ] as Array<[number, number]>) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), iron);
      cord.position.set(lx, H - 0.3, lz);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), lampMat);
      bulb.position.set(lx, H - 0.9, lz);
      g.add(cord, bulb);
    }

    // Clickable Exit Door (South)
    const exitFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.3), iron);
    exitFrame.position.set(0, 1.3, D * 0.5);
    const exitGlass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.35, 0.34), this.mkMat('#94b8ad'));
    exitGlass.position.set(0, 1.22, D * 0.5);
    exitGlass.userData.action = 'exit';
    g.add(exitFrame, exitGlass);
    this.doorMeshes.push(exitGlass);
  }

  setRoom(kind: InteriorKind): void {
    this.kind = kind;
    this.tavernGroup.visible = kind === 'tavern';
    this.greenhouseGroup.visible = kind === 'greenhouse';
  }

  getRoom(): InteriorKind {
    return this.kind;
  }

  getRoomBounds(kind: InteriorKind): RoomBounds & { height: number } {
    if (kind === 'tavern') {
      return { minX: -4.45, maxX: 4.45, minZ: -3.7, maxZ: 3.7, height: 4.2 };
    }
    return { minX: -4.25, maxX: 4.25, minZ: -3.6, maxZ: 3.6, height: 4.3 };
  }

  getColliders(kind: InteriorKind): Collider2D[] {
    if (kind === 'tavern') {
      return [
        // West brick fireplace hearth
        { kind: 'box', minX: -5.1, maxX: -3.95, minZ: -1.65, maxZ: 1.05 },
        // East café bar counter + barstools
        { kind: 'box', minX: 2.05, maxX: 3.95, minZ: -2.95, maxZ: 1.75 },
        // Center oak dining table
        { kind: 'circle', x: -0.8, z: -0.8, r: 0.92 },
        // NE bookshelf
        { kind: 'box', minX: 2.45, maxX: 4.35, minZ: -4.05, maxZ: -3.35 },
        // Companion Shiba resting near hearth
        { kind: 'circle', x: -2.5, z: 0.4, r: 0.45 },
      ];
    }
    return [
      // West & East cedar potting benches
      { kind: 'box', minX: -4.1, maxX: -2.55, minZ: -3.15, maxZ: 2.35 },
      { kind: 'box', minX: 2.55, maxX: 4.1, minZ: -3.15, maxZ: 2.35 },
      // Center ornamental Jacaranda planter
      { kind: 'circle', x: 0, z: -1.6, r: 0.85 },
    ];
  }

  getExitTarget(kind: InteriorKind): DoorwayTarget {
    return {
      x: 0,
      z: kind === 'tavern' ? 3.55 : 3.45,
      label: '🚪 推门回到街道 (E)',
      action: 'exit_interior',
    };
  }

  pickDoor(raycaster: THREE.Raycaster): boolean {
    const active = this.kind === 'tavern' ? this.tavernGroup : this.greenhouseGroup;
    const hits = raycaster.intersectObjects(
      this.doorMeshes.filter((d) => d.parent === active),
      false,
    );
    return hits.length > 0;
  }

  applyAtmosphere(timeMode: TimeMode): void {
    const isNight = timeMode === 'night' || timeMode === 'eclipse';
    this.skyPaneMat.map = isNight ? this.winNightTex : this.winDayTex;
    this.skyPaneMat.needsUpdate = true;
    if (isNight) {
      this.skyPaneMat.color.set('#d2e0ff');
      this.sunBeamLight.intensity = 0.28;
      this.sunBeamLight.color.set('#7a9ad6');
      this.ambHemi.intensity = 0.62;
      this.ambHemi.color.set('#5a6d94');
    } else if (timeMode === 'sunset') {
      this.skyPaneMat.color.set('#ffbfa0');
      this.sunBeamLight.intensity = 1.15;
      this.sunBeamLight.color.set('#ffb375');
      this.ambHemi.intensity = 0.95;
      this.ambHemi.color.set('#f0cdb8');
    } else {
      this.skyPaneMat.color.set('#ffffff');
      this.sunBeamLight.intensity = 1.4;
      this.sunBeamLight.color.set('#fff2d6');
      this.ambHemi.intensity = 1.05;
      this.ambHemi.color.set('#f2e8d4');
    }
  }

  update(simTime: number): void {
    this.hearthLight.intensity = 2.1 + Math.sin(simTime * 11.5) * 0.25 + Math.cos(simTime * 17.3) * 0.15;
    this.flameCones.forEach((cone, idx) => {
      const s = 0.85 + Math.sin(simTime * 12 + idx * 1.9) * 0.22;
      cone.scale.set(1, s, 1);
    });
  }

  dispose(): void {
    for (const t of this.texs) t.dispose();
  }
}
