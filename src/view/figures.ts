import * as THREE from 'three';
import type { ClassId } from '../sim/types';
import { BOSS_COLORS, FX, type FigureColors } from './palette';

/** How a figure moves its arms: sword-style swings, bow draws, or staff/orb casts. */
export type PoseStyle = 'melee' | 'archer' | 'caster';

/**
 * The jointed parts of a code-built figure (~1.8 m, facing -z). Arms have an elbow so archers
 * and casters can be posed by hand position (see `ik.ts`); melee poses keep the elbow straight.
 */
export interface FigureRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  /** Melee weapon in the right hand (sword, mace, axe), posed like the Stage 1 sword. */
  weaponR: THREE.Group | null;
  /** Berserker's second axe. */
  weaponL: THREE.Group | null;
  /** Bow (left hand) or staff / orb (cast hand), oriented in torso space by the poses. */
  prop: THREE.Group | null;
  /** Arrow shown on the string while an archer draws. */
  nocked: THREE.Object3D | null;
  style: PoseStyle;
  /** Which hand casts: 1 right (staff), -1 left (healer's orb). */
  castSide: 1 | -1;
  /** Resting forward lean of the torso (Berserker hunches). */
  lean: number;
  /** Shoulder half-width in torso space. */
  shoulderX: number;
  /** Height for the health bar. */
  barY: number;
  /** Lit materials (tinted by hit flash and frost). */
  materials: THREE.MeshLambertMaterial[];
}

/** Upper arm and forearm lengths (shoulder to elbow, elbow to the hand's grip point). */
export const ARM = { upper: 0.3, fore: 0.34 } as const;
export const SHOULDER_Y = 0.6;

const BONE = '#e8dfc8';

export function poseStyleOf(classId: ClassId): PoseStyle {
  switch (classId) {
    case 'bogenschuetze':
      return 'archer';
    case 'heiler':
    case 'magier':
    case 'schamane':
    case 'sumpfhexe':
      return 'caster';
    default:
      return 'melee';
  }
}

class Builder {
  readonly materials: THREE.MeshLambertMaterial[] = [];
  private cache = new Map<string, THREE.MeshLambertMaterial>();

  mat(color: string): THREE.MeshLambertMaterial {
    let m = this.cache.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.cache.set(color, m);
      this.materials.push(m);
    }
    return m;
  }

  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
    return this.mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z);
  }

  mesh(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
}

/** An unlit, bright mesh for glowing bits (orbs, crystals), with an additive halo. */
function glow(color: string, core: string, r: number): THREE.Group {
  const g = new THREE.Group();
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshBasicMaterial({ color: core }));
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r * 1.9, 1),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  g.add(inner, halo);
  return g;
}

/** How much bigger than a soldier each boss stands (Stage 5 decision). */
export const BOSS_SCALE: Partial<Record<ClassId, number>> = { kriegsherr: 1.6, sumpfhexe: 1.4, knochenkoenig: 1.7 };

/** Bosses wear their own colours over the team tint. */
function bossColors(classId: ClassId, c: FigureColors): FigureColors {
  const k = BOSS_COLORS;
  switch (classId) {
    case 'kriegsherr':
      return { ...c, tunic: k.iron, trim: k.ironEdge, legs: k.ironDark, metal: k.iron, leather: k.ironDark, shield: k.iron, wood: '#3a2a1e' };
    case 'sumpfhexe':
      return { ...c, robe: k.rag, mageRobe: k.rag, tunic: k.ragDark, trim: k.ragLight, legs: k.ragDark, skin: k.hag, hair: '#3b3b30', wood: '#4a3a28', fur: k.ragDark };
    case 'knochenkoenig':
      return { ...c, skin: k.bone, tunic: k.rustDark, trim: k.rust, legs: k.bone, metal: k.steel, leather: k.rustDark };
    default:
      return c;
  }
}

/**
 * Builds the figure for a class. Silhouettes (approved 2026-11-14): Krieger sword + round shield,
 * Bogenschuetze hood + bow + quiver, Heiler robe + glowing orb, Magier pointed hat + staff,
 * Schildtraeger plate + bucket helm + tower shield + mace, Berserker bare-chested with wild hair
 * and two axes, Schamane fur mantle + antlers + crooked staff with a glowing skull.
 * Bosses (Stage 5, big + signature props): Iron Warlord dark iron plate, horned helm, huge
 * two-handed axe; Fen Witch hooded robe of rags, crooked staff with a green glow; Bone King pale
 * bone body, rusty crown, greatsword, glowing blue eyes. Wolves have their own view (`wolfView.ts`).
 */
