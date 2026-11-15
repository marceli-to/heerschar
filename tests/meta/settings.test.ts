import { describe, expect, it } from 'vitest';
import { ACTIONS, DEFAULT_KEYS, controlKeys, defaultSettings, keyLabel, keyShort, parseSettings, rebind } from '../../src/settings/settings';

describe('settings', () => {
  it('default bindings are the PLAN keys, one key per action', () => {
    expect(DEFAULT_KEYS).toMatchObject({ forward: 'KeyW', attack: 'Mouse0', dodge: 'Space', ability1: 'KeyQ', ability2: 'KeyE', leader: 'KeyR', lock: 'Tab', mark: 'KeyF' });
    expect(new Set(Object.values(DEFAULT_KEYS)).size).toBe(ACTIONS.length);
  });

  it('parse falls back to defaults on garbage', () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings('x')).toEqual(defaultSettings());
    expect(parseSettings({ volume: { master: 'loud' }, quality: 'ultra', camera: { turn: NaN } })).toEqual(defaultSettings());
  });

  it('parse keeps valid values and clamps ranges', () => {
    const s = parseSettings({ volume: { master: 140, music: 12.4 }, camera: { turn: 9, zoom: 0.5 }, quality: 'low', keys: { dodge: 'ShiftLeft' } });
    expect(s.volume).toMatchObject({ master: 100, music: 12, sfx: 90 });
    expect(s.camera).toEqual({ turn: 3, zoom: 0.5 });
    expect(s.quality).toBe('low');
    expect(s.keys.dodge).toBe('ShiftLeft');
    expect(s.keys.attack).toBe('Mouse0');
  });

  it('parse drops stored bindings that collide or use reserved keys', () => {
    expect(parseSettings({ keys: { dodge: 'KeyQ' } }).keys).toEqual(DEFAULT_KEYS);
    expect(parseSettings({ keys: { dodge: 'Escape' } }).keys.dodge).toBe('Space');
  });

  it('rebind swaps with the action that held the key', () => {
    const k = rebind(DEFAULT_KEYS, 'dodge', 'KeyQ');
    expect(k.dodge).toBe('KeyQ');
    expect(k.ability1).toBe('Space');
    expect(new Set(Object.values(k)).size).toBe(ACTIONS.length);
    expect(DEFAULT_KEYS.dodge).toBe('Space');
    expect(rebind(DEFAULT_KEYS, 'dodge', 'Escape')).toBe(DEFAULT_KEYS);
  });

  it('labels', () => {
    expect(keyLabel('KeyQ')).toBe('Q');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('Mouse0')).toBe('Left mouse');
    expect(keyLabel('Mouse7')).toBe('Mouse 8');
    expect(keyShort('Mouse2')).toBe('RMB');
    expect(keyShort('ShiftLeft')).toBe('Shift');
    expect(controlKeys('move', DEFAULT_KEYS)).toBe('W A S D');
    expect(controlKeys('abilities', DEFAULT_KEYS)).toBe('Q · E');
    expect(controlKeys('attack', DEFAULT_KEYS)).toBe('Left mouse');
  });
});
