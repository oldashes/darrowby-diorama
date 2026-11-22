import * as THREE from 'three';
import { WorldShaderUniforms, attachStorybookSurfaceShader } from '../assets/modelLibrary';
import {
  CYLINDER_OMEGA,
  CYLINDER_RADIUS,
  ENDCAP_DEPTH,
  ENDCAP_Z_START,
  endcapFloorY,
  endcapGravityFactor,
  endcapSlopeAngle,
  getCylinderZoneLabel,
  isInSkylightBay,
  wrapArcS,
} from './cylinderWorld';

export type Collider2D =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number };

export interface DoorwayTarget {
  x: number;
  z: number;
  label: string;
  action: 'enter_tavern' | 'enter_greenhouse' | 'exit_interior';
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PlayerStateSnapshot {
  x: number;
  y: number;
  z: number;
  arcS: number;
  barrelAngleDeg: number;
  effectiveG: number;
  coriolisShiftG: number;
  zoneLabel: string;
  isZeroG: boolean;
  facingYaw: number;
  speed: number;
  grounded: boolean;
  isSprinting: boolean;
  isGliding: boolean;
  heightAboveGround: number;
}

function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Stylized low-poly Ghibli/BotW-inspired traveler with articulated limbs,
 * fluttering scarf, leather pack, contact shadow, and deployable paraglider.
 * Local forward faces +Z (back/backpack faces -Z).
 */
export class TravelerAvatar {
  readonly root = new THREE.Group();
  readonly bodyGroup = new THREE.Group();
  readonly shadowMesh: THREE.Mesh;

  private torsoGroup = new THREE.Group();
  private headGroup = new THREE.Group();
  private leftLegPivot = new THREE.Group();
  private rightLegPivot = new THREE.Group();
  private leftArmPivot = new THREE.Group();
  private rightArmPivot = new THREE.Group();
  private scarfPivot = new THREE.Group();
  private gliderGroup = new THREE.Group();

  private walkPhase = 0;
  private landSquash = 0;
  private wasGrounded = true;
  private gliderScale = 0;
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];