export function buildFigure(classId: ClassId, team: FigureColors, hero: boolean): FigureRig {
  const b = new Builder();
  const c = bossColors(classId, team);
  const style = poseStyleOf(classId);
  const bulk = classId === 'schildtraeger' ? 1.18 : classId === 'kriegsherr' ? 1.25 : classId === 'berserker' ? 1.08 : classId === 'magier' || classId === 'heiler' ? 0.94 : 1;
  const shoulderX = 0.29 * bulk;

  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);

  // Legs: thigh-to-ankle in one piece, boots at the end.
  const legColor = classId === 'schildtraeger' || classId === 'kriegsherr' ? c.metal : c.legs;
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [g, x] of [[legL, -0.11], [legR, 0.11]] as const) {
    g.position.x = x * bulk;
    g.add(b.box(0.15, 0.82, 0.17, legColor, 0, -0.41), b.box(0.17, 0.16, 0.27, c.leather, 0, -0.87, -0.04));
    hips.add(g);
  }

  // Torso by class.
  const robed = classId === 'heiler' || classId === 'magier' || classId === 'sumpfhexe';
  const plated = classId === 'schildtraeger' || classId === 'kriegsherr';
  const chestColor = classId === 'heiler' ? c.robe : classId === 'magier' || classId === 'sumpfhexe' ? c.mageRobe : plated ? c.metal : classId === 'berserker' ? c.skin : c.tunic;
  if (classId === 'knochenkoenig') {
    // A ribcage around a spine instead of a chest.
    torso.add(b.box(0.07, 0.5, 0.07, BOSS_COLORS.boneShadow, 0, 0.38, 0.06));
    for (let i = 0; i < 4; i++) torso.add(b.box(0.4 - i * 0.04, 0.045, 0.24 - i * 0.02, c.skin, 0, 0.55 - i * 0.1));
  } else {
    torso.add(b.box(0.46 * bulk, 0.5, 0.27 * bulk, chestColor, 0, 0.38));
  }
  torso.add(b.box(0.44 * bulk, 0.07, 0.28 * bulk, c.leather, 0, 0.14));
  if (robed) {
    // Long robe hanging from the hips, legs move underneath.
    const robe = b.mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.86, 8), classId === 'heiler' ? c.robe : c.mageRobe, 0, -0.38);
    hips.add(robe);
    torso.add(b.box(0.08, 0.5, 0.02, c.trim, 0, 0.38, -0.14));
    if (classId === 'sumpfhexe') {
      // Rags hanging from the hem and the waist.
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const rag = b.box(0.09, 0.28 + (i % 3) * 0.08, 0.02, i % 2 ? BOSS_COLORS.ragDark : BOSS_COLORS.ragLight, Math.sin(a) * 0.3, -0.85, Math.cos(a) * 0.3);
        rag.rotation.y = a;
        hips.add(rag);
      }
    }
  } else if (classId === 'schamane') {
    hips.add(b.mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 7), c.fur, 0, -0.2));
  } else if (classId === 'berserker') {
    // Fur kilt and a strap across the bare chest.
    hips.add(b.mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.32, 7), c.fur, 0, -0.08));
    const strap = b.box(0.06, 0.6, 0.29, c.leather, 0, 0.4);
    strap.rotation.z = 0.6;
    torso.add(strap);
  } else {
    torso.add(b.box(0.42 * bulk, 0.26, 0.26 * bulk, c.tunic, 0, 0.02));
  }
  if (classId === 'schildtraeger') torso.add(b.box(0.2, 0.62, 0.02, c.tunic, 0, 0.24, -0.17));
  if (classId === 'kriegsherr') {
    // Plate ridges and a dark tasset skirt.
    for (const y of [0.5, 0.32]) torso.add(b.box(0.5 * bulk, 0.04, 0.3 * bulk, BOSS_COLORS.ironEdge, 0, y));
    hips.add(b.mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.3, 8), BOSS_COLORS.ironDark, 0, -0.12));
  }
  if (classId === 'knochenkoenig') {
    // A tattered rust-red cape down the back.
    const cape = b.box(0.46, 0.95, 0.03, c.tunic, 0, 0.12, 0.17);
    cape.rotation.x = 0.08;
    torso.add(cape);
  }
  torso.add(b.box(0.3 * bulk, 0.06, 0.22 * bulk, c.trim, 0, 0.65), b.box(0.1, 0.08, 0.1, c.skin, 0, 0.7));

  const head = b.mesh(new THREE.IcosahedronGeometry(0.12, 1), c.skin, 0, 0.84);
  head.scale.set(1, 1.15, 1.05);
  torso.add(head);

  let barY = 2.15;
  switch (classId) {
    case 'kriegsherr': {
      // Closed helm with a slit and two curved horns.
      torso.add(b.mesh(new THREE.CylinderGeometry(0.145, 0.15, 0.26, 10), c.metal, 0, 0.88));
      torso.add(b.box(0.17, 0.025, 0.02, '#0e0f12', 0, 0.9, -0.15));
      for (const s of [-1, 1]) {
        const horn = new THREE.Group();
        horn.position.set(s * 0.13, 0.95, 0);
        const base = b.mesh(new THREE.ConeGeometry(0.05, 0.2, 6), BOSS_COLORS.horn, s * 0.07, 0.03, 0);
        base.rotation.z = -s * 1.2;
        const tip = b.mesh(new THREE.ConeGeometry(0.035, 0.18, 6), BOSS_COLORS.horn, s * 0.16, 0.14, 0);
        tip.rotation.z = -s * 0.25;
        horn.add(base, tip);
        torso.add(horn);
      }
      break;
    }
    case 'sumpfhexe': {
      // Deep hood with a shadowed face and two green eyes; a long crooked nose.
      const hood = b.mesh(new THREE.ConeGeometry(0.2, 0.45, 7), c.mageRobe, 0, 0.95, 0.04);
      hood.rotation.x = 0.35;
      const cowl = b.mesh(new THREE.IcosahedronGeometry(0.16, 1), c.mageRobe, 0, 0.85, 0.03);
      const shade = b.box(0.17, 0.15, 0.02, '#141510', 0, 0.84, -0.13);
      const nose = b.mesh(new THREE.ConeGeometry(0.025, 0.12, 4), c.skin, 0, 0.82, -0.17);
      nose.rotation.x = -1.9;
      torso.add(cowl, hood, shade, nose);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.016, 0), new THREE.MeshBasicMaterial({ color: FX.poisonCore }));
        eye.position.set(s * 0.045, 0.87, -0.145);
        torso.add(eye);
      }
      const mantle = b.mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.22, 7), BOSS_COLORS.ragDark, 0, 0.58);
      torso.add(mantle);
      barY = 2.3;
      break;
    }
    case 'knochenkoenig': {
      // Skull: dark sockets with blue glowing eyes, a jaw, and a rusty spiked crown.
      for (const s of [-1, 1]) {
        torso.add(b.box(0.045, 0.04, 0.02, '#1a1814', s * 0.045, 0.86, -0.12));
        const eye = glow(FX.boneGlow, '#e8f6ff', 0.016);
        eye.position.set(s * 0.045, 0.86, -0.13);
        torso.add(eye);
      }
      torso.add(b.box(0.13, 0.05, 0.1, BOSS_COLORS.boneShadow, 0, 0.74, -0.04));
      const crown = b.mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.06, 8, 1, true), BOSS_COLORS.rust, 0, 0.96);
      torso.add(crown);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        torso.add(b.mesh(new THREE.ConeGeometry(0.025, 0.09, 4), BOSS_COLORS.rust, Math.sin(a) * 0.12, 1.03, -Math.cos(a) * 0.12));
      }
      break;
    }
    case 'krieger': {
      const helmet = b.mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.13, 8), c.metal, 0, 0.92);
      const top = b.mesh(new THREE.ConeGeometry(0.115, 0.1, 8), c.metal, 0, 1.03);
      torso.add(helmet, top);
      if (hero) torso.add(b.box(0.03, 0.12, 0.24, c.trim, 0, 1.08, 0.01));
      break;
    }
    case 'schildtraeger': {
      torso.add(b.mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.27, 10), c.metal, 0, 0.87));
      torso.add(b.box(0.17, 0.025, 0.02, '#15181d', 0, 0.9, -0.14));
      torso.add(b.box(0.02, 0.1, 0.02, '#15181d', 0, 0.84, -0.14));
      barY = 2.2;
      break;
    }
    case 'berserker': {
      // Wild hair and beard.
      const hair = b.mesh(new THREE.IcosahedronGeometry(0.15, 0), c.hair, 0, 0.92, 0.03);
      hair.scale.set(1.05, 0.8, 1.15);
      const mane = b.box(0.22, 0.3, 0.08, c.hair, 0, 0.74, 0.12);
      const beard = b.mesh(new THREE.ConeGeometry(0.08, 0.2, 5), c.hair, 0, 0.7, -0.09);
      beard.rotation.x = Math.PI;
      torso.add(hair, mane, beard);
      for (const s of [-1, 1]) torso.add(b.box(0.12, 0.05, 0.14, c.leather, s * shoulderX, 0.4));
      break;
    }
    case 'bogenschuetze': {
      const hood = b.mesh(new THREE.IcosahedronGeometry(0.15, 1), c.hood, 0, 0.87, 0.025);
      hood.scale.set(1, 1.1, 1.05);
      const peak = b.mesh(new THREE.ConeGeometry(0.08, 0.2, 6), c.hood, 0, 0.92, 0.14);
      peak.rotation.x = 2.2;
      const cape = b.box(0.42, 0.62, 0.04, c.hood, 0, 0.36, 0.16);
      // Quiver across the back with fletchings sticking out.
      const quiver = b.mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 6), c.leather, 0.1, 0.45, 0.22);
      quiver.rotation.z = -0.4;
      const fletch = b.box(0.1, 0.1, 0.06, '#efe8d8', 0.21, 0.7, 0.22);
      torso.add(hood, peak, cape, quiver, fletch);
      if (hero) torso.add(b.box(0.25, 0.03, 0.24, c.trim, 0, 0.92, 0.02));
      break;
    }
    case 'heiler': {
      const hair = b.mesh(new THREE.IcosahedronGeometry(0.125, 1), c.hair, 0, 0.88, 0.02);
      hair.scale.set(1.02, 0.9, 1.05);
      const circlet = b.mesh(new THREE.TorusGeometry(0.125, 0.015, 4, 12), c.trim, 0, 0.9);
      circlet.rotation.x = Math.PI / 2;
      // Short hooded mantle over the shoulders.
      const mantle = b.mesh(new THREE.CylinderGeometry(0.17, 0.28, 0.2, 8), c.tunic, 0, 0.6);
      torso.add(hair, circlet, mantle);
      break;
    }
    case 'magier': {
      const brim = b.mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 12), c.mageRobe, 0, 0.94);
      const hat = b.mesh(new THREE.ConeGeometry(0.15, 0.46, 8), c.mageRobe, 0, 1.17, 0.02);
      hat.rotation.x = 0.18;
      const band = b.mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.04, 8), c.trim, 0, 0.97);
      const beard = b.mesh(new THREE.ConeGeometry(0.085, 0.26, 5), '#d8d4cc', 0, 0.67, -0.09);
      beard.rotation.x = Math.PI;
      torso.add(brim, hat, band, beard);
      barY = 2.5;
      break;
    }
    case 'schamane': {
      const mantle = b.mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.24, 7), c.fur, 0, 0.58);
      // Antler headdress.
      const cap = b.mesh(new THREE.IcosahedronGeometry(0.13, 0), c.fur, 0, 0.9, 0.02);
      cap.scale.set(1, 0.6, 1);
      torso.add(mantle, cap);
      for (const s of [-1, 1]) {
        const antler = new THREE.Group();
        antler.position.set(s * 0.09, 0.95, 0);
        antler.rotation.z = -s * 0.5;
        const main = b.box(0.03, 0.3, 0.03, BONE, 0, 0.15);
        const tine1 = b.box(0.025, 0.14, 0.025, BONE, s * 0.05, 0.2);
        tine1.rotation.z = -s * 0.8;
        const tine2 = b.box(0.025, 0.12, 0.025, BONE, 0, 0.27, -0.04);
        tine2.rotation.x = -0.7;
        antler.add(main, tine1, tine2);
        torso.add(antler);
      }
      // Bead necklace.
      for (let i = 0; i < 9; i++) {
        const a = (i / 8 - 0.5) * 2.4;
        const bead = b.mesh(new THREE.IcosahedronGeometry(0.022, 0), i % 2 ? BONE : c.trim, Math.sin(a) * 0.15, 0.52 - Math.cos(a) * 0.05, -Math.cos(a) * 0.15);
        torso.add(bead);
      }
      barY = 2.4;
      break;
    }
  }

  // Arms with an elbow; the hand mount is the grip point at the end of the forearm.
  const armColor =
    classId === 'berserker' || classId === 'knochenkoenig' ? c.skin : classId === 'heiler' ? c.robe : classId === 'magier' || classId === 'sumpfhexe' ? c.mageRobe : plated ? c.metal : c.tunic;
  const arms: { arm: THREE.Group; fore: THREE.Group; hand: THREE.Group }[] = [];
  for (const side of [-1, 1] as const) {
    const arm = new THREE.Group();
    arm.position.set(side * shoulderX, SHOULDER_Y, 0);
    const padW = classId === 'kriegsherr' ? 0.3 : classId === 'schildtraeger' ? 0.24 : 0.16;
    const padColor = plated ? c.metal : classId === 'berserker' ? c.fur : c.trim;
    if (!robed) arm.add(b.box(padW, 0.12, padW + 0.04, padColor, side * 0.02, 0.01));
    const thin = classId === 'knochenkoenig' ? 0.6 : 1;
    arm.add(b.box(0.11 * thin, ARM.upper, 0.12 * thin, armColor, 0, -ARM.upper / 2));
    const fore = new THREE.Group();
    fore.position.y = -ARM.upper;
    const sleeve = robed ? 0.13 : 0.1;
    fore.add(b.box(sleeve * thin, 0.26, sleeve * thin, armColor, 0, -0.13), b.box(0.1, 0.1, 0.11, plated ? c.metal : c.skin, 0, -0.33));
    if (classId === 'berserker' || plated) fore.add(b.box(0.12, 0.1, 0.13, c.leather, 0, -0.2));
    const hand = new THREE.Group();
    hand.position.y = -ARM.fore;
    fore.add(hand);
    arm.add(fore);
    torso.add(arm);
    arms.push({ arm, fore, hand });
  }
  const [L, R] = arms as [(typeof arms)[number], (typeof arms)[number]];

  let weaponR: THREE.Group | null = null;
  let weaponL: THREE.Group | null = null;
  let prop: THREE.Group | null = null;
  let nocked: THREE.Object3D | null = null;
  let castSide: 1 | -1 = 1;

  switch (classId) {
    case 'krieger': {
      weaponR = sword(b, c);
      R.hand.add(weaponR);
      L.fore.add(roundShield(b, c));
      break;
    }
    case 'schildtraeger': {
      weaponR = mace(b, c);
      R.hand.add(weaponR);
      // Tall tower shield on the forearm, face forward.
      const shield = new THREE.Group();
      shield.position.set(-0.05, -0.12, -0.14);
      shield.add(b.box(0.56, 0.95, 0.06, c.shield), b.box(0.6, 0.06, 0.08, c.trim, 0, 0.45), b.box(0.6, 0.06, 0.08, c.trim, 0, -0.45), b.box(0.08, 0.9, 0.08, c.trim, 0, 0, -0.01));
      L.fore.add(shield);
      break;
    }
    case 'berserker': {
      weaponR = axe(b, c);
      weaponL = axe(b, c);
      R.hand.add(weaponR);
      L.hand.add(weaponL);
      break;
    }
    case 'bogenschuetze': {
      prop = bow(b, c);
      L.hand.add(prop);
      nocked = arrowMesh(b, c);
      nocked.visible = false;
      R.hand.add(nocked);
      break;
    }
    case 'heiler': {
      castSide = -1;
      prop = new THREE.Group();
      const orb = glow(FX.holy, FX.holyCore, 0.075);
      orb.position.y = 0.14;
      prop.add(orb);
      L.hand.add(prop);
      break;
    }
    case 'magier': {
      prop = staff(b, c, 'magier');
      R.hand.add(prop);
      break;
    }
    case 'schamane': {
      prop = staff(b, c, 'schamane');
      R.hand.add(prop);
      break;
    }
    case 'sumpfhexe': {
      prop = staff(b, c, 'hexe');
      R.hand.add(prop);
      break;
    }
    case 'kriegsherr': {
      weaponR = greatAxe(b, c);
      R.hand.add(weaponR);
      break;
    }
    case 'knochenkoenig': {
      weaponR = greatsword(b);
      R.hand.add(weaponR);
      break;
    }
  }

  // Bosses stand taller than everyone else.
  const scale = BOSS_SCALE[classId] ?? 1;
  root.scale.setScalar(scale);
  barY *= scale;

  return {
    root,
    hips,
    torso,
    legL,
    legR,
    armL: L.arm,
    armR: R.arm,
    foreL: L.fore,
    foreR: R.fore,
    weaponR,
    weaponL,
    prop,
    nocked,
    style,
    castSide,
    lean: classId === 'berserker' ? -0.22 : classId === 'sumpfhexe' ? -0.16 : 0,
    shoulderX,
    barY,
    materials: b.materials,
  };
}

