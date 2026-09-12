import { PROFILES, type ProfileSet } from '../domain/profiles.js';
import type { Process } from '../domain/schema.js';
import { mulberry32, sampleWithoutReplacement } from './round.js';

/**
 * Cause & Effect, reverse direction (PLAN.md section 3.2, mode 3): given the effect - a cup's
 * descriptors, origin, variety and roast - deduce the cause. Scoped down from PLAN's narrative
 * example (which also deduces origin and a specific drying story) to the one well-posed,
 * closed-answer question in it: which process produced this cup. `CoffeeProfile.process` is a fixed
 * five-value enum, which is exactly what a multiple-choice reverse question needs and what an
 * open-ended origin guess is not.
 *
 * Scoring is binary, not wheel-distance. Processes have no tree position and no authored confusable
 * table between them - inventing a partial-credit distance between "honey" and "natural" would be
 * guessing at a perceptual model the same way uniform category gaps already are (see the Maillard
 * cluster note in README.md), and this project's rule is not to invent numbers it cannot defend.
 */

export const CAUSE_EFFECT_REVERSE_ID = 'cause-effect-reverse';
export const REVERSE_HOLES = 5;

export interface ReverseHole {
  readonly profileId: string;
  readonly answer: Process | null;
  readonly correct: boolean | null;
}

export interface ReverseRound {
  readonly id: typeof CAUSE_EFFECT_REVERSE_ID;
  readonly holes: readonly ReverseHole[];
  readonly current: number;
  readonly complete: boolean;
}

export interface ReverseOptions {
  readonly seed?: number;
  readonly weights?: ReadonlyMap<string, number>;
}

export function reversePool(profiles: ProfileSet = PROFILES): string[] {
  return [...profiles.byId.keys()];
}

export function createReverseRound(
  options: ReverseOptions = {},
  profiles: ProfileSet = PROFILES,
): ReverseRound {
  const pool = reversePool(profiles);
  if (pool.length === 0) {
    throw new Error('no coffee profiles to draw a Cause & Effect Reverse round from');
  }

  const holesCount = Math.min(REVERSE_HOLES, pool.length);
  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const profileIds = sampleWithoutReplacement(pool, holesCount, random, options.weights);

  const holes = profileIds.map<ReverseHole>((profileId) => ({
    profileId,
    answer: null,
    correct: null,
  }));

  return { id: CAUSE_EFFECT_REVERSE_ID, holes, current: 0, complete: holes.length === 0 };
}

export function nextReverseRound(
  weightsFor: (candidates: readonly string[]) => ReadonlyMap<string, number>,
  options: ReverseOptions = {},
  profiles: ProfileSet = PROFILES,
): ReverseRound {
  return createReverseRound({ ...options, weights: weightsFor(reversePool(profiles)) }, profiles);
}

export function answerReverseHole(
  round: ReverseRound,
  guess: Process,
  profiles: ProfileSet = PROFILES,
): ReverseRound {
  if (round.complete) throw new Error('round is already complete');
  const hole = round.holes[round.current];
  if (!hole) throw new Error('no hole at the current index');
  if (hole.answer !== null) throw new Error('hole has already been answered');

  const profile = profiles.byId.get(hole.profileId);
  if (!profile) throw new Error(`unknown profile "${hole.profileId}"`);

  const correct = profile.process === guess;
  const holes = round.holes.map((h, i) => (i === round.current ? { ...h, answer: guess, correct } : h));
  const current = round.current + 1;

  return { ...round, holes, current, complete: current >= holes.length };
}

export interface ReverseSummary {
  readonly answered: number;
  readonly correct: number;
  readonly total: number;
}

export function reverseSummary(round: ReverseRound): ReverseSummary {
  const answered = round.holes.filter((h) => h.correct !== null);
  return {
    answered: answered.length,
    correct: answered.filter((h) => h.correct === true).length,
    total: round.holes.length,
  };
}