  constructor(uniforms: WorldShaderUniforms) {
    const mkMat = (hex: string, opts: { doubleSide?: boolean } = {}): THREE.MeshLambertMaterial => {
      const m = new THREE.MeshLambertMaterial({
        color: hex,
        flatShading: true,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      attachStorybookSurfaceShader(m, uniforms, { snowCap: false, isWindow: false });
      this.mats.push(m);
      return m;
    };
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geos.push(g);
      return g;
    };

    const tunicMat = mkMat('#4e8ea8');
    const tunicHemMat = mkMat('#3c7288');
    const pantsMat = mkMat('#5b5044');
    const bootsMat = mkMat('#4d3525');
    const skinMat = mkMat('#f2ccb0');
    const hairMat = mkMat('#5a3e2b');
    const capMat = mkMat('#427c92');
    const scarfMat = mkMat('#d96b52', { doubleSide: true });
    const packMat = mkMat('#9c6b43');
    const bedrollMat = mkMat('#e8d9b8');
    const sparMat = mkMat('#694b32');
    const sailMat = mkMat('#f4ebd6', { doubleSide: true });
    const sailTrimMat = mkMat('#c9624c', { doubleSide: true });

    // Grounded contact shadow decoupled in Y so it hugs terrain while jumping/gliding
    const shadowGeo = trackGeo(new THREE.CircleGeometry(0.32, 16));
    shadowGeo.rotateX(-Math.PI * 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: '#1b242c',
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.mats.push(shadowMat);
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.position.y = 0.025;
    this.root.add(this.shadowMesh);

    this.root.add(this.bodyGroup);

    // Legs (hip pivot y = 0.42)
    const legGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.34, 0.12));
    const bootGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.12, 0.18));
    for (const [pivot, x] of [
      [this.leftLegPivot, -0.09],
      [this.rightLegPivot, 0.09],
    ] as Array<[THREE.Group, number]>) {
      pivot.position.set(x, 0.42, 0);
      const leg = new THREE.Mesh(legGeo, pantsMat);
      leg.position.set(0, -0.17, 0);
      leg.castShadow = true;
      const boot = new THREE.Mesh(bootGeo, bootsMat);
      boot.position.set(0, -0.36, 0.03);
      boot.castShadow = true;
      pivot.add(leg, boot);
      this.bodyGroup.add(pivot);
    }

    // Torso & Explorer Pack
    this.torsoGroup.position.set(0, 0.42, 0);
    this.bodyGroup.add(this.torsoGroup);

    const tunic = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.21, 0.38, 8)), tunicMat);
    tunic.position.y = 0.21;
    tunic.castShadow = true;
    const hem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.20, 0.23, 0.12, 8)), tunicHemMat);
    hem.position.y = 0.05;
    this.torsoGroup.add(tunic, hem);

    // Leather backpack + cream bedroll on back (-Z)
    const pack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.28, 0.14)), packMat);
    pack.position.set(0, 0.22, -0.16);
    pack.castShadow = true;
    const bedroll = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 8)), bedrollMat);
    bedroll.rotation.z = Math.PI * 0.5;
    bedroll.position.set(0, 0.38, -0.16);
    this.torsoGroup.add(pack, bedroll);

    // Fluttering scarf tail extending toward -Z
    this.scarfPivot.position.set(0, 0.39, -0.08);
    const scarfRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.12, 0.04, 6, 12)), scarfMat);
    scarfRing.rotation.x = Math.PI * 0.5;
    scarfRing.position.set(0, 0.01, 0.08);
    const scarfTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.03, 0.34)), scarfMat);
    scarfTail.position.set(0.02, -0.04, -0.16);
    scarfTail.rotation.x = 0.25;
    this.scarfPivot.add(scarfRing, scarfTail);
    this.torsoGroup.add(this.scarfPivot);

    // Arms (shoulder pivot y = 0.34 in torsoGroup)
    const armGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.28, 0.09));
    const handGeo = trackGeo(new THREE.SphereGeometry(0.055, 6, 6));
    for (const [pivot, x] of [
      [this.leftArmPivot, -0.20],
      [this.rightArmPivot, 0.20],
    ] as Array<[THREE.Group, number]>) {
      pivot.position.set(x, 0.34, 0);
      const arm = new THREE.Mesh(armGeo, tunicMat);
      arm.position.set(0, -0.13, 0);
      arm.castShadow = true;
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(0, -0.27, 0.01);
      pivot.add(arm, hand);
      this.torsoGroup.add(pivot);
    }

    // Head + Hair + Cap
    this.headGroup.position.set(0, 0.48, 0);
    const head = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.155, 1)), skinMat);
    head.position.y = 0.08;
    head.castShadow = true;
    const hairBack = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.162, 1)), hairMat);
    hairBack.position.set(0, 0.1, -0.03);
    const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.165, 0.18, 8)), capMat);
    cap.position.set(0, 0.22, -0.05);
    cap.rotation.x = -0.38;
    this.headGroup.add(head, hairBack, cap);
    this.torsoGroup.add(this.headGroup);

    // Deployable Zelda Paraglider mounted above head/shoulders
    this.gliderGroup.position.set(0, 1.24, 0.05);
    this.gliderGroup.visible = false;
    const centerRod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.04, 0.72)), sparMat);
    const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.03, 0.03)), sparMat);
    bar.position.set(0, -0.3, 0.05);
    const strL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.025, 0.32, 0.025)), sparMat);
    strL.position.set(-0.2, -0.15, 0.05);
    const strR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.025, 0.32, 0.025)), sparMat);
    strR.position.set(0.2, -0.15, 0.05);

    const wingGeo = trackGeo(new THREE.BoxGeometry(0.86, 0.035, 0.64));
    const wingL = new THREE.Mesh(wingGeo, sailMat);
    wingL.position.set(-0.42, 0.04, -0.02);
    wingL.rotation.z = 0.14;
    const wingR = new THREE.Mesh(wingGeo, sailMat);
    wingR.position.set(0.42, 0.04, -0.02);
    wingR.rotation.z = -0.14;

    const trimGeo = trackGeo(new THREE.BoxGeometry(0.86, 0.042, 0.12));
    const trimL = new THREE.Mesh(trimGeo, sailTrimMat);
    trimL.position.set(-0.42, 0.04, -0.28);
    trimL.rotation.z = 0.14;
    const trimR = new THREE.Mesh(trimGeo, sailTrimMat);
    trimR.position.set(0.42, 0.04, -0.28);
    trimR.rotation.z = -0.14;

    this.gliderGroup.add(centerRod, bar, strL, strR, wingL, wingR, trimL, trimR);
    this.bodyGroup.add(this.gliderGroup);
  }

  animate(
    dt: number,
    speed: number,
    grounded: boolean,
    isGliding: boolean,
    isSprinting: boolean,
    slopeTiltZ: number,
    heightAboveGround: number,
    simTime: number,
  ): void {
    if (!this.wasGrounded && grounded) {
      this.landSquash = 1.0;
    }
    this.wasGrounded = grounded;
    this.landSquash = Math.max(0, this.landSquash - dt * 5.5);

    // Glider open/fold spring
    const targetGlider = isGliding ? 1.0 : 0.0;
    this.gliderScale += (targetGlider - this.gliderScale) * Math.min(1, dt * 13);
    this.gliderGroup.visible = this.gliderScale > 0.03;
    this.gliderGroup.scale.setScalar(Math.max(0.01, this.gliderScale));

    // Decoupled terrain shadow shrinks softly as altitude grows
    this.shadowMesh.position.y = -heightAboveGround + 0.025;
    const sScale = Math.max(0.45, 1.0 - heightAboveGround * 0.1);
    this.shadowMesh.scale.setScalar(sScale);

    // Lateral lean into curved O'Neill valley + landing squash
    const squashY = 1 - Math.sin(this.landSquash * Math.PI) * 0.14;
    const squashXZ = 1 + Math.sin(this.landSquash * Math.PI) * 0.1;
    this.bodyGroup.scale.set(squashXZ, squashY, squashXZ);
    this.bodyGroup.rotation.z = -slopeTiltZ;

    if (isGliding) {
      this.leftArmPivot.rotation.x = -2.45;
      this.rightArmPivot.rotation.x = -2.45;
      this.leftLegPivot.rotation.x = 0.25 + Math.sin(simTime * 5) * 0.08;
      this.rightLegPivot.rotation.x = 0.45 - Math.sin(simTime * 5) * 0.08;
      this.torsoGroup.rotation.x = 0.22;
      this.torsoGroup.position.y = 0.42;
      this.scarfPivot.rotation.x = -0.35 + Math.sin(simTime * 14) * 0.18;
      return;
    }

    if (!grounded) {
      this.leftLegPivot.rotation.x = -0.35;
      this.rightLegPivot.rotation.x = 0.35;
      this.leftArmPivot.rotation.x = -0.8;
      this.rightArmPivot.rotation.x = -0.55;
      this.torsoGroup.rotation.x = 0.08;
      this.torsoGroup.position.y = 0.42;
      this.scarfPivot.rotation.x = -0.25 + Math.sin(simTime * 10) * 0.14;
      return;
    }

    if (speed > 0.25) {
      const freq = isSprinting ? 13.5 : 9.2;
      this.walkPhase += dt * freq;
      const swing = Math.min(0.88, speed * 0.11);
      const s = Math.sin(this.walkPhase);
      this.leftLegPivot.rotation.x = s * swing;
      this.rightLegPivot.rotation.x = -s * swing;
      this.leftArmPivot.rotation.x = -s * swing * 0.85;
      this.rightArmPivot.rotation.x = s * swing * 0.85;
      this.torsoGroup.position.y = 0.42 + Math.abs(Math.cos(this.walkPhase)) * 0.048;
      this.torsoGroup.rotation.x = isSprinting ? 0.18 : 0.08;
      this.scarfPivot.rotation.x = -0.15 - Math.min(0.45, speed * 0.05) + Math.sin(simTime * 12) * 0.12;
    } else {
      const idleEase = Math.min(1, dt * 10);
      this.leftLegPivot.rotation.x += (0 - this.leftLegPivot.rotation.x) * idleEase;
      this.rightLegPivot.rotation.x += (0 - this.rightLegPivot.rotation.x) * idleEase;
      this.leftArmPivot.rotation.x += (0 - this.leftArmPivot.rotation.x) * idleEase;
      this.rightArmPivot.rotation.x += (0 - this.rightArmPivot.rotation.x) * idleEase;
      this.torsoGroup.rotation.x += (0 - this.torsoGroup.rotation.x) * idleEase;
      this.torsoGroup.position.y = 0.42 + Math.sin(simTime * 2.4) * 0.014;
      this.scarfPivot.rotation.x = 0.04 + Math.sin(simTime * 3.1) * 0.07;
    }
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}

