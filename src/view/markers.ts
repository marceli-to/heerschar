import * as THREE from 'three';

const WIDTH = 0.9;
const HEIGHT = 0.09;

/** Health bar floating above a unit, always facing the camera. */
export class HealthBar {
  readonly group = new THREE.Group();
  private readonly fill: THREE.Mesh;
  private readonly lag: THREE.Mesh;
  private shown = -1;
  private lagFrac = 1;

  constructor(color: string) {
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 0.06, HEIGHT + 0.06), this.mat('#1b130c', 0.75));
    const lagGeo = new THREE.PlaneGeometry(WIDTH, HEIGHT);
    lagGeo.translate(WIDTH / 2, 0, 0);
    this.lag = new THREE.Mesh(lagGeo, this.mat('#f1e3b5', 0.9));
    this.lag.position.set(-WIDTH / 2, 0, 0.001);
    const fillGeo = new THREE.PlaneGeometry(WIDTH, HEIGHT);
    fillGeo.translate(WIDTH / 2, 0, 0);
    this.fill = new THREE.Mesh(fillGeo, this.mat(color, 1));
    this.fill.position.set(-WIDTH / 2, 0, 0.002);
    this.group.add(bg, this.lag, this.fill);
    this.group.renderOrder = 10;
    for (const m of [bg, this.lag, this.fill]) m.renderOrder = 10;
  }

  private mat(color: string, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, fog: false });
  }

  /** `frac` is 0..1. The pale "lag" segment shows recent damage draining away. */
  update(x: number, y: number, z: number, frac: number, camera: THREE.Camera, frameTime: number): void {
    this.group.position.set(x, y, z);
    this.group.quaternion.copy(camera.quaternion);
    if (frac !== this.shown) {
      this.fill.scale.x = Math.max(0.0001, frac);
      this.shown = frac;
    }
    if (this.lagFrac > frac) this.lagFrac = Math.max(frac, this.lagFrac - frameTime * 0.8);
    else this.lagFrac = frac;
    this.lag.scale.x = Math.max(0.0001, this.lagFrac);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
