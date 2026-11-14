import * as THREE from 'three';
import { HERO } from '../sim/balance';
import { clamp, lerp } from '../sim/math';
import type { ActionId, UnitState } from '../sim/types';
import type { FigureColors } from './palette';

/** What a figure needs from the sim each frame to pose itself. */
export interface AnimInput {
  state: UnitState;
  stateTime: number;
  chain: number;
  stunDuration: number;
  isHero: boolean;
  /** The action being wound up or recovered from (non-strike actions reuse the swing pose until 2d). */
  action: ActionId | null;
  /** Windup and recover of the current action, from the sim's `actionTiming`. */
  windup: number;
  recover: number;
  /** Ground speed in m/s (from interpolated positions), for the walk cycle. */
  speed: number;
}

/**
 * The one interface the game uses to drive a unit on screen. Stage 1 implements it with
 * figures built from primitives; Stage 6 adds rigged models behind the same interface.
 * Animation is posed from the sim state every frame (state + time in state), so hit-stop
 * freezes it for free and nothing drifts out of sync with the simulation.
 */
export interface UnitView {
  readonly root: THREE.Object3D;
  setPose(x: number, z: number, facing: number): void;
  animate(a: AnimInput, frameTime: number): void;
  flashHit(heavy: boolean): void;
  dispose(): void;
}

const FLASH_TIME = 0.14;

function lambert(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

function easeOut(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) * (1 - c);
}

function easeIn(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c;
}

/** ~1.8 m figure from boxes and cylinders, facing -z, with sword and shield. */
export class PrimitiveWarriorView implements UnitView {
  readonly root = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly sword = new THREE.Group();
  private readonly materials: THREE.MeshLambertMaterial[] = [];
  private flash = 0;
  private flashStrength = 1;
  private walkPhase = 0;
  private idleTime = 0;

