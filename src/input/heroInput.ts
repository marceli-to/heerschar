import { dirFromAngle } from '../sim/math';
import { emptyInput, type HeroInput } from '../sim/types';
import type { KeyboardMouse } from './keyboardMouse';

/**
 * Turns keyboard and mouse state into one `HeroInput` per sim tick.
 * Presses are latched per animation frame and handed to the next tick, so a click
 * in a frame that runs no tick (high refresh rates) is not lost.
 */
export class HeroInputSampler {
  private pendingAttack = false;
  private pendingDodge = false;
  private pending = { ability1: false, ability2: false, leader: false, lock: false, unlock: false, mark: false };

  constructor(private readonly kbm: KeyboardMouse) {}

  /** Once per animation frame, before `endFrame` on the device. */
  collect(): void {
    if (this.kbm.mousePressed(0)) this.pendingAttack = true;
    const k = this.kbm;
    if (k.pressed('Space')) this.pendingDodge = true;
    if (k.pressed('KeyQ')) this.pending.ability1 = true;
    if (k.pressed('KeyE')) this.pending.ability2 = true;
    if (k.pressed('KeyR')) this.pending.leader = true;
    if (k.pressed('KeyF')) this.pending.mark = true;
    if (k.pressed('Tab')) {
      if (k.down('ShiftLeft') || k.down('ShiftRight')) this.pending.unlock = true;
      else this.pending.lock = true;
    }
  }

  clear(): void {
    this.pendingAttack = false;
    this.pendingDodge = false;
    this.pending = { ability1: false, ability2: false, leader: false, lock: false, unlock: false, mark: false };
  }

  /** Once per tick. Movement is made camera-relative with the camera's yaw. */
  sample(cameraYaw: number): HeroInput {
    const input = emptyInput();
    const k = this.kbm;
    input.aimAngle = cameraYaw;
    if (!k.locked) {
      this.clear();
      return input;
    }
    const fwd = (k.down('KeyW') ? 1 : 0) - (k.down('KeyS') ? 1 : 0);
    const side = (k.down('KeyD') ? 1 : 0) - (k.down('KeyA') ? 1 : 0);
    const f = dirFromAngle(cameraYaw);
    const r = { x: -f.z, z: f.x };
    let mx = f.x * fwd + r.x * side;
    let mz = f.z * fwd + r.z * side;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    input.moveX = mx;
    input.moveZ = mz;
    input.attack = this.pendingAttack;
    input.dodge = this.pendingDodge;
    Object.assign(input, this.pending);
    this.clear();
    return input;
  }
}