function resolveColliders(
  x: number,
  z: number,
  playerRadius: number,
  colliders: readonly Collider2D[],
  bounds: RoomBounds,
): [number, number] {
  let px = x;
  let pz = z;

  for (let pass = 0; pass < 3; pass++) {
    for (const c of colliders) {
      if (c.kind === 'circle') {
        const dx = px - c.x;
        const dz = pz - c.z;
        const minD = playerRadius + c.r;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          if (d > 1e-4) {
            const push = (minD - d) / d;
            px += dx * push;
            pz += dz * push;
          } else {
            pz += minD;
          }
        }
      } else {
        const qx = Math.max(c.minX, Math.min(c.maxX, px));
        const qz = Math.max(c.minZ, Math.min(c.maxZ, pz));
        const dx = px - qx;
        const dz = pz - qz;
        const dSq = dx * dx + dz * dz;
        if (dSq < playerRadius * playerRadius) {
          const d = Math.sqrt(dSq);
          if (d > 1e-4) {
            const push = (playerRadius - d) / d;
            px += dx * push;
            pz += dz * push;
          } else {
            // Inside box fallback: push toward nearest box face
            const dl = Math.abs(px - c.minX);
            const dr = Math.abs(c.maxX - px);
            const dt = Math.abs(pz - c.minZ);
            const db = Math.abs(c.maxZ - pz);
            const m = Math.min(dl, dr, dt, db);
            if (m === dl) px = c.minX - playerRadius;
            else if (m === dr) px = c.maxX + playerRadius;
            else if (m === dt) pz = c.minZ - playerRadius;
            else pz = c.maxZ + playerRadius;
          }
        }
      }
    }
    px = Math.max(bounds.minX, Math.min(bounds.maxX, px));
    pz = Math.max(bounds.minZ, Math.min(bounds.maxZ, pz));
  }

  return [px, pz];
}

