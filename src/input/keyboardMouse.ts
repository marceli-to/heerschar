/**
 * Raw keyboard and mouse state (after tin-wolf's input/keyboardMouse).
 * Mouse movement and wheel are only collected while the pointer is locked to the canvas.
 */
export class KeyboardMouse {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private buttons = new Set<number>();
  private buttonsPressedThisFrame = new Set<number>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('contextmenu', this.onContextMenu);
    target.addEventListener('click', this.onCanvasClick);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.target.removeEventListener('click', this.onCanvasClick);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target;
  }

  requestLock(): void {
    if (this.locked) return;
    // Some browsers return a promise that rejects when re-locking too soon after an exit.
    const r = this.target.requestPointerLock() as unknown;
    if (r instanceof Promise) r.catch(() => undefined);
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  pressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  mouseDown(button: number): boolean {
    return this.buttons.has(button);
  }

  mousePressed(button: number): boolean {
    return this.buttonsPressedThisFrame.has(button);
  }

  consumeMouse(): { dx: number; dy: number } {
    const r = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return r;
  }

  /** Accumulated wheel delta in "notches" (+ = towards the user / zoom out). */
  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Call once per animation frame after all input has been read. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.buttonsPressedThisFrame.clear();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) this.pressedThisFrame.add(e.code);
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.buttons.add(e.button);
    this.buttonsPressedThisFrame.add(e.button);
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.buttons.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onWheel = (e: WheelEvent): void => {
    if (e.deltaY === 0) return;
    // Trackpads send many small deltas, mice send ~100 per notch: normalise to notches.
    const notches = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100;
    this.wheel += Math.max(-3, Math.min(3, notches));
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.buttons.clear();
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onCanvasClick = (): void => {
    this.requestLock();
  };
}
