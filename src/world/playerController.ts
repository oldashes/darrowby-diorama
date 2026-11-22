import * as THREE from 'three';
import { WorldShaderUniforms, attachStorybookSurfaceShader } from '../assets/modelLibrary';

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
  readonly pos = new THREE.Vector3(-0.4, 0, 2.2);
  readonly vel = new THREE.Vector3();

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
    if (this.grounded) {
      this.vel.y = this.isInteriorMode ? 5.6 : 7.8;
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

  teleport(x: number, z: number, groundY: number, facingYaw = Math.PI, isInterior = false): void {
    this.isInteriorMode = isInterior;
    this.pos.set(x, groundY, z);
    this.vel.set(0, 0, 0);
    this.grounded = true;
    this.isGliding = false;
    this.heightAboveGround = 0;
    this.facingYaw = facingYaw;
    this.avatar.root.position.copy(this.pos);
    this.avatar.bodyGroup.rotation.y = this.facingYaw;
  }

  getSnapshot(): PlayerStateSnapshot {
    return {
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
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
    getSlopeTilt: (x: number, z: number) => number,
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

    const maxSpeed = isInterior
      ? this.isSprinting
        ? 5.0
        : 3.3
      : this.isGliding
        ? 9.6
        : this.isSprinting
          ? 8.8
          : 4.8;

    const accel = this.grounded ? 18 : this.isGliding ? 5.5 : 8.0;
    const targetVx = wishX * maxSpeed;
    const targetVz = wishZ * maxSpeed;
    const k = Math.min(1, dt * accel);
    this.vel.x += (targetVx - this.vel.x) * k;
    this.vel.z += (targetVz - this.vel.z) * k;

    // Gravity / Paraglider descent
    if (!allowGlide) {
      this.isGliding = false;
    }
    this.vel.y -= 19.5 * dt;
    if (this.isGliding && this.vel.y < -1.85) {
      this.vel.y = -1.85;
    }

    const nextX = this.pos.x + this.vel.x * dt;
    const nextZ = this.pos.z + this.vel.z * dt;
    const radius = isInterior ? 0.42 : 0.36;
    const [rx, rz] = resolveColliders(nextX, nextZ, radius, colliders, bounds);

    // Zero velocity along blocked axes if pushed back noticeably
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
      this.isGliding = false;
    } else if (this.pos.y <= floorY + 0.18 && this.grounded && this.vel.y <= 0) {
      // Snap tightly while walking down smooth cylinder hillside
      this.pos.y = floorY;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.heightAboveGround = Math.max(0, this.pos.y - floorY);

    if (inputMag > 0.08 && Math.hypot(wishX, wishZ) > 1e-3) {
      const targetYaw = Math.atan2(wishX, wishZ);
      this.facingYaw += shortestAngleDiff(this.facingYaw, targetYaw) * Math.min(1, dt * 13);
    }

    this.avatar.root.position.copy(this.pos);
    this.avatar.bodyGroup.rotation.y = this.facingYaw;

    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const slopeTilt = getSlopeTilt(this.pos.x, this.pos.z);
    this.avatar.animate(
      dt,
      horizSpeed,
      this.grounded,
      this.isGliding,
      this.isSprinting,
      slopeTilt,
      this.heightAboveGround,
      simTime,
    );
  }

  dispose(): void {
    this.avatar.dispose();
  }
}
