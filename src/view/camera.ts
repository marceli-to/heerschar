import * as THREE from 'three';
import { angleDiff, clamp, dirFromAngle, lerp, type Vec2 } from '../sim/math';

/**
 * Camera tuning. One zoom value z in 0..1 blends from over-the-shoulder (z = 0)
 * to an overview of the whole arena (z = 1). View-only numbers, so they live here, not in balance.ts.
 */
export const CAMERA = {
  close: { back: 4, height: 2, lookHeight: 1.5, lookAhead: 3, shoulder: 0.6 },
  far: { back: 26, height: 22, lookHeight: 0, lookAhead: 0, shoulder: 0 },
  /** Exponent of the distance curve: > 1 keeps steps fine near the shoulder. */
  curve: 1.35,
  wheelStep: 0.08,
  /** Radians per pixel of mouse movement. */
  yawSensitivity: 0.0028,
  /** Higher = snappier follow. */
  followRate: 9,
  /** How fast the yaw swings round to keep a lock target framed. */
  lockRate: 6,
  zoomRate: 10,
  fov: 55,
  /** Max shake rotation in radians at full trauma, how fast it wobbles, how fast it fades. */
  shake: { amount: 0.025, frequency: 38, decay: 2.2 },
  /**
   * Countdown orbit (6e): starts this far from the field centre (m) and this high, beyond the
   * enemy side, sweeps round to the hero view. `lookFrom`: progress at which the gaze starts to
   * turn from the field centre to the hero view's target; `dropFrom`: progress at which it starts
   * to come down (stays above the trees at the field's sides).
   */
  orbit: { radius: 26, height: 15, lookHeight: 1, lookFrom: 0.45, dropFrom: 0.4, skipRate: 7 },
  /** Final-blow slow motion: zoom multiplier at full close-in, yaw rate towards the victim. */
  finale: { zoom: 0.65, turnRate: 3.5 },
} as const;

/** The countdown sweep: `p` 0..1 through the countdown, `weight` < 1 while a skip blends it out. */
export interface OrbitShot {
  centerX: number;
  centerZ: number;
  /** Angle (atan2(dx, dz)) from the centre to where the camera starts. */
  startAngle: number;
  p: number;
  weight: number;
}

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _orbitPos = new THREE.Vector3();
const _orbitLook = new THREE.Vector3();

/** 0..1 with zero slope and zero curvature at both ends. */
function smootherstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  /** Facing of the camera; 0 looks along -z. */
  yaw = 0;
  private zoomTarget: number;
  private zoom: number;
  private focus = new THREE.Vector3();
  private hasFocus = false;
  /** 0..1, decays over time; the offset grows with its square. */
  private trauma = 0;
  private shakeTime = 0;
  /** 0..1, how far the final-blow close-in has gone (scales the zoom down). */
  closeIn = 0;

  constructor(aspect: number, zoom = 0.6) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, 0.1, 600);
    this.zoom = this.zoomTarget = zoom;
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  addZoom(notches: number): void {
    this.zoomTarget = clamp(this.zoomTarget + notches * CAMERA.wheelStep, 0, 1);
  }

  addYaw(pixels: number): void {
    this.yaw += pixels * CAMERA.yawSensitivity;
  }

  /** Swings the yaw towards `angle` (lock-on framing). */
  steerYaw(angle: number, frameTime: number, rate: number = CAMERA.lockRate): void {
    this.yaw += angleDiff(this.yaw, angle) * (1 - Math.exp(-rate * frameTime));
  }

  /** Adds screen shake; heavy hits ~0.5, light ones ~0.2. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(target: Vec2, frameTime: number, orbit: OrbitShot | null = null): void {
    const follow = 1 - Math.exp(-CAMERA.followRate * frameTime);
    if (!this.hasFocus) {
      this.focus.set(target.x, 0, target.z);
      this.hasFocus = true;
    } else {
      this.focus.x += (target.x - this.focus.x) * follow;
      this.focus.z += (target.z - this.focus.z) * follow;
    }
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-CAMERA.zoomRate * frameTime));

    const z = this.zoom * lerp(1, CAMERA.finale.zoom, this.closeIn);
    const t = Math.pow(z, CAMERA.curve);
    const s = z * z * (3 - 2 * z);
    const { close: c, far: f } = CAMERA;
    const back = lerp(c.back, f.back, t);
    const height = lerp(c.height, f.height, t);
    const lookHeight = lerp(c.lookHeight, f.lookHeight, s);
    const lookAhead = lerp(c.lookAhead, f.lookAhead, s);
    const shoulder = lerp(c.shoulder, f.shoulder, s);

    const fwd = dirFromAngle(this.yaw);
    const right = { x: -fwd.z, z: fwd.x };
    const pos = _pos.set(this.focus.x - fwd.x * back + right.x * shoulder, height, this.focus.z - fwd.z * back + right.z * shoulder);
    const look = _look.set(this.focus.x + fwd.x * lookAhead + right.x * shoulder, lookHeight, this.focus.z + fwd.z * lookAhead + right.z * shoulder);
    if (orbit && orbit.weight > 0) this.blendOrbit(pos, look, orbit);
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this.applyShake(frameTime);
  }

  /**
   * Sweeps from high above the far side round to the hero view in polar coordinates about the
   * field centre, so it lands exactly on `pos` / `look` at p = 1.
   */
  private blendOrbit(pos: THREE.Vector3, look: THREE.Vector3, o: OrbitShot): void {
    const { orbit: c } = CAMERA;
    const e = smootherstep(o.p);
    const dx = pos.x - o.centerX;
    const dz = pos.z - o.centerZ;
    const endAngle = Math.atan2(dx, dz);
    let turn = angleDiff(o.startAngle, endAngle);
    // Near a half turn either way would do: always swing the same way so it never flips mid-sweep.
    if (turn < -0.8 * Math.PI) turn += 2 * Math.PI;
    const a = o.startAngle + turn * e;
    const r = lerp(c.radius, Math.hypot(dx, dz), e);
    const drop = smootherstep((o.p - c.dropFrom) / (1 - c.dropFrom));
    _orbitPos.set(o.centerX + Math.sin(a) * r, lerp(c.height, pos.y, drop), o.centerZ + Math.cos(a) * r);
    const l = smootherstep((o.p - c.lookFrom) / (1 - c.lookFrom));
    _orbitLook.set(lerp(o.centerX, look.x, l), lerp(c.lookHeight, look.y, l), lerp(o.centerZ, look.z, l));
    pos.lerp(_orbitPos, o.weight);
    look.lerp(_orbitLook, o.weight);
  }

  private applyShake(frameTime: number): void {
    if (this.trauma <= 0) return;
    this.shakeTime += frameTime;
    const k = this.trauma * this.trauma * CAMERA.shake.amount;
    const t = this.shakeTime * CAMERA.shake.frequency;
    // Sums of sines: smooth, cheap, and not the sim RNG.
    this.camera.rotation.x += (Math.sin(t * 1.0) + Math.sin(t * 2.3 + 1.7) * 0.5) * k;
    this.camera.rotation.y += (Math.sin(t * 1.3 + 0.5) + Math.sin(t * 2.9 + 2.1) * 0.5) * k;
    this.camera.rotation.z += Math.sin(t * 1.7 + 3.1) * k * 0.6;
    this.trauma = Math.max(0, this.trauma - CAMERA.shake.decay * frameTime);
  }
}