/**
 * Zelda-inspired third-person character controller supporting camera-aligned
 * continuous walk/sprint, jumping, BotW paragliding off curved cylinder slopes,
 * and smooth sliding collision against buildings/props.
 */
export class PlayerController {
  readonly avatar: TravelerAvatar;
  readonly pos = new THREE.Vector3(0, 0, 2.2);
  readonly vel = new THREE.Vector3();

  /** Circumferential coordinate (meters) along the O'Neill R=320 barrel when outdoors. */
  arcS = -0.4;
  effectiveG = 1.0;
  coriolisShiftG = 0.0;
  isZeroG = false;

  facingYaw = Math.PI;
  grounded = true;
  isSprinting = false;
  isGliding = false;

  private inputRight = 0;
  private inputForward = 0;
  private sprintHeld = false;
  private sprintToggled = false;
  private heightAboveGround = 0;
  private isInteriorMode = false;

  constructor(uniforms: WorldShaderUniforms) {
    this.avatar = new TravelerAvatar(uniforms);
    this.avatar.bodyGroup.rotation.y = this.facingYaw;
  }

  setMoveInput(right: number, forward: number, sprintHeld = false): void {
    const mag = Math.hypot(right, forward);
    if (mag > 1) {
      this.inputRight = right / mag;
      this.inputForward = forward / mag;
    } else {
      this.inputRight = right;
      this.inputForward = forward;
    }
    this.sprintHeld = sprintHeld;
  }

  hasActiveMoveInput(): boolean {
    return Math.hypot(this.inputRight, this.inputForward) > 0.08;
  }

  setSprintToggle(on: boolean): void {
    this.sprintToggled = on;
  }

  isSprintToggled(): boolean {
    return this.sprintToggled;
  }

  triggerJumpOrGlide(allowGlide: boolean): 'jump' | 'glide_open' | 'glide_close' | 'none' {
    if (this.grounded || this.isZeroG) {
      this.vel.y = this.isInteriorMode ? 5.6 : this.isZeroG ? 3.2 : 7.8;
      this.grounded = false;
      this.isGliding = false;
      return 'jump';
    }
    if (allowGlide) {
      this.isGliding = !this.isGliding;
      return this.isGliding ? 'glide_open' : 'glide_close';
    }
    return 'none';
  }

  getCylinderFloorY(arcS: number, z: number): number {
    if (z < ENDCAP_Z_START) return endcapFloorY(z);
    const boxEdge = Math.max(Math.abs(arcS), Math.abs(z));
    const t = Math.max(0, Math.min(1, (boxEdge - 11.5) / 12.5));
    const s = t * t * (3 - 2 * t);
    return -0.045 * (1 - s);
  }