  constructor(colors: FigureColors, hero: boolean) {
    const tunic = this.mat(colors.tunic);
    const trim = this.mat(colors.trim);
    const legs = this.mat(colors.legs);
    const skin = this.mat(colors.skin);
    const metal = this.mat(colors.metal);
    const leather = this.mat(colors.leather);
    const shieldMat = this.mat(colors.shield);

    // Yaw first, then the local tilt, so a fall always goes backwards relative to the figure.
    this.root.rotation.order = 'YXZ';
    this.root.add(this.hips);
    this.hips.position.y = 0.95;

    // Legs: thigh-to-ankle in one piece, boots at the end.
    for (const [g, x] of [[this.legL, -0.11], [this.legR, 0.11]] as const) {
      g.position.set(x, 0, 0);
      const leg = box(0.15, 0.82, 0.17, legs);
      leg.position.y = -0.41;
      const boot = box(0.17, 0.16, 0.27, leather);
      boot.position.set(0, -0.87, -0.04);
      g.add(leg, boot);
      this.hips.add(g);
    }

    // Torso pivots at the hips so it can lean and twist.
    this.hips.add(this.torso);
    const skirt = box(0.42, 0.26, 0.26, tunic);
    skirt.position.y = 0.02;
    const chest = box(0.46, 0.5, 0.27, tunic);
    chest.position.y = 0.38;
    const belt = box(0.44, 0.07, 0.28, leather);
    belt.position.y = 0.14;
    const collar = box(0.3, 0.06, 0.22, trim);
    collar.position.y = 0.65;
    const neck = box(0.1, 0.08, 0.1, skin);
    neck.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), skin);
    head.scale.set(1, 1.15, 1.05);
    head.position.y = 0.84;
    head.castShadow = true;
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.13, 8), metal);
    helmet.position.y = 0.92;
    helmet.castShadow = true;
    const helmetTop = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.1, 8), metal);
    helmetTop.position.y = 1.03;
    this.torso.add(skirt, chest, belt, collar, neck, head, helmet, helmetTop);
    if (hero) {
      // The hero wears a gold crest so he stands out from the companions later.
      const crest = box(0.03, 0.12, 0.24, trim);
      crest.position.set(0, 1.08, 0.01);
      this.torso.add(crest);
    }

    for (const [g, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      g.position.set(side * 0.29, 0.6, 0);
      const shoulder = box(0.16, 0.12, 0.2, trim);
      shoulder.position.set(side * 0.02, 0.01, 0);
      const arm = box(0.11, 0.58, 0.12, tunic);
      arm.position.y = -0.3;
      const hand = box(0.1, 0.1, 0.11, skin);
      hand.position.y = -0.63;
      g.add(shoulder, arm, hand);
      this.torso.add(g);
    }

    // Sword: grip in the right hand, blade along the hand's -y, turned forward by the pose.
    this.sword.position.y = -0.64;
    const grip = box(0.04, 0.14, 0.04, leather);
    const guard = box(0.2, 0.035, 0.05, trim);
    guard.position.y = -0.08;
    const blade = box(0.06, 0.78, 0.015, metal);
    blade.position.y = -0.48;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), metal);
    tip.rotation.x = Math.PI;
    tip.position.y = -0.92;
    this.sword.add(grip, guard, blade, tip);
    this.armR.add(this.sword);

    // Round shield on the left forearm, face pointing forward.
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), shieldMat);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.04, -0.42, -0.12);
    shield.castShadow = true;
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), trim);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(-0.04, -0.42, -0.16);
    this.armL.add(shield, boss);
  }

  private mat(color: string): THREE.MeshLambertMaterial {
    const m = lambert(color);
    this.materials.push(m);
    return m;
  }

  setPose(x: number, z: number, facing: number): void {
    this.root.position.set(x, 0, z);
    // Figures are built facing -z; facing is clockwise from -z seen from above.
    this.root.rotation.y = -facing;
  }

  flashHit(heavy: boolean): void {
    this.flash = FLASH_TIME;
    this.flashStrength = heavy ? 0.55 : 0.38;
  }

  animate(a: AnimInput, frameTime: number): void {
    this.updateFlash(frameTime);
    this.idleTime += frameTime;
    this.resetPose();
    // Hero abilities use the heavy swing pose until 2d.
    const chain = a.isHero ? (a.action === null ? a.chain : 1) : -1;

    switch (a.state) {
      case 'idle':
      case 'moving':
        this.poseLocomotion(a.speed, frameTime);
        break;
      case 'windup':
        this.poseWindup(easeOut(a.stateTime / a.windup), chain);
        break;
      case 'recover':
        this.poseRecover(a.stateTime, a.recover, chain);
        break;
      case 'dodging':
        this.poseDodge(a.stateTime / HERO.dodge.duration);
        break;
      case 'stunned':
        this.poseStunned(a.stateTime / Math.max(0.05, a.stunDuration));
        break;
      case 'dead':
        this.poseDead(a.stateTime);
        break;
    }
  }

  private resetPose(): void {
    this.root.rotation.x = 0;
    this.root.position.y = 0;
    this.hips.position.y = 0.95;
    this.hips.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    // Guard stance: sword forward and up, shield in front.
    this.armR.rotation.set(0.55, 0, 0.12);
    this.sword.rotation.set(1.25, 0, 0);
    this.armL.rotation.set(0.6, 0.25, -0.15);
  }

  private poseLocomotion(speed: number, frameTime: number): void {
    const stride = clamp(speed / 5, 0, 1);
    this.walkPhase += frameTime * (4 + speed * 1.6);
    const s = Math.sin(this.walkPhase);
    this.legL.rotation.x = s * 0.65 * stride;
    this.legR.rotation.x = -s * 0.65 * stride;
    this.hips.position.y = 0.95 - Math.abs(Math.cos(this.walkPhase)) * 0.05 * stride;
    this.torso.rotation.x = -0.12 * stride;
    this.torso.rotation.y = s * 0.12 * stride;
    this.armR.rotation.x += -s * 0.25 * stride;
    this.armL.rotation.x += s * 0.2 * stride;
    // Breathing when standing.
    this.torso.position.y = Math.sin(this.idleTime * 2.2) * 0.008 * (1 - stride);
  }

  /** chain: 0 light diagonal, 1 heavy overhead, -1 enemy chop (slow, big, readable). */
  private poseWindup(p: number, chain: number): void {
    const heavy = chain === 1;
    const enemy = chain === -1;
    // Sword arm up and back over the shoulder; the body coils away from the swing.
    this.armR.rotation.x = lerp(0.55, heavy || enemy ? 3.0 : 2.5, p);
    this.armR.rotation.z = lerp(0.12, heavy || enemy ? 0.1 : 0.7, p);
    this.sword.rotation.x = lerp(1.25, 0.4, p);
    this.torso.rotation.y = lerp(0, heavy ? 0.15 : enemy ? 0.25 : 0.55, p);
    this.torso.rotation.x = lerp(0, enemy ? 0.28 : heavy ? 0.18 : 0.08, p);
    this.armL.rotation.x = lerp(0.6, 0.9, p);
    this.legR.rotation.x = lerp(0, 0.35, p);
    this.legL.rotation.x = lerp(0, -0.3, p);
    this.hips.position.y = 0.95 - p * (heavy || enemy ? 0.08 : 0.04);
  }

  private poseRecover(t: number, recover: number, chain: number): void {
    const heavy = chain === 1;
    const enemy = chain === -1;
    // The strike itself is the first ~0.07 s of the recover; then ease back into guard.
    const strike = easeOut(t / 0.07);
    const back = easeIn((t - 0.1) / Math.max(0.05, recover - 0.1));
    const from = heavy || enemy ? 3.0 : 2.5;
    const armX = lerp(from, -0.2, strike);
    this.armR.rotation.x = lerp(armX, 0.55, back);
    this.armR.rotation.z = lerp(lerp(heavy || enemy ? 0.1 : 0.7, heavy ? 0 : -0.5, strike), 0.12, back);
    this.sword.rotation.x = lerp(lerp(0.4, 1.4, strike), 1.25, back);
    const twist = lerp(heavy ? 0.15 : enemy ? 0.25 : 0.55, heavy ? -0.1 : -0.55, strike);
    this.torso.rotation.y = lerp(twist, 0, back);
    const lean = lerp(enemy ? 0.28 : 0.1, heavy ? -0.45 : -0.25, strike);
    this.torso.rotation.x = lerp(lean, 0, back);
    this.legR.rotation.x = lerp(-0.45, 0, back);
    this.legL.rotation.x = lerp(0.4, 0, back);
    this.hips.position.y = 0.95 - lerp(heavy ? 0.16 : 0.08, 0, back);
  }

  private poseDodge(p: number): void {
    // Low forward dash: crouched, leaning into the direction of travel.
    const k = Math.sin(clamp(p, 0, 1) * Math.PI);
    this.hips.position.y = 0.95 - k * 0.35;
    this.torso.rotation.x = -k * 0.75;
    this.legL.rotation.x = k * 1.1;
    this.legR.rotation.x = -k * 0.5;
    this.armR.rotation.x = lerp(0.55, -0.6, k);
    this.armL.rotation.x = lerp(0.6, 1.2, k);
  }

  private poseStunned(p: number): void {
    // Recoil back, then recover.
    const k = Math.sin(clamp(p, 0, 1) * Math.PI);
    this.torso.rotation.x = k * 0.45;
    this.armR.rotation.x = lerp(0.55, -0.3, k);
    this.armR.rotation.z = lerp(0.12, 0.5, k);
    this.armL.rotation.z = lerp(-0.15, -0.6, k);
    this.hips.position.y = 0.95 - k * 0.06;
  }

  private poseDead(t: number): void {
    // Knees give, then topple backwards and settle.
    const fall = easeIn(t / 0.55);
    this.root.rotation.x = fall * (Math.PI / 2 - 0.08);
    this.root.position.y = fall * 0.12;
    this.hips.position.y = 0.95 - easeOut(t / 0.25) * 0.08;
    this.legL.rotation.x = -easeOut(t / 0.3) * 0.4;
    this.armR.rotation.x = lerp(0.55, -1.2, fall);
    this.armL.rotation.x = lerp(0.6, -1.0, fall);
  }

  private updateFlash(frameTime: number): void {
    if (this.flash <= 0) return;
    this.flash = Math.max(0, this.flash - frameTime);
    const k = (this.flash / FLASH_TIME) * this.flashStrength;
    for (const m of this.materials) m.emissive.setRGB(k, k * 0.92, k * 0.85);
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