/** Sword: grip in the hand, blade along the hand's -y, turned forward by the pose. */
function sword(b: Builder, c: FigureColors): THREE.Group {
  const g = new THREE.Group();
  const tip = b.mesh(new THREE.ConeGeometry(0.035, 0.1, 4), c.metal, 0, -0.92);
  tip.rotation.x = Math.PI;
  g.add(b.box(0.04, 0.14, 0.04, c.leather), b.box(0.2, 0.035, 0.05, c.trim, 0, -0.08), b.box(0.06, 0.78, 0.015, c.metal, 0, -0.48), tip);
  return g;
}

function mace(b: Builder, c: FigureColors): THREE.Group {
  const g = new THREE.Group();
  const head = b.mesh(new THREE.IcosahedronGeometry(0.1, 0), c.metal, 0, -0.56);
  g.add(b.box(0.045, 0.6, 0.045, c.wood, 0, -0.25), head);
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) g.add(b.box(x ? 0.06 : 0.02, 0.16, z ? 0.06 : 0.02, c.metal, x * 0.09, -0.56, z * 0.09));
  return g;
}

function axe(b: Builder, c: FigureColors): THREE.Group {
  const g = new THREE.Group();
  const blade = b.mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 6, 1, false, 0, Math.PI), c.metal, 0, -0.5, 0);
  blade.rotation.set(0, Math.PI / 2, Math.PI / 2);
  g.add(b.box(0.04, 0.62, 0.04, c.wood, 0, -0.27), blade);
  return g;
}