  teleport(arcOrX: number, z: number, groundY: number, facingYaw = Math.PI, isInterior = false): void {
    this.isInteriorMode = isInterior;
    if (isInterior) {
      this.arcS = 0;
      this.pos.set(arcOrX, groundY, z);
      this.effectiveG = 1.0;
      this.coriolisShiftG = 0.0;
      this.isZeroG = false;
      this.avatar.root.rotation.x = 0;
    } else {
      this.arcS = wrapArcS(arcOrX);
      const y = this.getCylinderFloorY(this.arcS, z);
      this.pos.set(0, Number.isFinite(groundY) ? Math.max(y, groundY) : y, z);
      const baseG = endcapGravityFactor(z);
      this.isZeroG = baseG <= 0.15;
      this.effectiveG = this.isZeroG ? 0.0 : baseG;
      this.coriolisShiftG = 0;
      this.avatar.root.rotation.x = this.isZeroG ? 0.18 : endcapSlopeAngle(z) * 0.85;
    }
    this.vel.set(0, 0, 0);
    this.grounded = !this.isZeroG;
    this.isGliding = false;
    this.heightAboveGround = 0;
    this.facingYaw = facingYaw;
    this.avatar.root.position.copy(this.pos);
    this.avatar.bodyGroup.rotation.y = this.facingYaw;
  }

  getSnapshot(): PlayerStateSnapshot {
    const rawDeg = ((this.arcS / CYLINDER_RADIUS) * 180) / Math.PI;
    const barrelAngleDeg = ((rawDeg % 360) + 360) % 360;
    return {
      x: this.isInteriorMode ? this.pos.x : 0,
      y: this.pos.y,
      z: this.pos.z,
      arcS: this.isInteriorMode ? 0 : this.arcS,
      barrelAngleDeg: this.isInteriorMode ? 0 : barrelAngleDeg,
      effectiveG: this.effectiveG,
      coriolisShiftG: this.coriolisShiftG,
      zoneLabel: this.isInteriorMode ? '室内空间 · 1.00 G' : getCylinderZoneLabel(this.arcS, this.pos.z),
      isZeroG: this.isZeroG,
      facingYaw: this.facingYaw,
      speed: Math.hypot(this.vel.x, this.vel.z),
      grounded: this.grounded,
      isSprinting: this.isSprinting,
      isGliding: this.isGliding,
      heightAboveGround: this.heightAboveGround,
    };
  }

