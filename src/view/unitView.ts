import * as THREE from 'three';
import { clamp, lerp } from '../sim/math';
import type { ActionId, UnitState } from '../sim/types';
import type { ClassId, Team } from '../sim/types';
import { ARM, BOSS_SCALE, buildFigure, type FigureRig } from './figures';
import { reach, orient } from './ik';
import { FX, type FigureColors } from './palette';
import { ShieldBubble } from './shieldBubble';

/** What a figure needs from the sim each frame to pose itself. */
export interface AnimInput {
  state: UnitState;
  stateTime: number;
  chain: number;
  stunDuration: number;
  isHero: boolean;
  /** The action being wound up or recovered from (`null` on the hero = basic attack chain). */
  action: ActionId | null;
  /** Windup and recover of the current action, from the sim's `actionTiming`. */
  windup: number;
  recover: number;
  /** Ground speed in m/s (from interpolated positions), for the walk cycle. */
  speed: number;
  frozen: boolean;
  shielded: boolean;
  /** A dodge away from where the unit faces (a hop backwards). */
  dodgeBack: boolean;
  /** How long the current dodge lasts (ranged heroes dodge longer). */
  dodgeDuration: number;
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
  /** Height above the ground for the health bar and markers. */
  readonly barY: number;
  /** World points along the main blade (inner edge, tip) for the swing trail; false if it has none. */
  weaponEdge?(base: THREE.Vector3, tip: THREE.Vector3): boolean;
  /** World point at the far end of the staff (the Fireball gathers there); false if it has none. */
  staffTip?(out: THREE.Vector3): boolean;
  /** World point at the crossbow's muzzle (the volley's smoke); false if it has no marker. */
  muzzlePoint?(out: THREE.Vector3): boolean;
  dispose(): void;
}

const FLASH_TIME = 0.14;
const FROZEN_MIX = 0.6;

function easeOut(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) * (1 - c);
}

function easeIn(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c;
}

type ActionPose = 'swing' | 'spin' | 'bash' | 'roar' | 'draw' | 'cast' | 'slam' | 'hop' | 'chop';

/** Which pose an action uses for a given figure style. */
function actionPose(style: FigureRig['style'], action: ActionId | null): ActionPose {
  if (action === 'wirbel') return 'spin';
  if (action === 'schildstoss') return 'bash';
  if (action === 'rueckzug') return 'hop';
  // Boss actions: the sweep is a heavy swing, the slam an overhead chop (casters slam the staff),
  // the charge a lowered shoulder, calling and raising a roar.
  if (action === 'charge') return 'bash';
  if (action === 'mend') return 'slam';
  if (style === 'melee') {
    if (action === 'slam') return 'chop';
    if (action === 'summon' || action === 'raise') return 'roar';
  } else if (action === 'summon' || action === 'raise') {
    return 'slam';
  }
  switch (style) {
    case 'melee':
      return action === 'taunt' || action === 'sammeln' ? 'roar' : 'swing';
    case 'archer':
      return action === 'sammeln' ? 'roar' : 'draw';
    case 'caster':
      return action === 'groupHeal' || action === 'frostNova' || action === 'frostring' || action === 'heilkreis' || action === 'sammeln' ? 'slam' : 'cast';
  }
}

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const _t = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const FORWARD = new THREE.Vector3(0, 0, -1);
const POLE_OUT_BACK_R = v(1, -0.3, 0.8);
const POLE_OUT_BACK_L = v(-1, -0.3, 0.8);
const POLE_DOWN = v(0, -1, 0.4);

/**
 * A figure built from primitives for any class (see `figures.ts`), posed from the sim state
 * every frame. Melee figures swing with Euler poses (the Stage 1 sword set); archers and
 * casters are posed by hand position through the arm IK.
 */
export class PrimitiveFigureView implements UnitView {
  readonly root: THREE.Group;
  readonly barY: number;
  private readonly rig: FigureRig;
  private readonly baseColors: THREE.Color[];
  private readonly bubble: ShieldBubble;
  private flash = 0;
  private flashStrength = 1;
  private walkPhase = 0;
  private idleTime = 0;
  private frost = 0;

  /** Bosses swing everything as the heavy chain step. */
  private readonly heavy: boolean;