function roundShield(b: Builder, c: FigureColors): THREE.Group {
  const g = new THREE.Group();
  const shield = b.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), c.shield, -0.04, -0.12, -0.12);
  shield.rotation.x = Math.PI / 2;
  const boss = b.mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), c.trim, -0.04, -0.12, -0.16);
  boss.rotation.x = Math.PI / 2;
  g.add(shield, boss);
  return g;
}

/** Bow in its own frame: grip at the origin, limbs along y, belly towards -z, string behind. */
function bow(b: Builder, c: FigureColors): THREE.Group {
  const g = new THREE.Group();
  const r = 0.55;
  const arc = 1.7;
  const geo = new THREE.TorusGeometry(r, 0.034, 5, 14, arc);
  geo.rotateZ(-arc / 2);
  geo.rotateY(Math.PI / 2);
  geo.translate(0, 0, r);
  // After the turn the belly sits at z = 0 and the tips curve back towards +z.
  g.add(b.mesh(geo, c.wood));
  const half = r * Math.sin(arc / 2);
  const back = r * (1 - Math.cos(arc / 2));
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.008, half * 2, 0.008), new THREE.MeshBasicMaterial({ color: '#efe8d8' }));
  string.position.z = back;
  g.add(string);
  return g;
}

/** Arrow pointing along -z from its nock at the origin. */
function arrowMesh(b: Builder, c: FigureColors): THREE.Group {
  const g = new THREE.Group();
  g.add(b.box(0.015, 0.015, 0.72, c.wood, 0, 0, -0.36), b.box(0.04, 0.04, 0.06, c.metal, 0, 0, -0.72), b.box(0.005, 0.05, 0.1, '#efe8d8', 0, 0, -0.06));
  return g;
}

