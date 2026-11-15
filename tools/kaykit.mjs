// Copies the KayKit characters the game uses into public/models/, keeping only the animation
// clips it plays (each pack file ships 76-95 clips, ~4 MB). All characters of a pack share one rig
// and identical clips, so only the first file of each pack keeps them (`ANIM_SOURCE` in
// src/view/models/assets.ts); the others are stripped to meshes. Weapons (.gltf + .bin) are copied as is.
// Usage: node tools/kaykit.mjs <Adventurers repo dir> <Skeletons repo dir>
// (github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 and -Skeletons-1.0, CC0)
import fs from 'node:fs';
import path from 'node:path';
import { readGlb, trim, writeGlb } from './glb.mjs';

const [adv, skel] = process.argv.slice(2);
if (!adv || !skel) throw new Error('usage: node tools/kaykit.mjs <adventurers dir> <skeletons dir>');
const OUT = path.resolve('public/models');

const CLIPS = [
  'Idle', 'Walking_A', 'Running_A', 'Hit_A', 'Hit_B', 'Death_A', 'Dodge_Forward', 'Dodge_Backward', 'Cheer',
  '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Spinning', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Idle', 'Block_Attack',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Spellcasting', 'Spellcast_Summon',
  '2H_Ranged_Aiming', '2H_Ranged_Shoot', 'Taunt',
  'Death_C_Skeletons', 'Spawn_Ground_Skeletons', 'Idle_Combat',
];

const CHARACTERS = [
  [adv, 'addons/kaykit_character_pack_adventures/Characters/gltf', ['Knight', 'Mage', 'Rogue_Hooded', 'Barbarian'], 'kaykit'],
  [skel, 'addons/kaykit_character_pack_skeletons/Characters/gltf', ['Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage'], 'kaykit-skeletons'],
];
const WEAPONS = [
  [skel, 'addons/kaykit_character_pack_skeletons/Assets/gltf', ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Shield_Large_A', 'Skeleton_Shield_Small_A', 'Skeleton_Crossbow', 'Skeleton_Staff'], 'kaykit-skeletons', ['skeleton_texture.png']],
  // Boss weapons (6c): the Iron Warlord's two-handed axe, the Bone King's greatsword.
  [adv, 'addons/kaykit_character_pack_adventures/Assets/gltf', ['axe_2handed', 'sword_2handed'], 'kaykit', ['barbarian_texture.png', 'knight_texture.png']],
];

for (const [root, dir, names, sub] of CHARACTERS) {
  fs.mkdirSync(path.join(OUT, sub), { recursive: true });
  for (const [i, n] of names.entries()) {
    const src = path.join(root, dir, `${n}.glb`);
    const { json, bin } = trim(readGlb(src), i === 0 && CLIPS);
    const dst = path.join(OUT, sub, `${n}.glb`);
    writeGlb(dst, json, bin);
    console.log(`${sub}/${n}.glb`, (fs.statSync(src).size / 1e6).toFixed(2), '->', (fs.statSync(dst).size / 1e6).toFixed(2), 'MB,', json.animations?.length ?? 0, 'clips');
  }
  fs.copyFileSync(path.join(root, 'LICENSE.txt'), path.join(OUT, sub, 'LICENSE.txt'));
}
for (const [root, dir, names, sub, textures] of WEAPONS) {
  for (const n of names) for (const ext of ['gltf', 'bin']) fs.copyFileSync(path.join(root, dir, `${n}.${ext}`), path.join(OUT, sub, `${n}.${ext}`));
  for (const t of textures) fs.copyFileSync(path.join(root, dir, t), path.join(OUT, sub, t));
}
