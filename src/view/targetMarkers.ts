import * as THREE from 'three';
import { FX } from './palette';

/** Lock-on: a thin gold ring on the ground with four inward ticks, slowly turning. */
export class LockRing {
  readonly group = new THREE.Group();
  private readonly spinner = new THREE.Group();
  private readonly mat = new THREE.MeshBasicMaterial({ color: FX.lock, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  private readonly geos: THREE.BufferGeometry[] = [];
  private time = 0;

  constructor() {
    const ring = new THREE.RingGeometry(0.78, 0.84, 48, 1).rotateX(-Math.PI / 2);
    const tick = new THREE.BufferGeometry();
    // A small triangle pointing at the centre, lying flat.
    tick.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.7, -0.09, 0, -0.98, 0.09, 0, -0.98], 3));
    this.geos.push(ring, tick);
    this.spinner.add(new THREE.Mesh(ring, this.mat));
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(tick, this.mat);
      m.rotation.y = (i * Math.PI) / 2;
      this.spinner.add(m);
    }
    this.mat.side = THREE.DoubleSide;
    this.spinner.traverse((o) => (o.renderOrder = 4));
    this.group.add(this.spinner);
    this.group.visible = false;
  }

  update(x: number, z: number, visible: boolean, frameTime: number): void {
    this.group.visible = visible;
    if (!visible) return;
    this.time += frameTime;
    this.group.position.set(x, 0.07, z);
    this.spinner.rotation.y = this.time * 0.9;
    const pulse = 1 + Math.sin(this.time * 4) * 0.03;
    this.spinner.scale.setScalar(pulse);
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    this.mat.dispose();
  }
}

/** Mark: a small red swallow-tail banner on a pole above the head, waving, seen through figures. */
export class MarkBanner {
  readonly group = new THREE.Group();
  private readonly flag = new THREE.Group();
  private readonly mats: THREE.MeshBasicMaterial[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private time = 0;

  constructor() {
    const pole = new THREE.BoxGeometry(0.035, 0.75, 0.035).translate(0, 0.375, 0);
    const knob = new THREE.IcosahedronGeometry(0.045, 0).translate(0, 0.77, 0);
    // Swallow-tail cloth hanging from the pole top, pointing to +x.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.5, 0);
    shape.lineTo(0.36, -0.17);
    shape.lineTo(0.5, -0.34);
    shape.lineTo(0, -0.34);
    shape.closePath();
    const cloth = new THREE.ShapeGeometry(shape);
    const trim = new THREE.PlaneGeometry(0.5, 0.04).translate(0.25, -0.01, 0.001);
    this.geos.push(pole, knob, cloth, trim);
    const gold = this.mat(FX.bannerTrim);
    const red = this.mat(FX.banner);
    this.group.add(new THREE.Mesh(pole, gold), new THREE.Mesh(knob, gold));
    this.flag.position.set(0.02, 0.72, 0);
    this.flag.add(new THREE.Mesh(cloth, red), new THREE.Mesh(trim, gold));
    this.group.add(this.flag);
    this.group.traverse((o) => (o.renderOrder = 11));
    this.group.visible = false;
  }

  private mat(color: string): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false, transparent: true });
    this.mats.push(m);
    return m;
  }

  update(x: number, y: number, z: number, visible: boolean, camera: THREE.Camera, frameTime: number): void {
    this.group.visible = visible;
    if (!visible) return;
    this.time += frameTime;
    this.group.position.set(x, y + Math.sin(this.time * 2.2) * 0.04, z);
    // Turn with the camera so the cloth always reads side-on.
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.group.rotation.set(0, e.y, 0);
    this.flag.rotation.y = Math.sin(this.time * 3.1) * 0.35;
    this.flag.rotation.z = Math.sin(this.time * 4.3) * 0.05;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
