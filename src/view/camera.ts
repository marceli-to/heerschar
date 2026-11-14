import * as THREE from 'three';
import { clamp, dirFromAngle, lerp, type Vec2 } from '../sim/math';

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
  zoomRate: 10,
  fov: 55,
} as const;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  /** Facing of the camera; 0 looks along -z. */
  yaw = 0;
  private zoomTarget: number;
  private zoom: number;
  private focus = new THREE.Vector3();
  private hasFocus = false;

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

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(target: Vec2, frameTime: number): void {
    const follow = 1 - Math.exp(-CAMERA.followRate * frameTime);
    if (!this.hasFocus) {
      this.focus.set(target.x, 0, target.z);
      this.hasFocus = true;
    } else {
      this.focus.x += (target.x - this.focus.x) * follow;
      this.focus.z += (target.z - this.focus.z) * follow;
    }
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-CAMERA.zoomRate * frameTime));

    const z = this.zoom;
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
    this.camera.position.set(
      this.focus.x - fwd.x * back + right.x * shoulder,
      height,
      this.focus.z - fwd.z * back + right.z * shoulder,
    );
    this.camera.lookAt(
      this.focus.x + fwd.x * lookAhead + right.x * shoulder,
      lookHeight,
      this.focus.z + fwd.z * lookAhead + right.z * shoulder,
    );
  }
}
