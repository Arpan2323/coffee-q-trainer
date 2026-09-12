import { PROFILES, type ProfileSet } from '../domain/profiles.js';
import { ROAST_TRENDS, type RoastTrendSet } from '../domain/roastTrends.js';
import type { CoffeeProfile, TrendDirection } from '../domain/schema.js';
import type { Wheel } from '../domain/types.js';
import { WHEEL } from '../domain/wheel.js';
import { mulberry32, sampleWithoutReplacement } from './round.js';

/**
 * Cause & Effect, Perturbation (PLAN.md section 3.2, mode 3): "same coffee, roasted further into
 * development - which wedges move?" One coffee profile grounds each hole, but the question asked -
 * and its answer key - is the same nine-category roast-trend table every time, on purpose: the
 * lesson is that the physics is coffee-invariant, not a fact about any one cup. Reusing the existing
 * synthetic profiles for grounding, rather than inventing a fourth content shape, keeps Cause & Effect
 * to two authored content assets (profiles, roast trends) instead of three.
 *
 * Every hole asks about all nine categories - there are only nine ground-truth facts to learn, so
 * unlike Forward/Reverse there is no meaningful pool to sample a subset from.
 */

export const PERTURBATION_ID = 'cause-effect-perturbation';
export const PERTURBATION_HOLES = 3;

export interface PerturbationGuess {
  readonly categoryId: string;
  readonly guess: TrendDirection | null;
  readonly correct: boolean | null;
}

export interface PerturbationHole {
  readonly profileId: string;
  /** One entry per ring-1 category, in wheel order. */
  readonly guesses: readonly PerturbationGuess[];
  readonly submitted: boolean;
}

export interface PerturbationRound {
  readonly id: typeof PERTURBATION_ID;
  readonly holes: readonly PerturbationHole[];
  readonly current: number;
  readonly complete: boolean;
}

export interface PerturbationOptions {
  readonly seed?: number;
  readonly weights?: ReadonlyMap<string, number>;
}

export function perturbationPool(profiles: ProfileSet = PROFILES): string[] {
  return [...profiles.byId.keys()];
}

export function createPerturbationRound(
  options: PerturbationOptions = {},
  wheel: Wheel = WHEEL,
  profiles: ProfileSet = PROFILES,
): PerturbationRound {
  const pool = perturbationPool(profiles);
  if (pool.length === 0) {
    throw new Error('no coffee profiles to draw a Perturbation round from');
  }

  const holesCount = Math.min(PERTURBATION_HOLES, pool.length);
  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const profileIds = sampleWithoutReplacement(pool, holesCount, random, options.weights);

  const holes = profileIds.map<PerturbationHole>((profileId) => ({
    profileId,
    guesses: wheel.categoryOrder.map((categoryId) => ({ categoryId, guess: null, correct: null })),
    submitted: false,
  }));

  return { id: PERTURBATION_ID, holes, current: 0, complete: holes.length === 0 };
}

export function nextPerturbationRound(
  weightsFor: (candidates: readonly string[]) => ReadonlyMap<string, number>,
  options: PerturbationOptions = {},
  wheel: Wheel = WHEEL,
  profiles: ProfileSet = PROFILES,
): PerturbationRound {
  return createPerturbationRound(
    { ...options, weights: weightsFor(perturbationPool(profiles)) },
    wheel,
    profiles,
  );
}

/** Set (or change) the guess for one category on the current, not-yet-submitted hole. */
export function guessCategory(
  round: PerturbationRound,
  categoryId: string,
  direction: TrendDirection,
): PerturbationRound {
  if (round.complete) throw new Error('round is already complete');
  const hole = round.holes[round.current];
  if (!hole) throw new Error('no hole at the current index');
  if (hole.submitted) throw new Error('hole has already been submitted');

  const guesses = hole.guesses.map((g) =>
    g.categoryId === categoryId ? { ...g, guess: direction } : g,
  );
  const holes = round.holes.map((h, i) => (i === round.current ? { ...h, guesses } : h));
  return { ...round, holes };
}

/** Every category needs a guess before a hole can be submitted - see `isHoleReady`. */
export function isHoleReady(hole: PerturbationHole): boolean {
  return hole.guesses.every((g) => g.guess !== null);
}

export function submitHole(
  round: PerturbationRound,
  trends: RoastTrendSet = ROAST_TRENDS,
): PerturbationRound {
  if (round.complete) throw new Error('round is already complete');
  const hole = round.holes[round.current];
  if (!hole) throw new Error('no hole at the current index');
  if (hole.submitted) throw new Error('hole has already been submitted');
  if (!isHoleReady(hole)) throw new Error('every category needs a guess before submitting');

  const guesses = hole.guesses.map((g) => {
    const trend = trends.byCategory.get(g.categoryId);
    if (!trend) throw new Error(`no roast trend for "${g.categoryId}"`);
    return { ...g, correct: g.guess === trend.direction };
  });

  const holes = round.holes.map((h, i) => (i === round.current ? { ...h, guesses, submitted: true } : h));
  const current = round.current + 1;
  return { ...round, holes, current, complete: current >= holes.length };
}

export interface PerturbationSummary {
  readonly answered: number;
  readonly correct: number;
  readonly total: number;
}

export function perturbationSummary(round: PerturbationRound): PerturbationSummary {
  const guesses = round.holes.flatMap((h) => h.guesses);
  const answered = guesses.filter((g) => g.correct !== null);
  return {
    answered: answered.length,
    correct: answered.filter((g) => g.correct === true).length,
    total: guesses.length,
  };
}

/** Light-to-dark roast ladder. "Roasted further" moves one step; `dark` has nowhere further to go. */
const ROAST_LADDER: readonly CoffeeProfile['roast'][] = ['light', 'medium', 'medium-dark', 'dark'];

export function furtherRoast(roast: CoffeeProfile['roast']): CoffeeProfile['roast'] | null {
  const i = ROAST_LADDER.indexOf(roast);
  return i === -1 || i === ROAST_LADDER.length - 1 ? null : ROAST_LADDER[i + 1]!;
}
