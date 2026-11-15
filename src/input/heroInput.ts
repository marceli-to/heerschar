import { dirFromAngle } from '../sim/math';
import { emptyInput, type HeroInput } from '../sim/types';
import type { KeyboardMouse } from './keyboardMouse';
import { settings } from '../settings/store';

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
    const k = this.kbm;
    const b = settings.keys;
    if (k.bindingPressed(b.attack)) this.pendingAttack = true;
    if (k.bindingPressed(b.dodge)) this.pendingDodge = true;
    if (k.bindingPressed(b.ability1)) this.pending.ability1 = true;
    if (k.bindingPressed(b.ability2)) this.pending.ability2 = true;
    if (k.bindingPressed(b.leader)) this.pending.leader = true;
    if (k.bindingPressed(b.mark)) this.pending.mark = true;
    if (k.bindingPressed(b.lock)) {
      // Shift with the lock key releases (unless the lock key is a Shift itself).
      if (!b.lock.startsWith('Shift') && (k.down('ShiftLeft') || k.down('ShiftRight'))) this.pending.unlock = true;
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
    const b = settings.keys;
    const fwd = (k.bindingDown(b.forward) ? 1 : 0) - (k.bindingDown(b.back) ? 1 : 0);
    const side = (k.bindingDown(b.right) ? 1 : 0) - (k.bindingDown(b.left) ? 1 : 0);
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