  constructor(classId: ClassId, colors: FigureColors, team: Team, hero: boolean) {
    this.rig = buildFigure(classId, colors, hero);
    this.heavy = BOSS_SCALE[classId] !== undefined;
    this.root = this.rig.root;
    this.barY = this.rig.barY;
    this.baseColors = this.rig.materials.map((m) => m.color.clone());
    this.bubble = new ShieldBubble(team);
    this.root.add(this.bubble.mesh);
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
    this.updateTint(a, frameTime);
    // A frozen figure is a statue: no breathing, no walk cycle.
    const t = a.frozen ? 0 : frameTime;
    this.idleTime += t;
    this.resetPose();
    const pose = actionPose(this.rig.style, a.action);
    // Hero melee: basic chain step, abilities other than spin/bash use the heavy swing.
    const chain = a.isHero ? (a.action === null ? a.chain : 1) : this.heavy ? 1 : -1;

    switch (a.state) {
      case 'idle':
      case 'moving':
        this.poseLocomotion(a.speed, t);
        break;
      case 'windup':
        this.poseAction(pose, 'windup', a.stateTime, a.windup, chain);
        break;
      case 'recover':
        this.poseAction(pose, 'recover', a.stateTime, a.recover, chain);
        break;
      case 'dodging':
        this.poseDodge(a.stateTime / a.dodgeDuration);
        break;
      case 'stunned':
        this.poseStunned(a.stateTime / Math.max(0.05, a.stunDuration));
        break;
      case 'dead':
        this.poseDead(a.stateTime);
        break;
    }
    if (this.rig.nocked) this.rig.nocked.visible = a.state === 'windup' && pose === 'draw';
  }