  step(
    dt: number,
    cameraYaw: number,
    bounds: RoomBounds,
    getGroundY: (x: number, z: number) => number,
    _getSlopeTilt: (x: number, z: number) => number,
    colliders: readonly Collider2D[],
    allowGlide: boolean,
    isInterior: boolean,
    simTime: number,
  ): void {
    this.isInteriorMode = isInterior;
    const inputMag = Math.min(1, Math.hypot(this.inputRight, this.inputForward));
    this.isSprinting = inputMag > 0.12 && (this.sprintHeld || this.sprintToggled || inputMag > 0.88);

    // Camera-aligned wish vector on XZ plane (camera looks down -sin(yaw), -cos(yaw))
    const sinY = Math.sin(cameraYaw);
    const cosY = Math.cos(cameraYaw);
    const wishX = -sinY * this.inputForward + cosY * this.inputRight;
    const wishZ = -cosY * this.inputForward - sinY * this.inputRight;

    if (isInterior) {
      const maxSpeed = this.isSprinting ? 5.0 : 3.3;
      const accel = this.grounded ? 18 : 8.0;
      const k = Math.min(1, dt * accel);
      this.vel.x += (wishX * maxSpeed - this.vel.x) * k;
      this.vel.z += (wishZ * maxSpeed - this.vel.z) * k;
      this.isGliding = false;
      this.vel.y -= 19.5 * dt;
      this.effectiveG = 1.0;
      this.coriolisShiftG = 0.0;
      this.isZeroG = false;

      const nextX = this.pos.x + this.vel.x * dt;
      const nextZ = this.pos.z + this.vel.z * dt;
      const [rx, rz] = resolveColliders(nextX, nextZ, 0.42, colliders, bounds);
      if (Math.abs(rx - nextX) > 0.001) this.vel.x *= 0.25;
      if (Math.abs(rz - nextZ) > 0.001) this.vel.z *= 0.25;
      this.pos.x = rx;
      this.pos.z = rz;

      this.pos.y += this.vel.y * dt;
      const floorY = getGroundY(this.pos.x, this.pos.z);
      if (this.pos.y <= floorY + 0.005 && this.vel.y <= 0) {
        this.pos.y = floorY;
        this.vel.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
      this.heightAboveGround = Math.max(0, this.pos.y - floorY);
      this.avatar.root.rotation.x = 0;
    } else {
      // Co-rotating O'Neill cylinder physics (x=0 locally; arcS wraps cleanly modulo 2πR)
      const isNearTown = Math.abs(this.arcS) < 22 && this.pos.z > -22;
      const maxSpeed = this.isGliding
        ? 16.0
        : this.isSprinting
          ? isNearTown
            ? 9.5
            : 22.0
          : isNearTown
            ? 5.2
            : 9.6;

      const accel = this.isZeroG ? 4.2 : this.grounded ? 18 : this.isGliding ? 5.5 : 7.5;
      const k = Math.min(1, dt * accel);
      this.vel.x += (wishX * maxSpeed - this.vel.x) * k;
      this.vel.z += (wishZ * maxSpeed - this.vel.z) * k;

      if (!allowGlide) this.isGliding = false;

      const baseG = endcapGravityFactor(this.pos.z);
      this.isZeroG = baseG <= 0.15;

      if (this.isZeroG) {
        this.coriolisShiftG = 0;
        this.effectiveG = 0;
        this.isGliding = false;
        const targetHover = 1.6 + Math.sin(simTime * 1.6) * 0.45;
        const floorHub = endcapFloorY(this.pos.z);
        const alt = this.pos.y - floorHub;
        this.vel.y += ((targetHover - alt) * 2.2 - this.vel.y * 1.8) * dt;
        this.grounded = false;
      } else {
        // Real rotating-frame vertical Coriolis shift: spinward (+vel.x) increases apparent G; anti-spinward lowers it
        this.coriolisShiftG = (2 * CYLINDER_OMEGA * this.vel.x) / 19.5;
        this.effectiveG = Math.max(0.05, baseG + this.coriolisShiftG);
        this.vel.y -= this.effectiveG * 19.5 * dt;

        // Airborne Coriolis horizontal deflection: ax = +2ω * vy
        if (!this.grounded) {
          this.vel.x += 2 * CYLINDER_OMEGA * this.vel.y * dt;
        }
        const glideCap = -1.85 * Math.max(0.4, Math.sqrt(baseG));
        if (this.isGliding && this.vel.y < glideCap) {
          this.vel.y = glideCap;
        }
      }

      const candArcS = wrapArcS(this.arcS + this.vel.x * dt);
      let nextArcS = candArcS;
      let nextZ = this.pos.z + this.vel.z * dt;

      // Glass Sky-Bridge guardrails across the three 40° skylight bays (z ∈ [-20.5, +20.5] on barrel)
      const zMin = ENDCAP_Z_START - ENDCAP_DEPTH;
      const zMax = 118;
      nextZ = Math.max(zMin, Math.min(zMax, nextZ));
      if (nextZ > ENDCAP_Z_START + 2) {
        const wasBay = isInSkylightBay(this.arcS);
        const nowBay = isInSkylightBay(nextArcS);
        if (!wasBay && nowBay && Math.abs(nextZ) > 20.5) {
          nextArcS = this.arcS;
          this.vel.x = 0;
        } else if (wasBay) {
          nextZ = Math.max(-20.5, Math.min(20.5, nextZ));
        }
      }

      // Resolve Strip 0 neighborhood colliders cleanly around arcS=0
      const activeColliders = Math.abs(nextArcS) < 42 && nextZ > -42 && nextZ < 42 ? colliders : [];
      const cylBounds: RoomBounds = { minX: -10000, maxX: 10000, minZ: zMin, maxZ: zMax };
      const [rx, rz] = resolveColliders(nextArcS, nextZ, 0.36, activeColliders, cylBounds);
      if (Math.abs(rx - nextArcS) > 0.001) this.vel.x *= 0.25;
      if (Math.abs(rz - nextZ) > 0.001) this.vel.z *= 0.25;

      this.arcS = wrapArcS(rx);
      this.pos.x = 0;
      this.pos.z = rz;

      this.pos.y += this.vel.y * dt;
      const floorY = this.getCylinderFloorY(this.arcS, this.pos.z);

      if (this.isZeroG) {
        if (this.pos.y < floorY + 0.15) {
          this.pos.y = floorY + 0.15;
          if (this.vel.y < 0) this.vel.y = 0;
        }
        this.grounded = false;
      } else if (this.pos.y <= floorY + 0.005 && this.vel.y <= 0) {
        this.pos.y = floorY;
        this.vel.y = 0;
        this.grounded = true;
        this.isGliding = false;
      } else if (this.pos.y <= floorY + 0.24 && this.grounded && this.vel.y <= 0) {
        // Snap tightly while climbing or descending the continuous curved hemispherical endcap
        this.pos.y = floorY;
        this.vel.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }

      this.heightAboveGround = Math.max(0, this.pos.y - floorY);
      this.avatar.root.rotation.x = this.isZeroG
        ? 0.18 + Math.sin(simTime * 1.4) * 0.12
        : endcapSlopeAngle(this.pos.z) * 0.85;
    }

    if (inputMag > 0.08 && Math.hypot(wishX, wishZ) > 1e-3) {
      const targetYaw = Math.atan2(wishX, wishZ);
      this.facingYaw += shortestAngleDiff(this.facingYaw, targetYaw) * Math.min(1, dt * 13);
    }

    this.avatar.root.position.copy(this.pos);
    this.avatar.bodyGroup.rotation.y = this.facingYaw;

    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.avatar.animate(
      dt,
      horizSpeed,
      this.grounded,
      this.isGliding,
      this.isSprinting,
      0,
      this.heightAboveGround,
      simTime,
    );
  }

  dispose(): void {
    this.avatar.dispose();
  }
}

const TRAIL_MAX_POINTS = 220;

/**
 * Interactive 3D Coriolis Baseball simulation in the co-rotating O'Neill reference frame:
 * launches straight upward from a vertical reference pole and traces real rotating-frame deflection
 * (ax = +2ω·vy, ay = -g_eff - 2ω·vx) onto a highlighted landing marker.
 */
export class CoriolisBallSim {
  readonly root = new THREE.Group();

