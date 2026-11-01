import { OBJECTIVES, rotatingGoal, type ObjectiveDef } from '../../data/objectives';
import type { SimEvent } from '../events';
import type { GameState } from '../state';

/** The current objective: the scripted chain, then endless rotating goals. */
export function currentObjective(state: GameState): ObjectiveDef | undefined {
  return OBJECTIVES[state.objectives.index] ?? rotatingGoal(state.objectives.index - OBJECTIVES.length);
}

/**
 * Advances the objective chain from this tick's events. Completing an objective pays its reward and
 * moves on; several can complete in one tick if later ones are already satisfied.
 * Returns true if anything changed.
 */
export function stepObjectives(state: GameState, tickEvents: readonly SimEvent[], events: SimEvent[]): boolean {
  let changed = false;
  let objective = currentObjective(state);
  if (!objective) return false;

  if (objective.counts) {
    for (const e of tickEvents) state.objectives.progress += objective.counts(e);
  }
  while (objective && (state.objectives.progress >= objective.target || objective.done?.(state))) {
    state.money += objective.reward;
    state.earned += objective.reward;
    events.push({ type: 'objectiveDone', objective: objective.id, reward: objective.reward });
    state.objectives.index++;
    state.objectives.progress = 0;
    changed = true;
    objective = currentObjective(state);
  }
  return changed || tickEvents.length > 0;
}