  private poseAction(pose: ActionPose, phase: 'windup' | 'recover', t: number, dur: number, chain: number): void {
    const windup = phase === 'windup';
    const p = easeOut(t / Math.max(0.01, dur));
    switch (pose) {
      case 'swing':
        if (windup) this.poseWindup(p, chain);
        else this.poseRecover(t, dur, chain);
        return;
      case 'spin':
        return this.poseSpin(windup, p, t, dur);
      case 'bash':
        return this.poseBash(windup, p, t, dur);
      case 'roar':
        return this.poseRoar(windup, p, t, dur);
      case 'hop':
        return this.poseDodge(windup ? p * 0.3 : 0.3 + (t / Math.max(0.01, dur)) * 0.7);
      case 'draw':
        return this.poseDraw(windup, p, t, dur);
      case 'cast':
        return this.poseCast(windup, p, t, dur);
      case 'slam':
        return this.poseSlam(windup, p, t, dur);
      case 'chop':
        // Weapon raised overhead, then brought down like the heavy swing.
        if (windup) return this.poseRoar(true, p, t, dur);
        return this.poseRecover(t, dur, 1);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Base pose and locomotion

  private resetPose(): void {
    const r = this.rig;
    r.root.rotation.x = 0;
    r.root.position.y = 0;
    r.hips.position.y = 0.95;
    r.hips.rotation.set(0, 0, 0);
    r.torso.rotation.set(r.lean, 0, 0);
    r.torso.position.y = 0;
    r.legL.rotation.set(0, 0, 0);
    r.legR.rotation.set(0, 0, 0);
    r.foreL.rotation.set(0, 0, 0);
    r.foreR.rotation.set(0, 0, 0);
    // Guard stance: weapon forward and up, off hand in front.
    r.armR.rotation.set(0.55, 0, 0.12);
    r.weaponR?.rotation.set(1.25, 0, 0);
    r.armL.rotation.set(0.6, 0.25, -0.15);
    r.weaponL?.rotation.set(1.25, 0, 0);
    if (r.style !== 'melee') this.holdIdle(0, 0);
  }

  /** Archer / caster resting hold. `swing` (-1..1) adds a little arm swing while walking. */
  private holdIdle(swing: number, stride: number): void {
    const r = this.rig;
    const x = r.shoulderX;
    if (r.style === 'archer') {
      this.reachL(_t.set(-x - 0.06, 0.08, -0.14 + swing * 0.08 * stride), POLE_OUT_BACK_L);
      this.reachR(_t.set(x + 0.04, 0.04, 0.02 - swing * 0.1 * stride), POLE_OUT_BACK_R);
      this.orientProp(0.25, 0, 0.15);
      return;
    }
    const s = r.castSide;
    // Cast hand holds the staff upright (or the orb in front), the other hangs.
    if (s === 1) {
      this.reachR(_t.set(x + 0.04, 0.2, -0.2 - swing * 0.04 * stride), POLE_OUT_BACK_R);
      this.reachL(_t.set(-x - 0.02, 0.04, -0.04 + swing * 0.1 * stride), POLE_OUT_BACK_L);
    } else {
      this.reachL(_t.set(-0.16, 0.3, -0.3), POLE_OUT_BACK_L);
      this.reachR(_t.set(x + 0.02, 0.04, -0.04 - swing * 0.1 * stride), POLE_OUT_BACK_R);
    }
    this.orientProp(0, 0, 0);
  }

  private reachL(target: THREE.Vector3, pole: THREE.Vector3): void {
    reach(this.rig.armL, this.rig.foreL, target, pole, ARM.upper, ARM.fore);
  }

  private reachR(target: THREE.Vector3, pole: THREE.Vector3): void {
    reach(this.rig.armR, this.rig.foreR, target, pole, ARM.upper, ARM.fore);
  }

  /** Cast hand / bow hand for the current figure. */
  private reachCast(target: THREE.Vector3, pole?: THREE.Vector3): void {
    if (this.castLeft()) this.reachL(target, pole ?? POLE_OUT_BACK_L);
    else this.reachR(target, pole ?? POLE_OUT_BACK_R);
  }

  private reachOff(target: THREE.Vector3, pole?: THREE.Vector3): void {
    if (this.castLeft()) this.reachR(target, pole ?? POLE_OUT_BACK_R);
    else this.reachL(target, pole ?? POLE_OUT_BACK_L);
  }

  /** The bow and the healer's orb sit in the left hand. */
  private castLeft(): boolean {
    return this.rig.style === 'archer' || this.rig.castSide === -1;
  }

  /** Orients the prop in torso space from Euler angles (x tilts the top back, z sideways). */
  private orientProp(x: number, y: number, z: number): void {
    const r = this.rig;
    if (!r.prop) return;
    _q.setFromEuler(_e.set(x, y, z));
    if (this.castLeft()) orient(r.prop, r.armL, r.foreL, _q);
    else orient(r.prop, r.armR, r.foreR, _q);
  }

  private poseLocomotion(speed: number, frameTime: number): void {
    const r = this.rig;
    const stride = clamp(speed / 5, 0, 1);
    this.walkPhase += frameTime * (4 + speed * 1.6);
    const s = Math.sin(this.walkPhase);
    r.legL.rotation.x = s * 0.65 * stride;
    r.legR.rotation.x = -s * 0.65 * stride;
    r.hips.position.y = 0.95 - Math.abs(Math.cos(this.walkPhase)) * 0.05 * stride;
    r.torso.rotation.x = r.lean - 0.12 * stride;
    r.torso.rotation.y = s * 0.12 * stride;
    if (r.style === 'melee') {
      r.armR.rotation.x += -s * 0.25 * stride;
      r.armL.rotation.x += s * 0.2 * stride;
    } else {
      this.holdIdle(s, stride);
    }
    // Breathing when standing.
    r.torso.position.y = Math.sin(this.idleTime * 2.2) * 0.008 * (1 - stride);
  }

  // -------------------------------------------------------------------------------------------
  // Melee

  /** chain: 0 light diagonal, 1 heavy overhead, -1 AI chop (slow, big, readable). */
  private poseWindup(p: number, chain: number): void {
    const r = this.rig;
    const heavy = chain === 1;
    const enemy = chain === -1;
    // Weapon arm up and back over the shoulder; the body coils away from the swing.
    r.armR.rotation.x = lerp(0.55, heavy || enemy ? 3.0 : 2.5, p);
    r.armR.rotation.z = lerp(0.12, heavy || enemy ? 0.1 : 0.7, p);
    r.weaponR?.rotation.set(lerp(1.25, 0.4, p), 0, 0);
    r.torso.rotation.y = lerp(0, heavy ? 0.15 : enemy ? 0.25 : 0.55, p);
    r.torso.rotation.x = r.lean + lerp(0, enemy ? 0.28 : heavy ? 0.18 : 0.08, p);
    r.armL.rotation.x = lerp(0.6, 0.9, p);
    r.legR.rotation.x = lerp(0, 0.35, p);
    r.legL.rotation.x = lerp(0, -0.3, p);
    r.hips.position.y = 0.95 - p * (heavy || enemy ? 0.08 : 0.04);
  }

  private poseRecover(t: number, recover: number, chain: number): void {
    const r = this.rig;
    const heavy = chain === 1;
    const enemy = chain === -1;
    // The strike itself is the first ~0.07 s of the recover; then ease back into guard.
    const strike = easeOut(t / 0.07);
    const back = easeIn((t - 0.1) / Math.max(0.05, recover - 0.1));
    const from = heavy || enemy ? 3.0 : 2.5;
    const armX = lerp(from, -0.2, strike);
    r.armR.rotation.x = lerp(armX, 0.55, back);
    r.armR.rotation.z = lerp(lerp(heavy || enemy ? 0.1 : 0.7, heavy ? 0 : -0.5, strike), 0.12, back);
    r.weaponR?.rotation.set(lerp(lerp(0.4, 1.4, strike), 1.25, back), 0, 0);
    const twist = lerp(heavy ? 0.15 : enemy ? 0.25 : 0.55, heavy ? -0.1 : -0.55, strike);
    r.torso.rotation.y = lerp(twist, 0, back);
    const lean = lerp(enemy ? 0.28 : 0.1, heavy ? -0.45 : -0.25, strike);
    r.torso.rotation.x = r.lean + lerp(lean, 0, back);
    r.legR.rotation.x = lerp(-0.45, 0, back);
    r.legL.rotation.x = lerp(0.4, 0, back);
    r.hips.position.y = 0.95 - lerp(heavy ? 0.16 : 0.08, 0, back);
  }

  /** Wirbel: coil, then one full turn with the arms flung out. */
  private poseSpin(windup: boolean, p: number, t: number, dur: number): void {
    const r = this.rig;
    if (windup) {
      r.hips.rotation.y = 0.7 * p;
      r.hips.position.y = 0.95 - 0.1 * p;
      r.armR.rotation.set(lerp(0.55, 1.4, p), 0, lerp(0.12, 1.2, p));
      r.armL.rotation.set(lerp(0.6, 1.0, p), 0, lerp(-0.15, -1.0, p));
      return;
    }
    const spin = easeOut(t / Math.min(0.3, dur));
    const back = easeIn((t - 0.3) / Math.max(0.05, dur - 0.3));
    r.hips.rotation.y = 0.7 - spin * (Math.PI * 2 + 0.7);
    r.hips.position.y = 0.95 - lerp(0.1, 0, back);
    r.armR.rotation.set(lerp(1.5, 0.55, back), 0, lerp(1.4, 0.12, back));
    r.weaponR?.rotation.set(lerp(1.5, 1.25, back), 0, 0);
    r.armL.rotation.set(lerp(1.2, 0.6, back), 0, lerp(-1.3, -0.15, back));
  }

  /** Schildstoss: shield drawn in, then rammed forward. */
  private poseBash(windup: boolean, p: number, t: number, dur: number): void {
    const r = this.rig;
    if (windup) {
      r.armL.rotation.set(lerp(0.6, 0.4, p), lerp(0.25, 0.7, p), -0.15);
      r.torso.rotation.y = -0.4 * p;
      r.hips.position.y = 0.95 - 0.08 * p;
      r.legR.rotation.x = 0.3 * p;
      return;
    }
    const strike = easeOut(t / 0.07);
    const back = easeIn((t - 0.12) / Math.max(0.05, dur - 0.12));
    r.armL.rotation.set(lerp(lerp(0.4, 1.45, strike), 0.6, back), lerp(0.7, 0.1, strike), -0.15);
    r.torso.rotation.y = lerp(lerp(-0.4, 0.25, strike), 0, back);
    r.torso.rotation.x = r.lean + lerp(-0.25 * strike, 0, back);
    r.legL.rotation.x = lerp(-0.4 * strike, 0, back);
    r.legR.rotation.x = lerp(0.4 * strike, 0, back);
  }

  /** Taunt and Sammeln: weapon raised high, chest out. */
  private poseRoar(windup: boolean, p: number, t: number, dur: number): void {
    const r = this.rig;
    const k = windup ? p : 1 - easeIn((t - 0.1) / Math.max(0.05, dur - 0.1));
    r.torso.rotation.x = r.lean + 0.2 * k;
    r.hips.position.y = 0.95 - 0.04 * k;
    if (r.style === 'melee') {
      r.armR.rotation.set(lerp(0.55, 2.9, k), 0, lerp(0.12, 0.35, k));
      r.weaponR?.rotation.set(lerp(1.25, 0.2, k), 0, 0);
      r.armL.rotation.set(lerp(0.6, 1.2, k), 0.25, lerp(-0.15, -0.5, k));
    } else {
      // Archer: bow held high overhead.
      this.reachL(_t.set(-0.15, lerp(0.08, 1.0, k), lerp(-0.14, -0.2, k)), POLE_OUT_BACK_L);
      this.orientProp(0.25 * (1 - k), 0, lerp(0.15, 1.4, k));
    }
  }

  // -------------------------------------------------------------------------------------------
  // Archer

  private poseDraw(windup: boolean, p: number, t: number, dur: number): void {
    const r = this.rig;
    const x = r.shoulderX;
    // Turn side-on to the target while drawing.
    if (windup) {
      const raise = easeOut(p * 1.8);
      const pull = easeIn(clamp((p - 0.3) / 0.7, 0, 1));
      r.torso.rotation.y = -0.35 * raise;
      this.reachL(_t.set(lerp(-x - 0.06, -0.02, raise), lerp(0.08, 0.64, raise), lerp(-0.14, -0.62, raise)), POLE_OUT_BACK_L);
      this.reachR(_t.set(lerp(-0.02, 0.06, pull), lerp(0.64, 0.74, pull), lerp(-0.5, -0.1, pull)), POLE_OUT_BACK_R);
      this.orientProp(lerp(0.25, 0, raise), 0, lerp(0.15, -0.15, raise));
      if (r.nocked) {
        // Arrow from the string hand towards the bow.
        _t2.set(-0.02, 0.64, -0.62);
        r.foreR.updateMatrixWorld();
        _t.set(lerp(-0.02, 0.06, pull), lerp(0.64, 0.74, pull), lerp(-0.5, -0.1, pull));
        _t2.sub(_t).normalize();
        _q.setFromUnitVectors(FORWARD, _t2);
        orient(r.nocked, r.armR, r.foreR, _q);
      }
      return;
    }
    // Release: the string hand flicks back, then everything settles.
    const flick = easeOut(t / 0.06);
    const back = easeIn((t - 0.12) / Math.max(0.05, dur - 0.12));
    r.torso.rotation.y = lerp(-0.35, 0, back);
    this.reachL(_t.set(lerp(-0.02, -x - 0.06, back), lerp(0.64, 0.08, back), lerp(-0.62, -0.14, back)), POLE_OUT_BACK_L);
    this.reachR(_t.set(lerp(lerp(0.06, 0.2, flick), x + 0.04, back), lerp(0.74, 0.04, back), lerp(lerp(-0.1, 0.06, flick), 0.02, back)), POLE_OUT_BACK_R);
    this.orientProp(lerp(0, 0.25, back), 0, lerp(-0.15, 0.15, back));
  }

  // -------------------------------------------------------------------------------------------
  // Caster

  /** Bolt, heal, fireball, shields: staff (or orb) raised, then thrust at the target. */
  private poseCast(windup: boolean, p: number, t: number, dur: number): void {
    const s = this.castLeft() ? -1 : 1;
    if (windup) {
      this.reachCast(_t.set(s * lerp(0.33, 0.24, p), lerp(0.2, 0.78, p), lerp(-0.2, -0.32, p)));
      this.reachOff(_t.set(-s * lerp(0.31, 0.2, p), lerp(0.04, 0.5, p), lerp(-0.04, -0.42, p)));
      this.orientProp(0.3 * p, 0, 0);
      this.rig.torso.rotation.x = this.rig.lean + 0.1 * p;
      return;
    }
    const thrust = easeOut(t / 0.08);
    const back = easeIn((t - 0.14) / Math.max(0.05, dur - 0.14));
    this.reachCast(_t.set(s * lerp(lerp(0.24, 0.2, thrust), 0.33, back), lerp(lerp(0.78, 0.62, thrust), 0.2, back), lerp(lerp(-0.32, -0.62, thrust), -0.2, back)));
    this.reachOff(_t.set(-s * lerp(0.2, 0.31, back), lerp(0.5, 0.04, back), lerp(-0.42, -0.04, back)));
    this.orientProp(lerp(lerp(0.3, -0.7, thrust), 0, back), 0, 0);
    this.rig.torso.rotation.x = this.rig.lean + lerp(lerp(0.1, -0.2, thrust), 0, back);
  }

  /** Novas, rings, group heals, Sammeln: staff lifted overhead, then driven into the ground. */
  private poseSlam(windup: boolean, p: number, t: number, dur: number): void {
    const s = this.castLeft() ? -1 : 1;
    const r = this.rig;
    if (windup) {
      this.reachCast(_t.set(s * lerp(0.33, 0.12, p), lerp(0.2, 1.05, p), lerp(-0.2, -0.12, p)), POLE_DOWN);
      this.reachOff(_t.set(-s * lerp(0.31, 0.05, p), lerp(0.04, 0.95, p), lerp(-0.04, -0.12, p)), POLE_DOWN);
      this.orientProp(0, 0, 0);
      r.torso.rotation.x = r.lean + 0.18 * p;
      return;
    }
    const strike = easeOut(t / 0.08);
    const back = easeIn((t - 0.18) / Math.max(0.05, dur - 0.18));
    this.reachCast(_t.set(s * lerp(lerp(0.12, 0.2, strike), 0.33, back), lerp(lerp(1.05, 0.3, strike), 0.2, back), lerp(lerp(-0.12, -0.44, strike), -0.2, back)));
    this.reachOff(_t.set(-s * lerp(0.15, 0.31, back), lerp(lerp(0.95, 0.35, strike), 0.04, back), lerp(-0.4, -0.04, back)));
    this.orientProp(0, 0, 0);
    r.torso.rotation.x = r.lean + lerp(lerp(0.18, -0.35, strike), 0, back);
    r.hips.position.y = 0.95 - lerp(0.12 * strike, 0, back);
  }

  // -------------------------------------------------------------------------------------------
  // Shared reactions

  private poseDodge(p: number): void {
    const r = this.rig;
    // Low dash: crouched, leaning into the direction of travel.
    const k = Math.sin(clamp(p, 0, 1) * Math.PI);
    r.hips.position.y = 0.95 - k * 0.35;
    r.torso.rotation.x = r.lean - k * 0.75;
    r.legL.rotation.x = k * 1.1;
    r.legR.rotation.x = -k * 0.5;
    if (r.style === 'melee') {
      r.armR.rotation.x = lerp(0.55, -0.6, k);
      r.armL.rotation.x = lerp(0.6, 1.2, k);
    }
  }

  private poseStunned(p: number): void {
    const r = this.rig;
    // Recoil back, then recover.
    const k = Math.sin(clamp(p, 0, 1) * Math.PI);
    r.torso.rotation.x = r.lean + k * 0.45;
    r.hips.position.y = 0.95 - k * 0.06;
    if (r.style === 'melee') {
      r.armR.rotation.x = lerp(0.55, -0.3, k);
      r.armR.rotation.z = lerp(0.12, 0.5, k);
      r.armL.rotation.z = lerp(-0.15, -0.6, k);
    }
  }

  private poseDead(t: number): void {
    const r = this.rig;
    // Knees give, then topple backwards and settle.
    const fall = easeIn(t / 0.55);
    r.root.rotation.x = fall * (Math.PI / 2 - 0.08);
    r.root.position.y = fall * 0.12;
    r.hips.position.y = 0.95 - easeOut(t / 0.25) * 0.08;
    r.legL.rotation.x = -easeOut(t / 0.3) * 0.4;
    if (r.style === 'melee') {
      r.armR.rotation.x = lerp(0.55, -1.2, fall);
      r.armL.rotation.x = lerp(0.6, -1.0, fall);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Tints: hit flash, frost, shield bubble

  private updateTint(a: AnimInput, frameTime: number): void {
    const frostTarget = a.frozen && a.state !== 'dead' ? 1 : 0;
    const prevFrost = this.frost;
    this.frost += (frostTarget - this.frost) * Math.min(1, frameTime * 12);
    if (Math.abs(this.frost - frostTarget) < 0.01) this.frost = frostTarget;
    if (this.frost !== prevFrost) {
      const ice = new THREE.Color(FX.frozenTint);
      this.rig.materials.forEach((m, i) => m.color.copy(this.baseColors[i]!).lerp(ice, this.frost * FROZEN_MIX));
    }
    if (this.flash > 0 || this.frost > 0 || prevFrost > 0) {
      this.flash = Math.max(0, this.flash - frameTime);
      const k = (this.flash / FLASH_TIME) * this.flashStrength;
      const f = this.frost * 0.18;
      for (const m of this.rig.materials) m.emissive.setRGB(k + f * 0.3, k * 0.92 + f * 0.75, k * 0.85 + f);
    }
    this.bubble.update(a.shielded && a.state !== 'dead', frameTime, this.idleTime);
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (o.material instanceof THREE.MeshBasicMaterial || o.material instanceof THREE.ShaderMaterial) o.material.dispose();
      }
    });
    for (const m of this.rig.materials) m.dispose();
  }
}
