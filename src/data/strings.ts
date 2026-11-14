/** Every interface string. English (approved 2026-11-14). */
export const STRINGS = {
  title: 'Heerschar',
  classes: {
    krieger: 'Warrior',
    bogenschuetze: 'Archer',
    heiler: 'Healer',
    magier: 'Mage',
  },
  trial: {
    name: 'The Trial',
    intro: 'Three raiders wait across the field. Show them what a warrior can do.',
    begin: 'Click to take the field',
    controls: [
      ['W A S D', 'Move'],
      ['Mouse', 'Turn the camera'],
      ['Left click', 'Strike (click again for a second, heavier blow)'],
      ['Space', 'Dodge'],
      ['Wheel', 'Zoom'],
      ['Esc', 'Pause'],
    ],
  },
  paused: 'Paused',
  resume: 'Click to resume',
  restart: 'Fight again',
  restartHint: 'or press Enter',
  victory: 'Victory',
  victoryText: 'The raiders lie in the dust.',
  defeat: 'Defeat',
  defeatText: 'You have fallen. The raiders stand.',
  foes: 'Foes',
  dodge: 'Dodge',
  time: 'Time',
} as const;
