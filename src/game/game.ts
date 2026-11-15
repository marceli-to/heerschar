import * as THREE from 'three';
import { reactive } from 'vue';
import { createBattle, heroOf, step, type BattleSetup } from '../sim/battle';
import { BOSS_ACTIONS, COUNTDOWN, DT, ENERGY, HERO, HERO_ABILITIES, heroAttack } from '../sim/balance';
import { actionTiming, meleeAttackOf } from '../sim/ai';
import { isBoss } from '../sim/body';
import { heroKit } from '../sim/heroAbilities';
import { angleDiff, angleTo, lerp, lerpAngle } from '../sim/math';
import type { AreaKind, Battle, BattleEvent, ClassId, HeroAbilityId, Unit } from '../sim/types';
import type { RegionId } from '../data/campaign';
import { STRINGS } from '../data/strings';
import { hasStatus } from '../sim/statuses';
import { ledgerEntry, tallyEvents, type Ledger } from '../sim/ledger';
import { botInput, createBot, type BotState } from '../sim/bot';
import { KeyboardMouse } from '../input/keyboardMouse';
import { HeroInputSampler } from '../input/heroInput';
import { createScene, type SceneParts } from '../view/scene';
import { createArena, type Arena } from '../view/arena';
import { REGION_LOOKS } from '../view/scenery/looks';
import { CameraRig } from '../view/camera';
import { Effects } from '../view/effects';
import { FxWorld, SwingTrail } from '../view/fx';
import { Post } from '../view/post';
import { HealthBar } from '../view/markers';
import { FX } from '../view/palette';
import type { UnitView } from '../view/unitView';
import { createUnitView } from '../view/createView';
import { ProjectileLayer } from '../view/projectileView';
import { AreaLayer } from '../view/areaView';
import { LockRing, MarkBanner } from '../view/targetMarkers';
import { DamageNumbers } from '../view/damageNumbers';
import { startLoop, type RunningLoop } from './loop';

export interface DebugStats {
  visible: boolean;
  fps: number;
  tick: number;
  units: number;
  zoom: number;
  /** Lock and mark target ids. */
  lock: number | null;
  mark: number | null;
}

export type Phase = 'intro' | 'playing' | 'paused' | 'ended';

/** What to fight: built by the app from the squad and an encounter, or the Stage 1 trial. */
export interface BattleSpec {
  mode: 'trial' | 'squad';
  /** Builds the setup for a seed; called again with a new seed on restart. */
  build: (seed: number) => BattleSetup;
  /** Display names of the player units in setup order (index 0 = unit id 1). */
  names: string[];
  /** Intro panel heading and text. */
  title: string;
  intro: string;
  /** Where the battle is fought (picks the enemies' look: skeletons in the Barrowlands). */
  region: RegionId;
}

export interface HudAbility {
  id: HeroAbilityId;
  key: string;
  cost: number;
  /** Seconds of cooldown left, and that as a fraction of the full cooldown. */
  cooldown: number;
  cooldownFrac: number;
  /** Enough energy to pay for it. */
  affordable: boolean;
  /** The hero is casting it right now. */
  active: boolean;
}

export interface HudCompanion {
  id: number;
  name: string;
  classId: ClassId;
  hp: number;
  maxHp: number;
  dead: boolean;
}

/** An arrow at the screen edge towards something off screen. Positions in CSS pixels. */
export interface HudEdgeMarker {
  kind: 'ally' | 'mark';
  /** Unit id, for the key; the class for the medallion. */
  id: number;
  classId: ClassId;
  x: number;
  y: number;
  /** Screen angle the arrow points along, radians, 0 = right, clockwise positive (CSS). */
  angle: number;
}

/** One squad member's line on the end panel. */
export interface HudLedgerRow {
  id: number;
  name: string;
  classId: ClassId;
  hero: boolean;
  fallen: boolean;
  dealt: number;
  taken: number;
  healed: number;
}

