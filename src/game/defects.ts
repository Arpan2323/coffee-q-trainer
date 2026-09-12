import { ATTRIBUTES } from '../domain/attributes.js';
import type { Wheel } from '../domain/types.js';
import { getNode } from '../domain/wheel.js';
import { DEFAULT_DEPS, buildRound, type Round, type RoundDeps, type RoundOptions } from './round.js';

/**
 * Defect Lab. A round drawn from the fault-flagged attributes rather than a belt's category. Every
 * defect node sits at ring 3, so the target is the attribute itself - this is a pure identification
 * drill, and the teaching is in the reveal: whether the note is always a fault or only a fault in
 * context. Beginners routinely read every ferment or woody note as a flaw; a natural can be
 * intentionally funky and a light smoke can be a house style, and the mode exists to say so.
 */

export const DEFECT_LAB_ID = 'defect-lab';
export const DEFECT_TARGET_RING = 3;
export const DEFECT_LAB_HOLES = 6;

export type DefectKind = 'fault' | 'contextual';

export function defectKind(wheel: Wheel, nodeId: string): DefectKind | null {
  const flag = getNode(wheel, nodeId).defect;
  return flag === true ? 'fault' : flag === 'contextual' ? 'contextual' : null;
}

/** Fault-flagged attributes that have a written record, so a clue exists. */
export function defectPool(deps: RoundDeps = DEFAULT_DEPS): string[] {
  return [...ATTRIBUTES.byNode.keys()].filter((id) => getNode(deps.wheel, id).defect !== null);
}

export function createDefectRound(options: RoundOptions = {}, deps: RoundDeps = DEFAULT_DEPS): Round {
  return buildRound(
    DEFECT_LAB_ID,
    defectPool(deps),
    DEFECT_TARGET_RING,
    DEFECT_LAB_HOLES,
    options,
    deps,
  );
}

/** As `nextRound` is to belts: past performance biases which defects come round next. */
export function nextDefectRound(
  weightsFor: (candidates: readonly string[]) => ReadonlyMap<string, number>,
  options: RoundOptions = {},
  deps: RoundDeps = DEFAULT_DEPS,
): Round {
  return createDefectRound({ ...options, weights: weightsFor(defectPool(deps)) }, deps);
}