/** Iron Warlord's huge two-handed axe: long haft, a double crescent head with a spike on top. */
function greatAxe(b: Builder, c: FigureColors): THREE.Group {
  const g = new THREE.Group();
  g.add(b.box(0.05, 1.3, 0.05, c.wood, 0, -0.5));
  for (const s of [-1, 1]) {
    const blade = b.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 8, 1, false, 0, Math.PI), BOSS_COLORS.steel, 0, -1.0, s * 0.03);
    blade.rotation.set(0, (s * Math.PI) / 2, Math.PI / 2);
    g.add(blade);
  }
  const spike = b.mesh(new THREE.ConeGeometry(0.035, 0.18, 4), BOSS_COLORS.steel, 0, -1.23);
  spike.rotation.x = Math.PI;
  g.add(spike, b.box(0.09, 0.1, 0.09, BOSS_COLORS.ironDark, 0, -0.96));
  return g;
}

/** Bone King's greatsword: a long notched blade with a rusty guard. */
function greatsword(b: Builder): THREE.Group {
  const g = new THREE.Group();
  const tip = b.mesh(new THREE.ConeGeometry(0.06, 0.16, 4), BOSS_COLORS.steel, 0, -1.4);
  tip.rotation.x = Math.PI;
  g.add(
    b.box(0.05, 0.28, 0.05, BOSS_COLORS.rustDark, 0, 0.05),
    b.box(0.36, 0.05, 0.07, BOSS_COLORS.rust, 0, -0.1),
    b.box(0.11, 1.2, 0.025, BOSS_COLORS.steel, 0, -0.72),
    b.box(0.03, 1.1, 0.03, BOSS_COLORS.boneShadow, 0, -0.68),
    tip,
  );
  return g;
}

