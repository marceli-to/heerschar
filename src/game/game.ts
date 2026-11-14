import * as THREE from 'three';
import { reactive } from 'vue';
import { createBattle, heroOf, step } from '../sim/battle';
import { COUNTDOWN, DT, ENEMY, HERO, HERO_ABILITIES, heroAttack } from '../sim/balance';
import { actionTiming } from '../sim/ai';
import { heroKit } from '../sim/heroAbilities';
import { angleTo, lerp, lerpAngle } from '../sim/math';
import type { Battle, BattleEvent, ClassId, Unit } from '../sim/types';
import { trialSetup } from '../data/encounters';
import { botInput, createBot, type BotState } from '../sim/bot';
import { KeyboardMouse } from '../input/keyboardMouse';
import { HeroInputSampler } from '../input/heroInput';
import { createScene, type SceneParts } from '../view/scene';
import { createArena } from '../view/arena';
import { CameraRig } from '../view/camera';
import { Effects } from '../view/effects';
import { HealthBar } from '../view/markers';
import { ENEMY_COLORS, PLAYER_COLORS } from '../view/palette';
import { PrimitiveWarriorView, type UnitView } from '../view/unitView';
import { startLoop, type RunningLoop } from './loop';

export interface DebugStats {
  visible: boolean;
  fps: number;
  tick: number;
  units: number;
  zoom: number;
  /** Hero kit readout until the 2e HUD: energy, Q/E/R as "name cooldown", lock and mark ids. */
  energy: number;
  abilities: string;
  lock: number | null;
  mark: number | null;
}

export type Phase = 'intro' | 'playing' | 'paused' | 'ended';

export interface HudState {
  phase: Phase;
  /** Whole seconds left in the countdown, 0 once the fight runs. */
  countdown: number;
  heroHp: number;
  heroMaxHp: number;
  /** 0..1, 1 = dodge ready. */
  dodgeReady: number;
  foes: number;
  outcome: 'running' | 'won' | 'lost';
  /** Seconds since the countdown ended. */
  time: number;
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
}

const SHAKE = { heroHit: 0.45, heavy: 0.32, light: 0.14 } as const;

