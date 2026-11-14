import type { ClassId, Team } from '../sim/types';
import { ENEMY_COLORS, PLAYER_COLORS } from './palette';
import { PrimitiveFigureView, type UnitView } from './unitView';
import { WolfView } from './wolfView';

/** The view for a unit: a primitive figure in its team's colours, or a wolf. */
export function createUnitView(classId: ClassId, team: Team, hero: boolean): UnitView {
  if (classId === 'wolf') return new WolfView();
  return new PrimitiveFigureView(classId, team === 'player' ? PLAYER_COLORS : ENEMY_COLORS, team, hero);
}
