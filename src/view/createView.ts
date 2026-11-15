import type { ClassId, Team } from '../sim/types';
import { bodyFor, type ViewLook } from './models/bodies';
import { modelsReady } from './models/assets';
import { ModelUnitView } from './models/modelUnitView';
import { ENEMY_COLORS, PLAYER_COLORS } from './palette';
import { PrimitiveFigureView, type UnitView } from './unitView';
import { WolfView } from './wolfView';

/**
 * The view for a unit: a KayKit model once they are loaded (Stage 6), else the code figure in
 * its team's colours; wolves, bosses and the Shaman keep their code figures until 6c.
 */
export function createUnitView(classId: ClassId, team: Team, hero: boolean, look: ViewLook): UnitView {
  if (classId === 'wolf') return new WolfView();
  const body = modelsReady() ? bodyFor(classId, team, hero, look) : null;
  if (body) return new ModelUnitView(body, team);
  return new PrimitiveFigureView(classId, team === 'player' ? PLAYER_COLORS : ENEMY_COLORS, team, hero);
}
