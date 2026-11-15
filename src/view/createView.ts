import type { ClassId, Team } from '../sim/types';
import { bodyFor, type ViewLook } from './models/bodies';
import { modelsReady } from './models/assets';
import { ModelUnitView } from './models/modelUnitView';
import { ENEMY_COLORS, PLAYER_COLORS } from './palette';
import { PrimitiveFigureView, type UnitView } from './unitView';
import { WolfView } from './wolfView';

/**
 * The view for a unit: its model once the models are loaded (Stage 6), else the code figure in
 * its team's colours (the code wolf for wolves).
 */
export function createUnitView(classId: ClassId, team: Team, hero: boolean, look: ViewLook): UnitView {
  const body = modelsReady() ? bodyFor(classId, team, hero, look) : null;
  if (body) return new ModelUnitView(body, team);
  if (classId === 'wolf') return new WolfView();
  return new PrimitiveFigureView(classId, team === 'player' ? PLAYER_COLORS : ENEMY_COLORS, team, hero);
}
