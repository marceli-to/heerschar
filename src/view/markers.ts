import * as THREE from 'three';

const WIDTH = 1.0;
const HEIGHT = 0.2;
/** Canvas pixels per world unit (drawn at 2× for crisp edges). */
const PX = 200;
const W = Math.round(WIDTH * PX);
const H = Math.round(HEIGHT * PX);
const INK = '#3b2414';

/** Fill gradients (6i Storybook): player gold, enemy red. */
const FILLS: Record<string, [string, string]> = {
  player: ['#ffe07a', '#f0a92a'],
  enemy: ['#ff7b62', '#e0392a'],
};

/**
 * Health bar floating above a unit, always facing the camera (restyled 6i): a fat pill with an ink
 * outline, dark track, a shiny fill and a pale "lag" segment draining away after a hit. Drawn on a
 * small canvas, redrawn only when the shown amounts change.
 */
export class HealthBar {
  readonly group = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly colors: [string, string];
  private drawnFill = -1;
  private drawnLag = -1;
  private lagFrac = 1;

  constructor(side: 'player' | 'enemy') {
    this.colors = FILLS[side]!;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT), mat);
    mesh.renderOrder = 10;
    this.group.add(mesh);
    this.group.renderOrder = 10;
  }

  private pill(x: number, y: number, w: number, h: number): void {
    const r = Math.min(h / 2, w / 2);
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
  }

  private draw(fill: number, lag: number): void {
    const c = this.ctx;
    const o = 6; // outline width in canvas px
    c.clearRect(0, 0, W, H);
    this.pill(0, 0, W, H);
    c.fillStyle = INK;
    c.fill();
    const ix = o;
    const iy = o;
    const iw = W - 2 * o;
    const ih = H - 2 * o;
    this.pill(ix, iy, iw, ih);
    c.fillStyle = '#6d4a30';
    c.fill();
    if (lag > fill) {
      this.pill(ix, iy, Math.max(ih, iw * lag), ih);
      c.fillStyle = '#fff1d0';
      c.fill();
    }
    if (fill > 0) {
      const fw = Math.max(ih, iw * fill);
      const g = c.createLinearGradient(0, iy, 0, iy + ih);
      g.addColorStop(0, this.colors[0]);
      g.addColorStop(1, this.colors[1]);
      this.pill(ix, iy, fw, ih);
      c.fillStyle = g;
      c.fill();
      // Shine stripe along the top.
      this.pill(ix + ih * 0.35, iy + ih * 0.16, Math.max(0, fw - ih * 0.7), ih * 0.24);
      c.fillStyle = 'rgb(255 255 255 / 0.45)';
      c.fill();
    }
    this.texture.needsUpdate = true;
  }

  /** `frac` is 0..1. The pale "lag" segment shows recent damage draining away. */
  update(x: number, y: number, z: number, frac: number, camera: THREE.Camera, frameTime: number): void {
    this.group.position.set(x, y, z);
    this.group.quaternion.copy(camera.quaternion);
    if (this.lagFrac > frac) this.lagFrac = Math.max(frac, this.lagFrac - frameTime * 0.8);
    else this.lagFrac = frac;
    // Redraw only when a change shows at canvas resolution.
    const f = Math.round(frac * W) / W;
    const l = Math.round(this.lagFrac * W) / W;
    if (f !== this.drawnFill || l !== this.drawnLag) {
      this.draw(f, l);
      this.drawnFill = f;
      this.drawnLag = l;
    }
  }

  dispose(): void {
    this.texture.dispose();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
