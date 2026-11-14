import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  gravity: number;
}

interface Arc {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}

const MAX_PARTICLES = 220;

/**
 * Hit sparks, dust and swing trails (after tin-wolf's render/effects). Purely visual:
 * uses Math.random, never the sim RNG.
 */
export class Effects {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private free: Particle[] = [];
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private mats = new Map<string, THREE.MeshBasicMaterial>();
  private arcs: Arc[] = [];

  private mat(color: string): THREE.MeshBasicMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      this.mats.set(color, m);
    }
    return m;
  }

  /** Sparks and a puff of dust where a blow lands. `dirX/dirZ` is the direction of the blow. */
  hit(x: number, z: number, dirX: number, dirZ: number, heavy: boolean): void {
    const n = heavy ? 18 : 10;
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      const speed = (heavy ? 5 : 3.5) * (0.5 + Math.random());
      const c = Math.cos(spread);
      const s = Math.sin(spread);
      const dx = dirX * c - dirZ * s;
      const dz = dirX * s + dirZ * c;
      const color = i % 3 === 0 ? '#fff6d8' : i % 3 === 1 ? '#ffd27a' : '#ff9a3c';
      this.spawn(x, 1.1 + Math.random() * 0.4, z, dx * speed, 1 + Math.random() * 3, dz * speed, 0.18 + Math.random() * 0.2, 0.05 + Math.random() * 0.04, color, 14);
    }
    this.dust(x, z, heavy ? 8 : 4);
  }

  dust(x: number, z: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 1.2;
      this.spawn(x, 0.1, z, Math.cos(a) * sp, 0.4 + Math.random() * 0.8, Math.sin(a) * sp, 0.4 + Math.random() * 0.3, 0.1 + Math.random() * 0.1, i % 2 ? '#c9b98a' : '#b3a273', 1);
    }
  }

  /** A pale crescent in front of the attacker at the moment of the strike. */
  swingArc(x: number, z: number, facing: number, reach: number, arc: number, heavy: boolean): void {
    let a = this.arcs.find((o) => o.life <= 0);
    if (!a) {
      const mat = new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
      a = { mesh: new THREE.Mesh(new THREE.BufferGeometry(), mat), life: 0, max: 0 };
      this.arcs.push(a);
      this.group.add(a.mesh);
    }
    a.mesh.geometry.dispose();
    // RingGeometry's theta starts at +x and runs counter-clockwise; centre the arc on +y,
    // which becomes -z (the figure's forward) after rotating the ring flat.
    const geo = new THREE.RingGeometry(reach * 0.45, reach, 20, 1, Math.PI / 2 - arc / 2, arc);
    geo.rotateX(-Math.PI / 2);
    a.mesh.geometry = geo;
    a.mesh.position.set(x, heavy ? 0.9 : 1.1, z);
    a.mesh.rotation.set(0, -facing, 0);
    a.mesh.visible = true;
    a.life = a.max = heavy ? 0.16 : 0.11;
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: string, gravity: number): void {
    let p = this.free.pop();
    if (!p) {
      if (this.particles.length >= MAX_PARTICLES) return;
      p = { mesh: new THREE.Mesh(this.boxGeo, this.mat(color)), vx: 0, vy: 0, vz: 0, life: 0, max: 0, size: 0, gravity: 0 };
      this.group.add(p.mesh);
    }
    p.mesh.material = this.mat(color);
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = p.max = life;
    p.size = size;
    p.gravity = gravity;
    this.particles.push(p);
  }

  update(dt: number): void {
    for (const a of this.arcs) {
      if (a.life <= 0) continue;
      a.life -= dt;
      (a.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, a.life / a.max) * 0.55;
      if (a.life <= 0) a.mesh.visible = false;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        this.free.push(p);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.02, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(p.size * (0.4 + 0.6 * (p.life / p.max)));
    }
  }
}