  private ballMesh: THREE.Mesh;
  private poleTicks: THREE.InstancedMesh;
  private trailPearls: THREE.InstancedMesh;
  private launchPad: THREE.Mesh;
  private landingRing: THREE.Mesh;
  private trailLine: THREE.Line;
  private trailPositions = new Float32Array(TRAIL_MAX_POINTS * 3);
  private trailCount = 0;
  private pearlCount = 0;
  private lastPearlPos = new THREE.Vector3(0, -999, 0);
  private readonly tickDummy = new THREE.Object3D();

  private active = false;
  private idleTimer = 0;
  private launchArcS = 0;
  private groundY = 0;
  private localPos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  lastLandingOffsetX = 0;

  constructor(uniforms: WorldShaderUniforms) {
    this.root.visible = false;

    const ballMat = new THREE.MeshLambertMaterial({ color: '#ff5d38', flatShading: true });
    attachStorybookSurfaceShader(ballMat, uniforms, { snowCap: false, isWindow: false, isLantern: true });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), ballMat);
    this.root.add(this.ballMesh);

    const poleMat = new THREE.MeshBasicMaterial({
      color: '#ffe694',
      transparent: true,
      opacity: 0.72,
    });
    this.poleTicks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), poleMat, 14);
    this.root.add(this.poleTicks);

    const pearlMat = new THREE.MeshBasicMaterial({ color: '#ff8a4c' });
    this.trailPearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), pearlMat, 80);
    this.trailPearls.count = 0;
    this.root.add(this.trailPearls);

    const padMat = new THREE.MeshBasicMaterial({ color: '#ffe082', side: THREE.DoubleSide });
    this.launchPad = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.42, 20), padMat);
    this.launchPad.rotation.x = -Math.PI * 0.5;
    this.root.add(this.launchPad);

    const landMat = new THREE.MeshBasicMaterial({ color: '#4fe3c1', side: THREE.DoubleSide });
    this.landingRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.58, 24), landMat);
    this.landingRing.rotation.x = -Math.PI * 0.5;
    this.landingRing.visible = false;
    this.root.add(this.landingRing);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({ color: '#ffb074' });
    this.trailLine = new THREE.Line(trailGeo, trailMat);
    this.root.add(this.trailLine);
  }

  launch(arcS: number, groundY: number, z: number, playerArcS: number): void {
    this.launchArcS = wrapArcS(arcS);
    this.groundY = groundY;
    const baseG = endcapGravityFactor(z);
    const upSpeed = baseG <= 0.12 ? 6.5 : 14.5;
    const gEst = Math.max(0.15, baseG) * 19.5;
    const estApex = (upSpeed * upSpeed) / (2 * gEst);
    const poleH = Math.min(11, Math.max(4.5, estApex + 0.8));

    this.localPos.set(0, groundY + 1.25, z);
    this.vel.set(0, upSpeed, 0);
    this.active = true;
    this.idleTimer = 0;
    this.lastLandingOffsetX = 0;
    this.root.visible = true;

    for (let i = 0; i < 14; i++) {
      const py = groundY + 0.4 + (i / 13) * poleH;
      this.tickDummy.position.set(0, py, z);
      this.tickDummy.rotation.set(0, 0, 0);
      this.tickDummy.scale.set(1, 1, 1);
      this.tickDummy.updateMatrix();
      this.poleTicks.setMatrixAt(i, this.tickDummy.matrix);
    }
    this.poleTicks.instanceMatrix.needsUpdate = true;

    this.launchPad.position.set(0, groundY + 0.05, z);
    this.landingRing.visible = false;

    this.trailCount = 0;
    this.pearlCount = 0;
    this.trailPearls.count = 0;
    this.lastPearlPos.set(0, -999, 0);
    this.pushTrailPoint(this.localPos);
    this.syncWorldOffset(playerArcS);
  }

  clear(): void {
    this.active = false;
    this.root.visible = false;
    this.landingRing.visible = false;
    this.lastLandingOffsetX = 0;
  }

  isActive(): boolean {
    return this.active;
  }

  private pushTrailPoint(p: THREE.Vector3): void {
    if (this.trailCount < TRAIL_MAX_POINTS) {
      const idx = this.trailCount * 3;
      this.trailPositions[idx] = p.x;
      this.trailPositions[idx + 1] = p.y;
      this.trailPositions[idx + 2] = p.z;
      this.trailCount++;
      const attr = this.trailLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
      this.trailLine.geometry.setDrawRange(0, this.trailCount);
    }
    if (this.pearlCount < 80 && p.distanceTo(this.lastPearlPos) >= 0.42) {
      this.tickDummy.position.copy(p);
      this.tickDummy.rotation.set(0, 0, 0);
      this.tickDummy.scale.set(1, 1, 1);
      this.tickDummy.updateMatrix();
      this.trailPearls.setMatrixAt(this.pearlCount, this.tickDummy.matrix);
      this.pearlCount++;
      this.trailPearls.count = this.pearlCount;
      this.trailPearls.instanceMatrix.needsUpdate = true;
      this.lastPearlPos.copy(p);
    }
  }

  private syncWorldOffset(playerArcS: number): void {
    this.root.position.x = wrapArcS(this.launchArcS - playerArcS);
    this.ballMesh.position.copy(this.localPos);
  }

  step(dt: number, playerArcS: number): void {
    if (!this.root.visible) return;
    if (this.active) {
      const steps = 4;
      const sdt = Math.min(dt, 0.05) / steps;
      for (let i = 0; i < steps; i++) {
        const baseG = endcapGravityFactor(this.localPos.z);
        const gAccel = 19.5 * Math.max(0.03, baseG);
        const ax = 2 * CYLINDER_OMEGA * this.vel.y;
        const ay = -gAccel - 2 * CYLINDER_OMEGA * this.vel.x;
        this.vel.x += ax * sdt;
        this.vel.y += ay * sdt;
        this.localPos.x += this.vel.x * sdt;
        this.localPos.y += this.vel.y * sdt;

        if (this.localPos.y <= this.groundY + 0.2 && this.vel.y < 0) {
          this.localPos.y = this.groundY + 0.2;
          this.active = false;
          this.lastLandingOffsetX = this.localPos.x;
          this.landingRing.position.set(this.localPos.x, this.groundY + 0.06, this.localPos.z);
          this.landingRing.rotation.x = -Math.PI * 0.5 + endcapSlopeAngle(this.localPos.z) * 0.85;
          this.landingRing.visible = true;
          this.pushTrailPoint(this.localPos);
          break;
        }
      }
      if (this.active) {
        this.lastLandingOffsetX = this.localPos.x;
        this.pushTrailPoint(this.localPos);
      }
    } else {
      this.idleTimer += dt;
      if (this.idleTimer > 12) {
        this.root.visible = false;
      }
    }
    this.syncWorldOffset(playerArcS);
  }

  dispose(): void {
    this.ballMesh.geometry.dispose();
    (this.ballMesh.material as THREE.Material).dispose();
    this.poleTicks.geometry.dispose();
    (this.poleTicks.material as THREE.Material).dispose();
    this.trailPearls.geometry.dispose();
    (this.trailPearls.material as THREE.Material).dispose();
    this.launchPad.geometry.dispose();
    (this.launchPad.material as THREE.Material).dispose();
    this.landingRing.geometry.dispose();
    (this.landingRing.material as THREE.Material).dispose();
    this.trailLine.geometry.dispose();
    (this.trailLine.material as THREE.Material).dispose();
  }
}