/** Glue between simulation, input and view. Owns the loop. */
export class Game {
  readonly debug: DebugStats;
  readonly hud: HudState;
  private battle: Battle;
  private seed: number;
  private heroClass: ClassId;
  private parts: SceneParts;
  private rig: CameraRig;
  private kbm: KeyboardMouse;
  private heroInput: HeroInputSampler;
  private effects = new Effects();
  private units = new Map<number, UnitSlot>();
  private unitLayer = new THREE.Group();
  private loop: RunningLoop | null = null;
  private fpsFrames = 0;
  private fpsTime = 0;
  private resizeObserver: ResizeObserver;
  /** Debug: when set, the scripted bot plays the hero (`?bot`). */
  bot: BotState | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, opts: { seed: number; zoom?: number; debug?: boolean; heroClass?: ClassId }) {
    this.seed = opts.seed;
    this.heroClass = opts.heroClass ?? 'krieger';
    this.battle = createBattle(trialSetup(this.seed, this.heroClass));
    this.parts = createScene(canvas);
    this.parts.scene.add(createArena(this.battle.arena.width, this.battle.arena.depth), this.unitLayer, this.effects.group);
    this.rig = new CameraRig(1, opts.zoom ?? 0.25);
    this.kbm = new KeyboardMouse(canvas);
    this.heroInput = new HeroInputSampler(this.kbm);
    this.debug = reactive({ visible: opts.debug ?? false, fps: 0, tick: 0, units: 0, zoom: this.rig.zoomLevel, energy: 0, abilities: '', lock: null, mark: null });
    this.hud = reactive({ phase: 'intro', countdown: 0, heroHp: 0, heroMaxHp: 1, dodgeReady: 1, foes: 0, outcome: 'running', time: 0 });
    this.buildUnits();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener('pointerlockchange', this.onLockChange);
    this.resize();
  }

  start(): void {
    this.loop = startLoop(DT, {
      frameStart: (frameTime) => this.frameStart(frameTime),
      tick: () => this.tick(),
      render: (alpha, frameTime) => this.render(alpha, frameTime),
    });
  }

  /** Starts a fresh trial. Called from the end screen. */
  restart(): void {
    this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    this.battle = createBattle(trialSetup(this.seed, this.heroClass));
    this.buildUnits();
    this.heroInput.clear();
    if (this.bot) this.bot = createBot();
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
    this.parts.renderer.dispose();
  }

  private onLockChange = (): void => {
    if (this.hud.phase === 'ended' || this.bot) return;
    if (this.kbm.locked) this.hud.phase = 'playing';
    else if (this.hud.phase === 'playing') this.hud.phase = 'paused';
  };

  private buildUnits(): void {
    for (const slot of this.units.values()) this.disposeSlot(slot);
    this.units.clear();
    for (const u of this.battle.units) {
      const view = new PrimitiveWarriorView(u.team === 'player' ? PLAYER_COLORS : ENEMY_COLORS, u.isHero);
      const bar = u.isHero ? null : new HealthBar(u.team === 'player' ? '#d9a33a' : '#b8382a');
      this.unitLayer.add(view.root);
      if (bar) this.unitLayer.add(bar.group);
      this.units.set(u.id, { view, bar, prev: { x: u.pos.x, z: u.pos.z, facing: u.facing }, speed: 0 });
    }
    // Start behind the hero, looking across the field at the enemy.
    const hero = heroOf(this.battle);
    if (hero) this.rig.yaw = hero.facing;
  }

  private disposeSlot(slot: UnitSlot): void {
    this.unitLayer.remove(slot.view.root);
    slot.view.dispose();
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
    const input = this.bot ? botInput(this.battle, this.bot) : this.heroInput.sample(this.rig.yaw);
    const events = step(this.battle, input, DT);
    for (const u of this.battle.units) {
      const slot = this.units.get(u.id);
      if (!slot) continue;
      const v = Math.hypot(u.pos.x - slot.prev.x, u.pos.z - slot.prev.z) / DT;
      slot.speed += (v - slot.speed) * 0.25;
    }
    for (const e of events) this.onEvent(e);
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
          this.effects.hit(e.x, e.z, dx / len, dz / len, e.heavy);
          this.rig.shake(target.isHero ? SHAKE.heroHit : e.heavy ? SHAKE.heavy : SHAKE.light);
        }
        break;
      }
      case 'swing': {
        const u = this.unit(e.unitId);
        if (!u) break;
        const attack = u.isHero ? heroAttack(e.chain) : ENEMY.attack; // swing events are melee only
        this.effects.swingArc(u.pos.x, u.pos.z, u.facing, attack.reach, attack.arc, attack.heavy);
        break;
      }
      case 'dodge': {
        const u = this.unit(e.unitId);
        if (u) this.effects.dust(u.pos.x, u.pos.z, 6);
        break;
      }
      case 'death': {
        const u = this.unit(e.unitId);
        if (u) this.effects.dust(u.pos.x, u.pos.z, 14);
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
          this.effects.dust(u.pos.x, u.pos.z, 8);
        }
        break;
      }
      case 'outcome':
        this.hud.outcome = e.outcome;
        this.hud.phase = 'ended';
        if (this.kbm.locked) document.exitPointerLock();
        break;
      case 'countdown':
      case 'attackStart':
      case 'evade':
      // Visuals for these arrive in Stage 2d.
      case 'heal':
      case 'action':
      case 'shoot':
      case 'areaStart':
      case 'areaResolve':
      case 'status':
      case 'lock':
      case 'mark':
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
      slot.view.animate({ state: u.state, stateTime: u.stateTime, chain: u.chain, stunDuration: u.stunDuration, isHero: u.isHero, action: u.action, ...actionTiming(u), speed: slot.speed }, animTime);
      if (slot.bar) {
        slot.bar.group.visible = u.state !== 'dead';
        slot.bar.update(x, 2.15, z, u.hp / u.stats.maxHp, this.rig.camera, frameTime);
      }
      if (u.isHero) heroPos = { x, z };
    }
    const hero = heroOf(this.battle);
    const lock = this.battle.units.find((u) => u.id === this.battle.lockTargetId);
    if (hero && lock && this.hud.phase === 'playing') this.rig.steerYaw(angleTo(hero.pos, lock.pos), frameTime);
    this.rig.update(heroPos, frameTime);
    this.effects.update(animTime);
    this.parts.renderer.render(this.parts.scene, this.rig.camera);
    this.updateHud();
  }

  private updateHud(): void {
    const b = this.battle;
    const hero = heroOf(b);
    const h = this.hud;
    h.countdown = Math.ceil(b.countdown);
    h.heroHp = hero ? Math.ceil(hero.hp) : 0;
    h.heroMaxHp = hero?.stats.maxHp ?? 1;
    h.dodgeReady = hero ? 1 - hero.dodgeCooldown / HERO.dodge.cooldown : 0;
    h.foes = b.units.filter((u) => u.team === 'enemy' && u.state !== 'dead').length;
    h.time = Math.max(0, b.tick * DT - COUNTDOWN);
  }

  private countFps(frameTime: number): void {
    this.fpsFrames++;
    this.fpsTime += frameTime;
    if (this.fpsTime >= 0.5) {
      this.debug.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.debug.tick = this.battle.tick;
      this.debug.units = this.battle.units.length;
      this.debug.zoom = Math.round(this.rig.zoomLevel * 100) / 100;
      const hero = heroOf(this.battle);
      if (hero) {
        const kit = heroKit(hero);
        this.debug.energy = Math.floor(hero.energy);
        this.debug.abilities = [kit.ability1, kit.ability2, kit.leader].map((id) => `${id} ${(hero.abilityCooldowns[id] ?? 0).toFixed(1)}`).join(' · ');
      }
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
    this.rig.setAspect(w / h);
  }
}