export interface HudState {
  phase: Phase;
  /** Which fight runs: the Stage 1 trial (`?trial`) or a squad battle. */
  mode: 'trial' | 'squad';
  /** Intro panel heading and text. */
  title: string;
  intro: string;
  heroClass: ClassId;
  heroName: string;
  /** Whole seconds left in the countdown, 0 once the fight runs. */
  countdown: number;
  heroHp: number;
  heroMaxHp: number;
  /** 0..1, 1 = dodge ready. */
  dodgeReady: number;
  energy: number;
  maxEnergy: number;
  abilities: HudAbility[];
  /** The hero's companions in formation order. */
  squad: HudCompanion[];
  edgeMarkers: HudEdgeMarker[];
  foes: number;
  outcome: 'running' | 'won' | 'lost';
  /** Seconds since the countdown ended. */
  time: number;
  /** The player side's ledger, hero first; filled when the battle ends. */
  ledger: HudLedgerRow[];
  /** The boss of a boss battle, shown in the big bar at the top (`null` = no boss). */
  boss: HudBoss | null;
}

export interface HudBoss {
  id: number;
  classId: ClassId;
  hp: number;
  maxHp: number;
  dead: boolean;
}

interface Pose {
  x: number;
  z: number;
  facing: number;
}

interface UnitSlot {
  view: UnitView;
  bar: HealthBar | null;
  prev: Pose;
  /** Ground speed over the last tick, smoothed, for the walk cycle. */
  speed: number;
  /** Melee model bodies: the ribbon behind the blade, and where its tip was last frame. */
  trail: SwingTrail | null;
  tipPrev: THREE.Vector3;
}

/** Blade tip speed (m/s) above which a swinging weapon leaves a trail. */
const TRAIL_SPEED = 5;
const TRAIL_COLOR = new THREE.Color('#fff4dc').multiplyScalar(1.6);
const _base = new THREE.Vector3();
const _tip = new THREE.Vector3();

/** Edge markers: health fraction that counts as "in danger"; insets from the screen edges in px (clear of the HUD). */
const EDGE = { danger: 0.3, side: 44, top: 90, bottom: 150 } as const;
const _edge = new THREE.Vector3();

const SHAKE = { heroHit: 0.45, heavy: 0.32, light: 0.14 } as const;