/** Staff in its own frame: grip at the origin, shaft along y. */
function staff(b: Builder, c: FigureColors, kind: 'magier' | 'schamane' | 'hexe'): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'magier') {
    g.add(b.box(0.045, 1.72, 0.045, c.wood, 0, -0.14));
    for (const s of [-1, 1]) {
      const prong = b.box(0.03, 0.18, 0.03, c.trim, s * 0.05, 0.78);
      prong.rotation.z = s * 0.4;
      g.add(prong);
    }
    const ember = glow(FX.fire, FX.fireCore, 0.055);
    ember.position.y = 0.82;
    g.add(ember);
  } else if (kind === 'hexe') {
    // Gnarled and crooked, hooked at the top around a green glow.
    g.add(b.box(0.055, 1.5, 0.055, c.wood, 0, -0.25));
    const bend = b.box(0.05, 0.36, 0.05, c.wood, 0.08, 0.6);
    bend.rotation.z = -0.6;
    const hook = b.box(0.045, 0.26, 0.045, c.wood, 0.2, 0.74);
    hook.rotation.z = 0.9;
    for (const [y, z] of [[0.1, 0.4], [-0.4, -0.5]] as const) {
      const knot = b.box(0.08, 0.06, 0.08, c.wood, 0, y);
      knot.rotation.y = z;
      g.add(knot);
    }
    const light = glow(FX.poison, FX.poisonCore, 0.07);
    light.position.set(0.08, 0.76, 0);
    g.add(bend, hook, light);
  } else {
    // Crooked: a straight lower part, a bend, a skull with a crystal above it.
    g.add(b.box(0.05, 1.4, 0.05, c.wood, 0, -0.3));
    const bend = b.box(0.045, 0.4, 0.045, c.wood, 0.06, 0.55);
    bend.rotation.z = -0.35;
    const skull = b.mesh(new THREE.IcosahedronGeometry(0.075, 0), BONE, 0.12, 0.78);
    const jaw = b.box(0.08, 0.04, 0.08, BONE, 0.12, 0.71, -0.01);
    for (const s of [-1, 1]) g.add(b.box(0.022, 0.022, 0.01, '#1a1612', 0.12 + s * 0.03, 0.79, -0.072));
    const crystal = glow(FX.holy, FX.holyCore, 0.045);
    crystal.position.set(0.12, 0.92, 0);
    g.add(bend, skull, jaw, crystal);
  }
  return g;
}
