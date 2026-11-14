import { reactive } from 'vue';
import { createBattle, step } from '../sim/battle';
import { DT } from '../sim/balance';
import { emptyInput, type Battle } from '../sim/types';
import { KeyboardMouse } from '../input/keyboardMouse';
import { createScene, type SceneParts } from '../view/scene';
import { createArena } from '../view/arena';
import { CameraRig } from '../view/camera';
import { startLoop, type RunningLoop } from './loop';

export interface DebugStats {
  visible: boolean;
  fps: number;
  tick: number;
  units: number;
  zoom: number;
}

/** Glue between simulation, input and view. Owns the loop. */
export class Game {
  readonly debug: DebugStats = reactive({ visible: true, fps: 0, tick: 0, units: 0, zoom: 0 });
  private battle: Battle;
  private parts: SceneParts;
  private rig: CameraRig;
  private input: KeyboardMouse;
  private loop: RunningLoop | null = null;
  private fpsFrames = 0;
  private fpsTime = 0;
  private resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement, seed: number, zoom = 0.6) {
    this.battle = createBattle({ seed });
    this.parts = createScene(canvas);
    this.parts.scene.add(createArena(this.battle.arena.width, this.battle.arena.depth));
    this.rig = new CameraRig(1, zoom);
    this.debug.zoom = this.rig.zoomLevel;
    this.input = new KeyboardMouse(canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  start(): void {
    this.loop = startLoop(DT, {
      frameStart: (frameTime) => this.frameStart(frameTime),
      tick: () => {
        step(this.battle, emptyInput(), DT);
      },
      render: (_alpha, frameTime) => this.render(frameTime),
    });
  }

  dispose(): void {
    this.loop?.stop();
    this.input.dispose();
    this.resizeObserver.disconnect();
    this.parts.renderer.dispose();
  }

  private frameStart(frameTime: number): void {
    const k = this.input;
    if (k.pressed('F3')) this.debug.visible = !this.debug.visible;
    this.rig.addZoom(k.consumeWheel());
    this.rig.addYaw(k.consumeMouse().dx);
    k.endFrame();
    this.countFps(frameTime);
  }

  private render(frameTime: number): void {
    // Stage 0 has no hero yet: the camera orbits the arena centre.
    this.rig.update({ x: 0, z: 0 }, frameTime);
    this.parts.renderer.render(this.parts.scene, this.rig.camera);
  }

  private countFps(frameTime: number): void {
    this.fpsFrames++;
    this.fpsTime += frameTime;
    if (this.fpsTime >= 0.5) {
      this.debug.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.debug.tick = this.battle.tick;
      this.debug.units = this.battle.units.length;
      this.debug.zoom = Math.round(this.rig.zoomLevel * 100) / 100;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.parts.renderer.setSize(w, h, false);
    this.rig.setAspect(w / h);
  }
}