/** Glue between simulation, input and view. Owns the loop. */
export class Game {
  readonly debug: DebugStats;
  readonly hud: HudState;
  private battle: Battle;
  private seed: number;
  private peaceful: boolean;
  private spec: BattleSpec;
  private projectiles: ProjectileLayer;
  private areas = new AreaLayer();
  private lockRing = new LockRing();
  private markBanner = new MarkBanner();
  private numbers: DamageNumbers;
  private parts: SceneParts;
  private rig: CameraRig;
  private kbm: KeyboardMouse;
  private heroInput: HeroInputSampler;
  private effects = new Effects();
  /** Look-spike effects: sparks, dust, fire blasts, frost rings, holy light, ground marks, flash lights. */
  private fx = new FxWorld({ glow: true, impact: true, grade: true, marks: true });
  /** Bloom and warm grade after the scene render. */
  private post: Post;
  /** The region's ground, ring and scenery. */
  private arena: Arena;
  private units = new Map<number, UnitSlot>();
  private ledger: Ledger = new Map();
  private unitLayer = new THREE.Group();
  private loop: RunningLoop | null = null;
  private fpsFrames = 0;
  private fpsTime = 0;
  private resizeObserver: ResizeObserver;
  /** Debug: when set, the scripted bot plays the hero (`?bot`). */
  bot: BotState | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, opts: { spec: BattleSpec; seed: number; zoom?: number; debug?: boolean; peaceful?: boolean }) {
    this.seed = opts.seed;
    this.peaceful = opts.peaceful ?? false;
    this.spec = opts.spec;
    this.battle = this.newBattle();
    const hero = heroOf(this.battle);
    this.parts = createScene(canvas, this.spec.region);
    this.arena = createArena(this.battle.arena.width, this.battle.arena.depth, this.spec.region);
    this.projectiles = new ProjectileLayer(this.effects);
    this.numbers = new DamageNumbers(canvas.parentElement ?? document.body);
    this.parts.scene.add(
      this.arena.group,
      this.areas.group,
      this.unitLayer,
      this.projectiles.group,
      this.effects.group,
      this.fx.group,
      this.lockRing.group,
      this.markBanner.group,
    );
    this.rig = new CameraRig(1, opts.zoom ?? 0.25);
    this.post = new Post(this.parts.renderer, this.parts.scene, this.rig.camera);
    this.post.grade.uniforms['uAmount']!.value = REGION_LOOKS[this.spec.region].grade;
    this.kbm = new KeyboardMouse(canvas);
    this.heroInput = new HeroInputSampler(this.kbm);
    this.debug = reactive({ visible: opts.debug ?? false, fps: 0, tick: 0, units: 0, zoom: this.rig.zoomLevel, lock: null, mark: null });
    this.hud = reactive({ phase: 'intro', mode: this.spec.mode, title: this.spec.title, intro: this.spec.intro, heroClass: hero?.classId ?? 'krieger', heroName: this.spec.names[0] ?? '', countdown: 0, heroHp: 0, heroMaxHp: 1, dodgeReady: 1, energy: 0, maxEnergy: ENERGY.max, abilities: [], squad: [], edgeMarkers: [], foes: 0, outcome: 'running', time: 0, ledger: [], boss: null });
    this.buildUnits();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener('pointerlockchange', this.onLockChange);
    this.resize();
  }

  private newBattle(): Battle {
    return createBattle({ ...this.spec.build(this.seed), passiveEnemies: this.peaceful });
  }

  start(): void {
    this.loop = startLoop(DT, {
      frameStart: (frameTime) => this.frameStart(frameTime),
      tick: () => this.tick(),
      render: (alpha, frameTime) => this.render(alpha, frameTime),
    });
  }

  /** Starts the same battle again with a new seed. Called from the end screen. */
  restart(): void {
    this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    this.battle = this.newBattle();
    this.buildUnits();
    this.fx.clear();
    this.numbers.clear();
    this.heroInput.clear();
    if (this.bot) this.bot = createBot();
    this.ledger = new Map();
    this.hud.ledger = [];
    this.hud.outcome = 'running';
    this.hud.phase = 'playing';
    this.kbm.requestLock();
  }

  /** Asks for pointer lock (from a click on an overlay). */
  takeControl(): void {
    this.kbm.requestLock();
  }

  dispose(): void {
    this.loop?.stop();
    this.kbm.dispose();
    this.resizeObserver.disconnect();
    document.removeEventListener('pointerlockchange', this.onLockChange);
    for (const slot of this.units.values()) this.disposeSlot(slot);
    this.projectiles.dispose();
    this.areas.dispose();
    this.fx.dispose();
    this.post.dispose();
    this.arena.dispose();
    this.lockRing.dispose();
    this.markBanner.dispose();
    this.numbers.dispose();
    this.parts.renderer.dispose();
    this.parts.renderer.forceContextLoss();
  }

  private onLockChange = (): void => {
    if (this.hud.phase === 'ended' || this.bot) return;
    if (this.kbm.locked) this.hud.phase = 'playing';
    else if (this.hud.phase === 'playing') this.hud.phase = 'paused';
  };

  private buildUnits(): void {
    for (const slot of this.units.values()) this.disposeSlot(slot);
    this.units.clear();
    for (const u of this.battle.units) this.addUnit(u);
    // Start behind the hero, looking across the field at the enemy.
    const hero = heroOf(this.battle);
    if (hero) this.rig.yaw = hero.facing;
    this.buildHudLists();
  }

  /** A view and health bar for a unit (at the start, or when a boss summons it). */
  private addUnit(u: Unit): void {
    const view = createUnitView(u.classId, u.team, u.isHero, { region: this.spec.region });
    // Bosses show their health in the big bar at the top instead.
    const bar = u.isHero || isBoss(u) ? null : new HealthBar(u.team === 'player' ? '#d9a33a' : '#b8382a');
    this.unitLayer.add(view.root);
    if (bar) this.unitLayer.add(bar.group);
    const trail = view.weaponEdge?.(_base, _tip) ? new SwingTrail(TRAIL_COLOR) : null;
    if (trail) this.fx.group.add(trail.mesh);
    this.units.set(u.id, { view, bar, prev: { x: u.pos.x, z: u.pos.z, facing: u.facing }, speed: 0, trail, tipPrev: _tip.clone() });
  }

  /** Fixed lists for the HUD; `updateHud` only changes their values. */
  private buildHudLists(): void {
    const hero = heroOf(this.battle);
    const kit = hero ? heroKit(hero) : null;
    this.hud.abilities = kit
      ? ([[kit.ability1, 'Q'], [kit.ability2, 'E'], [kit.leader, 'R']] as const).map(([id, key]) => ({ id, key, cost: HERO_ABILITIES[id].cost, cooldown: 0, cooldownFrac: 0, affordable: true, active: false }))
      : [];
    this.hud.squad = this.battle.units
      .filter((u) => u.team === 'player' && !u.isHero)
      .map((u) => ({ id: u.id, name: this.spec.names[u.id - 1] ?? STRINGS.classes[u.classId], classId: u.classId, hp: u.hp, maxHp: u.stats.maxHp, dead: false }));
    this.hud.edgeMarkers = [];
    const boss = this.battle.units.find((u) => isBoss(u));
    this.hud.boss = boss ? { id: boss.id, classId: boss.classId, hp: boss.hp, maxHp: boss.stats.maxHp, dead: false } : null;
  }

  private disposeSlot(slot: UnitSlot): void {
    this.unitLayer.remove(slot.view.root);
    slot.view.dispose();
    if (slot.trail) {
      this.fx.group.remove(slot.trail.mesh);
      slot.trail.dispose();
    }
    if (slot.bar) {
      this.unitLayer.remove(slot.bar.group);
      slot.bar.dispose();
    }
  }

  private frameStart(frameTime: number): void {
    const k = this.kbm;
    if (k.pressed('F3')) this.debug.visible = !this.debug.visible;
    if (this.hud.phase === 'ended' && k.pressed('Enter')) this.restart();
    this.rig.addZoom(k.consumeWheel());
    // While locked on, the camera frames the target itself.
    const mouse = k.consumeMouse();
    if (this.battle.lockTargetId === null) this.rig.addYaw(mouse.dx);
    this.heroInput.collect();
    k.endFrame();
    this.countFps(frameTime);
  }

  private tick(): void {
    if (this.hud.phase !== 'playing') return;
    for (const u of this.battle.units) {
      const slot = this.units.get(u.id);
      if (!slot) continue;
      slot.prev.x = u.pos.x;
      slot.prev.z = u.pos.z;
      slot.prev.facing = u.facing;
    }
    this.projectiles.capture(this.battle);
    const input = this.bot ? botInput(this.battle, this.bot) : this.heroInput.sample(this.rig.yaw);
    const events = step(this.battle, input, DT);
    for (const u of this.battle.units) {
      const slot = this.units.get(u.id);
      if (!slot) continue;
      const v = Math.hypot(u.pos.x - slot.prev.x, u.pos.z - slot.prev.z) / DT;
      slot.speed += (v - slot.speed) * 0.25;
    }
    tallyEvents(this.ledger, events);
    for (const e of events) this.onEvent(e);
  }

  /** The player side in formation order, hero first, with what each did. */
  private ledgerRows(): HudLedgerRow[] {
    const side = this.battle.units.filter((u) => u.team === 'player');
    side.sort((a, b) => Number(b.isHero) - Number(a.isHero));
    return side.map((u) => {
      const e = ledgerEntry(this.ledger, u.id);
      return {
        id: u.id,
        name: this.spec.names[u.id - 1] ?? STRINGS.classes[u.classId],
        classId: u.classId,
        hero: u.isHero,
        fallen: u.state === 'dead',
        dealt: Math.round(e.dealt),
        taken: Math.round(e.taken),
        healed: Math.round(e.healed),
      };
    });
  }

  private unit(id: number): Unit | undefined {
    return this.battle.units.find((u) => u.id === id);
  }

  private onEvent(e: BattleEvent): void {
    switch (e.type) {
      case 'hit': {
        const target = this.unit(e.targetId);
        const attacker = this.unit(e.attackerId);
        this.units.get(e.targetId)?.view.flashHit(e.heavy);
        if (target && attacker) {
          const dx = target.pos.x - attacker.pos.x;
          const dz = target.pos.z - attacker.pos.z;
          const len = Math.hypot(dx, dz) || 1;
          _tip.set(dx / len, 0.35, dz / len);
          this.fx.hit(_base.set(e.x - (dx / len) * 0.3, 1.1, e.z - (dz / len) * 0.3), _tip, e.heavy);
          // Only blows the hero lands or takes shake the camera; the squad's own fight stays calm.
          if (target.isHero) this.rig.shake(SHAKE.heroHit);
          else if (attacker.isHero) this.rig.shake(e.heavy ? SHAKE.heavy : SHAKE.light);
        }
        if (target) this.hitNumbers(target, attacker, e.amount, e.absorbed, e.heavy);
        break;
      }
      case 'heal': {
        const target = this.unit(e.targetId);
        if (!target) break;
        this.effects.ring(e.x, e.z, 0.3, 0.9, FX.heal, 0.5, 0.7);
        this.effects.rise(e.x, e.z, 0.5, [FX.heal, FX.healCore], 6);
        this.numbers.spawn('heal', e.amount, e.x, this.barY(target.id) + 0.1, e.z, target.isHero ? 1.1 : 0.9);
        break;
      }
      case 'areaResolve':
        this.areaBurst(e.kind, e.x, e.z, e.radius, e.angle);
        break;
      case 'spawn': {
        const u = this.unit(e.unitId);
        if (!u) break;
        this.addUnit(u);
        this.fx.dust(u.pos.x, u.pos.z, 10);
        break;
      }
      case 'raise': {
        const u = this.unit(e.unitId);
        if (!u) break;
        this.effects.burst(u.pos.x, 0.4, u.pos.z, [FX.boneGlow, '#e8f6ff'], 18, 2.5, 0.08, 0.7, -2);
        this.effects.ring(u.pos.x, u.pos.z, 0.2, 1.4, FX.boneGlow, 0.6);
        this.fx.dust(u.pos.x, u.pos.z, 8);
        break;
      }
      case 'status': {
        const u = this.unit(e.unitId);
        if (!u || !e.on) break;
        if (e.kind === 'rallied') this.effects.ring(u.pos.x, u.pos.z, 0.3, 1.1, FX.rally, 0.6);
        if (e.kind === 'frozen') {
          this.effects.burst(u.pos.x, 1, u.pos.z, [FX.frost, FX.frostCore], 8, 2, 0.07, 0.5);
          this.fx.frostPatch(u.pos.x, u.pos.z);
        }
        // Blessing (and the squad's wards): a column of light on the shielded ally.
        if (e.kind === 'shielded' && u.team === 'player') this.fx.holyLight(new THREE.Vector3(u.pos.x, 0, u.pos.z));
        if (e.kind === 'shielded') this.effects.burst(u.pos.x, 1.1, u.pos.z, [u.team === 'player' ? FX.shieldPlayer : FX.shieldEnemy], 8, 1.5, 0.05, 0.4, 0);
        break;
      }
      case 'action': {
        // Taunt: a shout ring at the start of the windup.
        const u = this.unit(e.unitId);
        if (!u) break;
        if (e.action === 'taunt') this.effects.ring(u.pos.x, u.pos.z, 0.5, 6, u.team === 'player' ? FX.rally : FX.shieldEnemy, 0.5, 0.6);
        else if (e.action === 'summon') this.effects.ring(u.pos.x, u.pos.z, 0.8, 8, u.classId === 'sumpfhexe' ? FX.poison : FX.warningRim, 0.7, 0.6);
        else if (e.action === 'mend') this.effects.ring(u.pos.x, u.pos.z, 0.5, BOSS_ACTIONS.mend.radius, FX.poison, 0.9, 0.5);
        else if (e.action === 'raise') this.effects.ring(u.pos.x, u.pos.z, 0.8, 10, FX.boneGlow, 0.9, 0.6);
        break;
      }
      case 'swing': {
        const u = this.unit(e.unitId);
        if (!u) break;
        const attack = u.isHero ? heroAttack(e.chain) : meleeAttackOf(u); // swing events are melee only
        this.effects.swingArc(u.pos.x, u.pos.z, u.facing, attack.reach, attack.arc, attack.heavy);
        break;
      }
      case 'dodge': {
        const u = this.unit(e.unitId);
        if (u) this.fx.dust(u.pos.x, u.pos.z, 6);
        break;
      }
      case 'death': {
        const u = this.unit(e.unitId);
        if (u) this.fx.dust(u.pos.x, u.pos.z, 14);
        break;
      }
      case 'release': {
        // Placeholder look until 2d: melee abilities reuse the swing arc, the leap kicks up dust.
        const u = this.unit(e.unitId);
        if (!u) break;
        if (e.action === 'schildstoss' || e.action === 'wirbel') {
          const a = HERO_ABILITIES[e.action];
          this.effects.swingArc(u.pos.x, u.pos.z, u.facing, a.reach, a.arc, true);
        } else if (e.action === 'rueckzug') {
          this.fx.dust(u.pos.x, u.pos.z, 8);
        } else if (e.action === 'heilkreis') {
          this.fx.holyLight(new THREE.Vector3(u.pos.x, 0, u.pos.z));
        } else if (e.action === 'sammeln') {
          this.effects.ring(u.pos.x, u.pos.z, 0.5, 9, FX.rally, 0.8, 0.9);
        }
        break;
      }
      case 'outcome':
        this.hud.outcome = e.outcome;
        this.hud.ledger = this.ledgerRows();
        this.hud.phase = 'ended';
        if (this.kbm.locked) document.exitPointerLock();
        break;
      case 'countdown':
      case 'attackStart':
      case 'evade':
      // Projectiles and area circles are drawn from the battle state; lock and mark too.
      case 'shoot':
      case 'areaStart':
      case 'lock':
      case 'mark':
        break;
    }
  }

  private barY(id: number): number {
    return this.units.get(id)?.view.barY ?? 2.15;
  }

  /** Numbers for a hit: cream when the squad deals it, red when the squad takes it. */
  private hitNumbers(target: Unit, attacker: Unit | undefined, amount: number, absorbed: number, heavy: boolean): void {
    const y = this.barY(target.id) + 0.1;
    const kind = target.team === 'player' ? 'taken' : 'dealt';
    const size = (heavy ? 1.3 : 1) * (attacker?.isHero || target.isHero ? 1.2 : 0.9);
    this.numbers.spawn(kind, amount, target.pos.x, y, target.pos.z, size);
    if (absorbed > 0) this.numbers.spawn('absorbed', absorbed, target.pos.x + 0.3, y + 0.35, target.pos.z, 1);
  }

  /** The blade leaves a ribbon while it moves fast in an attack (windup end and recover). */
  private updateTrail(slot: UnitSlot, u: Unit, animTime: number): void {
    if (!slot.trail || !slot.view.weaponEdge?.(_base, _tip)) return;
    const speed = animTime > 0 ? _tip.distanceTo(slot.tipPrev) / animTime : 0;
    slot.tipPrev.copy(_tip);
    const attacking = u.state === 'windup' || u.state === 'recover';
    if (animTime > 0) slot.trail.update(animTime, attacking && speed > TRAIL_SPEED, _base, _tip);
  }

  private areaBurst(kind: AreaKind, x: number, z: number, radius: number, angle: number): void {
    switch (kind) {
      case 'sweep':
        this.effects.swingArc(x, z, angle, radius, BOSS_ACTIONS.sweep.arc, true);
        this.fx.dust(x + Math.sin(angle) * radius * 0.6, z - Math.cos(angle) * radius * 0.6, 10);
        this.rig.shake(0.15);
        break;
      case 'slam':
        this.effects.burst(x, 0.2, z, ['#8a8178', '#a39a90', '#6f6a5f'], 18, radius * 1.6, 0.14, 0.6);
        this.effects.ring(x, z, radius * 0.3, radius, FX.warningRim, 0.4);
        this.fx.dust(x, z, 8);
        this.rig.shake(0.2);
        break;
      case 'poison':
        this.effects.burst(x, 0.3, z, [FX.poison, FX.poisonCore, FX.poisonRim], 22, radius * 1.3, 0.1, 0.6, 2);
        this.effects.rise(x, z, radius, [FX.poison, FX.poisonRim], 8);
        break;
      case 'charge':
        break;
      case 'fireball':
        this.fx.fireBlast(x, z, radius);
        this.effects.ring(x, z, radius * 0.3, radius, FX.fire, 0.4);
        this.rig.shake(0.18);
        break;
      case 'frostNova':
      case 'frostring':
        this.fx.frostRing(new THREE.Vector3(x, 0, z), radius);
        break;
      case 'heilkreis':
        this.effects.rise(x, z, radius, [FX.heal, FX.healCore], 10);
        break;
    }
  }

  private render(alpha: number, frameTime: number): void {
    // While paused the sim is frozen, so hold the interpolation where it stopped.
    const a = this.hud.phase === 'playing' || this.hud.phase === 'ended' ? alpha : 1;
    const animTime = this.hud.phase === 'paused' || this.hud.phase === 'intro' ? 0 : frameTime;
    let heroPos = { x: 0, z: 0 };
    for (const u of this.battle.units) {
      const slot = this.units.get(u.id);
      if (!slot) continue;
      const x = lerp(slot.prev.x, u.pos.x, a);
      const z = lerp(slot.prev.z, u.pos.z, a);
      slot.view.setPose(x, z, lerpAngle(slot.prev.facing, u.facing, a));
      // A charging boss kicks up dust along its run.
      if (animTime > 0 && u.action === 'charge' && u.state === 'recover' && u.stateTime <= BOSS_ACTIONS.charge.dash) this.fx.dust(x, z, 2);
      slot.view.animate(
        { state: u.state, stateTime: u.stateTime, chain: u.chain, stunDuration: u.stunDuration, isHero: u.isHero, action: u.action, ...actionTiming(u), speed: slot.speed, frozen: hasStatus(u, 'frozen'), shielded: hasStatus(u, 'shielded'), dodgeBack: Math.abs(angleDiff(u.facing, u.dodgeAngle)) > Math.PI / 2 },
        animTime,
      );
      if (slot.trail) this.updateTrail(slot, u, animTime);
      if (slot.bar) {
        slot.bar.group.visible = u.state !== 'dead';
        slot.bar.update(x, slot.view.barY, z, u.hp / u.stats.maxHp, this.rig.camera, frameTime);
      }
      if (u.isHero) heroPos = { x, z };
      if (u.id === this.battle.lockTargetId) this.lockRing.update(x, z, u.state !== 'dead', animTime);
      if (u.id === this.battle.markTargetId) this.markBanner.update(x, slot.view.barY + 0.2, z, u.state !== 'dead', this.rig.camera, animTime);
    }
    if (this.battle.lockTargetId === null) this.lockRing.update(0, 0, false, 0);
    if (this.battle.markTargetId === null) this.markBanner.update(0, 0, 0, false, this.rig.camera, 0);
    this.projectiles.sync(this.battle, a, animTime);
    this.areas.sync(this.battle, animTime);
    const hero = heroOf(this.battle);
    const lock = this.battle.units.find((u) => u.id === this.battle.lockTargetId);
    if (hero && lock && this.hud.phase === 'playing') this.rig.steerYaw(angleTo(hero.pos, lock.pos), frameTime);
    this.rig.update(heroPos, frameTime);
    this.effects.update(animTime);
    this.fx.update(animTime);
    this.arena.update(frameTime);
    this.post.render(frameTime);
    this.numbers.update(this.rig.camera, this.canvas.clientWidth, this.canvas.clientHeight, animTime);
    this.updateHud();
  }

  private updateHud(): void {
    const b = this.battle;
    const hero = heroOf(b);
    const h = this.hud;
    h.countdown = Math.ceil(b.countdown);
    h.heroHp = hero ? Math.ceil(hero.hp) : 0;
    h.heroMaxHp = hero ? Math.ceil(hero.stats.maxHp) : 1;
    h.dodgeReady = hero ? 1 - hero.dodgeCooldown / HERO.dodge.cooldown : 0;
    h.foes = b.units.filter((u) => u.team === 'enemy' && u.state !== 'dead').length;
    h.time = Math.max(0, b.tick * DT - COUNTDOWN);
    if (hero) {
      h.energy = Math.floor(hero.energy);
      for (const a of h.abilities) {
        const def = HERO_ABILITIES[a.id];
        a.cooldown = Math.max(0, hero.abilityCooldowns[a.id] ?? 0);
        a.cooldownFrac = Math.min(1, a.cooldown / (def.cooldown * hero.mods.cooldown));
        a.affordable = hero.energy >= def.cost;
        a.active = hero.action === a.id && (hero.state === 'windup' || hero.state === 'recover');
      }
    }
    if (h.boss) {
      const u = this.unit(h.boss.id);
      if (u) {
        h.boss.hp = Math.max(0, Math.ceil(u.hp));
        h.boss.dead = u.state === 'dead';
      }
    }
    for (const c of h.squad) {
      const u = this.unit(c.id);
      if (!u) continue;
      c.hp = Math.max(0, Math.ceil(u.hp));
      c.dead = u.state === 'dead';
    }
    this.updateEdgeMarkers();
  }

  /** Arrows at the screen edge for companions under 30 % health and the marked enemy when off screen. */
  private updateEdgeMarkers(): void {
    const w = this.canvas.clientWidth;
    const hgt = this.canvas.clientHeight;
    const markers: HudEdgeMarker[] = [];
    const playing = this.hud.phase === 'playing';
    for (const u of this.battle.units) {
      if (!playing || u.state === 'dead' || u.isHero) continue;
      const danger = u.team === 'player' && u.hp / u.stats.maxHp < EDGE.danger;
      const mark = u.id === this.battle.markTargetId;
      if (!danger && !mark) continue;
      const slot = this.units.get(u.id);
      if (!slot) continue;
      const p = this.edgePoint(slot.view.root.position.x, slot.view.barY * 0.6, slot.view.root.position.z, w, hgt);
      if (p) markers.push({ kind: mark ? 'mark' : 'ally', id: u.id, classId: u.classId, ...p });
    }
    // Only replace the list when something changed, so Vue does not re-render every frame for nothing.
    const old = this.hud.edgeMarkers;
    const same = old.length === markers.length && old.every((m, i) => {
      const n = markers[i];
      return n !== undefined && m.id === n.id && m.kind === n.kind && Math.abs(m.x - n.x) < 0.5 && Math.abs(m.y - n.y) < 0.5;
    });
    if (!same) this.hud.edgeMarkers = markers;
  }

  /** Where a world point off screen sits on the screen edge, or null when it is on screen. */
  private edgePoint(x: number, y: number, z: number, w: number, h: number): { x: number; y: number; angle: number } | null {
    _edge.set(x, y, z).applyMatrix4(this.rig.camera.matrixWorldInverse);
    const behind = _edge.z > 0;
    _edge.applyMatrix4(this.rig.camera.projectionMatrix);
    let nx = _edge.x;
    let ny = _edge.y;
    if (behind) {
      nx = -nx;
      ny = -ny;
    }
    if (!behind && Math.abs(nx) < 1 && Math.abs(ny) < 1) return null;
    // Screen-space direction from the centre (y down), clamped to an inset rectangle.
    const dx = nx * (w / 2);
    const dy = -ny * (h / 2);
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return { x: w / 2, y: h - EDGE.bottom, angle: Math.PI / 2 };
    // Scale the direction until it meets the inset rectangle.
    const hx = w / 2 - EDGE.side;
    const reachY = dy > 0 ? h / 2 - EDGE.bottom : h / 2 - EDGE.top;
    const s = Math.min(hx / Math.max(Math.abs(dx), 1e-6), Math.max(reachY, 1) / Math.max(Math.abs(dy), 1e-6));
    return { x: w / 2 + dx * s, y: h / 2 + dy * s, angle: Math.atan2(dy, dx) };
  }

  private countFps(frameTime: number): void {
    this.fpsFrames++;
    this.fpsTime += frameTime;
    if (this.fpsTime >= 0.5) {
      this.debug.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.debug.tick = this.battle.tick;
      this.debug.units = this.battle.units.length;
      this.debug.zoom = Math.round(this.rig.zoomLevel * 100) / 100;
      this.debug.lock = this.battle.lockTargetId;
      this.debug.mark = this.battle.markTargetId;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.parts.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.rig.setAspect(w / h);
  }
}
