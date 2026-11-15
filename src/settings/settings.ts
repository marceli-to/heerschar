/**
 * Player settings (6g): volumes, key bindings, camera speeds, graphics quality. Pure data and rules;
 * `store.ts` keeps the live copy and saves it. Settings live in their own `localStorage` key, apart
 * from the game save, so they survive a new game.
 *
 * Bindings are `KeyboardEvent.code` strings (`KeyQ`, `Space`, …) or `Mouse<n>` for mouse buttons.
 */

export const ACTIONS = ['forward', 'back', 'left', 'right', 'attack', 'dodge', 'ability1', 'ability2', 'leader', 'lock', 'mark'] as const;
export type Action = (typeof ACTIONS)[number];
export type Bindings = Record<Action, string>;

export const QUALITIES = ['low', 'medium', 'high'] as const;
export type Quality = (typeof QUALITIES)[number];

export const VOLUMES = ['master', 'sfx', 'music', 'ui'] as const;
export type VolumeId = (typeof VOLUMES)[number];

export interface Settings {
  version: 1;
  /** 0..100 per bus. */
  volume: Record<VolumeId, number>;
  keys: Bindings;
  /** Multipliers on the mouse turn rate and the wheel zoom step. */
  camera: { turn: number; zoom: number };
  quality: Quality;
}

export const DEFAULT_KEYS: Bindings = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  attack: 'Mouse0',
  dodge: 'Space',
  ability1: 'KeyQ',
  ability2: 'KeyE',
  leader: 'KeyR',
  lock: 'Tab',
  mark: 'KeyF',
};

/** Slider ranges for the camera multipliers. */
export const CAMERA_RANGE = { min: 0.25, max: 3, step: 0.05 } as const;

export function defaultSettings(): Settings {
  return {
    version: 1,
    volume: { master: 80, sfx: 90, music: 50, ui: 70 },
    keys: { ...DEFAULT_KEYS },
    camera: { turn: 1, zoom: 1 },
    quality: 'high',
  };
}

/** Keys that cannot be bound: Escape pauses (the browser releases the pointer) and cancels a rebind. */
export const RESERVED = new Set(['Escape']);

/** Per quality: render scale cap, shadows, bloom, MSAA samples, share of effect particles. */
export const QUALITY_PRESETS: Record<Quality, { pixelRatio: number; shadows: boolean; shadowMap: number; bloom: boolean; samples: number; particles: number }> = {
  low: { pixelRatio: 1, shadows: false, shadowMap: 1024, bloom: false, samples: 0, particles: 0.35 },
  medium: { pixelRatio: 1.25, shadows: true, shadowMap: 1024, bloom: true, samples: 2, particles: 0.65 },
  high: { pixelRatio: 2, shadows: true, shadowMap: 2048, bloom: true, samples: 4, particles: 1 },
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const isBinding = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 32 && !RESERVED.has(v);

/** Reads stored settings; anything missing or broken falls back to the default, duplicate bindings too. */
export function parseSettings(raw: unknown): Settings {
  const s = defaultSettings();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<Record<keyof Settings, unknown>>;
  const vol = (r.volume ?? {}) as Record<string, unknown>;
  for (const k of VOLUMES) s.volume[k] = Math.round(clamp(num(vol[k], s.volume[k]), 0, 100));
  const cam = (r.camera ?? {}) as Record<string, unknown>;
  s.camera.turn = clamp(num(cam['turn'], 1), CAMERA_RANGE.min, CAMERA_RANGE.max);
  s.camera.zoom = clamp(num(cam['zoom'], 1), CAMERA_RANGE.min, CAMERA_RANGE.max);
  if (QUALITIES.includes(r.quality as Quality)) s.quality = r.quality as Quality;
  const keys = (r.keys ?? {}) as Record<string, unknown>;
  const stored: Partial<Bindings> = {};
  for (const a of ACTIONS) if (isBinding(keys[a])) stored[a] = keys[a];
  const merged = { ...s.keys, ...stored };
  // Two actions on one key would make one of them unreachable: drop the whole stored set.
  if (new Set(Object.values(merged)).size === ACTIONS.length) s.keys = merged;
  return s;
}

/**
 * Binds `code` to `action`. If another action had that code, it takes `action`'s old one (a swap),
 * so every action keeps exactly one key. Returns the new bindings (the input is not changed).
 */
export function rebind(keys: Bindings, action: Action, code: string): Bindings {
  if (RESERVED.has(code)) return keys;
  const next = { ...keys };
  const other = ACTIONS.find((a) => a !== action && keys[a] === code);
  if (other) next[other] = keys[action];
  next[action] = code;
  return next;
}

const NAMED: Record<string, string> = {
  Mouse0: 'Left mouse',
  Mouse1: 'Middle mouse',
  Mouse2: 'Right mouse',
  Mouse3: 'Mouse 4',
  Mouse4: 'Mouse 5',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  CapsLock: 'Caps Lock',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  MetaLeft: 'Left Cmd',
  MetaRight: 'Right Cmd',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

/** Short display name of a binding ("Q", "Space", "Left mouse"). */
export function keyLabel(code: string): string {
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  if (/^Mouse\d+$/.test(code)) return `Mouse ${Number(code.slice(5)) + 1}`;
  return code;
}

/** Mouse button → binding code. */
export const mouseCode = (button: number): string => `Mouse${button}`;

const SHORT: Record<string, string> = { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'M4', Mouse4: 'M5', Space: 'Space', CapsLock: 'Caps', Backspace: 'Bksp' };

/** A binding short enough for the corner of an ability tile. */
export function keyShort(code: string): string {
  if (SHORT[code]) return SHORT[code];
  const label = keyLabel(code);
  return label.replace(/^(Left|Right) /, '');
}

/** Rows of the battle intro's controls list: a remappable action group or a fixed control. */
export type ControlRow = 'move' | 'mouse' | 'attack' | 'dodge' | 'abilities' | 'leader' | 'lock' | 'mark' | 'wheel' | 'pause';

/** The key text for a controls row with the current bindings. */
export function controlKeys(row: ControlRow, keys: Bindings): string {
  switch (row) {
    case 'move':
      return [keys.forward, keys.left, keys.back, keys.right].map(keyLabel).join(' ');
    case 'abilities':
      return `${keyLabel(keys.ability1)} · ${keyLabel(keys.ability2)}`;
    case 'mouse':
      return 'Mouse';
    case 'wheel':
      return 'Wheel';
    case 'pause':
      return 'Esc';
    default:
      return keyLabel(keys[row]);
  }
}
