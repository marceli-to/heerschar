import * as THREE from 'three';

/** Stars per stunned unit, how far they circle from the head, how fast (rad/s). */
const STARS = 3;
const RADIUS = 0.38;
const SPIN = 5;
const SIZE = 0.26;

/** A chunky Storybook star: yellow fill, ink outline, a pale shine. Drawn once. */
function starTexture(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const path = (r: number): void => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.48 : r;
      g.lineTo(s / 2 + Math.cos(a) * rr, s / 2 + 2 + Math.sin(a) * rr);
    }
    g.closePath();
  };
  path(26);
  g.lineJoin = 'round';
  g.lineWidth = 7;
  g.strokeStyle = '#3b2414';
  g.stroke();
  g.fillStyle = '#ffd84a';
  g.fill();
  path(14);
  g.fillStyle = 'rgba(255, 250, 220, 0.75)';
  g.translate(-3, -4);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Stars circling the head of a stunned unit (Shield Bash). Call `show` for every stunned unit
 * each frame, then `endFrame` hides the stars of units that are no longer stunned.
 */
export class StunStars {
  readonly group = new THREE.Group();
  private tex = starTexture();
  private mat = new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true, toneMapped: false });
  private sets = new Map<number, { stars: THREE.Group; seen: boolean; phase: number }>();

  show(id: number, x: number, y: number, z: number, dt: number): void {
    let set = this.sets.get(id);
    if (!set) {
      const stars = new THREE.Group();
      for (let i = 0; i < STARS; i++) {
        const sp = new THREE.Sprite(this.mat);
        sp.scale.setScalar(SIZE);
        sp.renderOrder = 5;
        stars.add(sp);
      }
      this.group.add(stars);
      set = { stars, seen: false, phase: Math.random() * Math.PI * 2 };
      this.sets.set(id, set);
    }
    set.seen = true;
    set.phase += dt * SPIN;
    set.stars.visible = true;
    set.stars.position.set(x, y, z);
    set.stars.children.forEach((sp, i) => {
      const a = set.phase + (i * Math.PI * 2) / STARS;
      // A tilted circle: the far stars sit a little higher, so the ring reads in perspective.
      sp.position.set(Math.cos(a) * RADIUS, Math.sin(a) * 0.08, Math.sin(a) * RADIUS);
    });
  }

  endFrame(): void {
    for (const set of this.sets.values()) {
      if (!set.seen) set.stars.visible = false;
      set.seen = false;
    }
  }

  clear(): void {
    for (const set of this.sets.values()) this.group.remove(set.stars);
    this.sets.clear();
  }

  dispose(): void {
    this.clear();
    this.mat.dispose();
    this.tex.dispose();
  }
}
