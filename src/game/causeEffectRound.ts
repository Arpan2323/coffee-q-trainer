import { PROFILES, type ProfileSet } from '../domain/profiles.js';
import { scoreAgainstAny, type ScoreResult } from '../domain/scoring.js';
import { DEFAULT_DEPS, mulberry32, sampleWithoutReplacement, type RoundDeps } from './round.js';

/**
 * Cause & Effect, forward direction (PLAN.md section 3.2, mode 3): given a coffee's origin, process
 * and roast, predict where its cup sits on the wheel. Reverse (profile -> deduce process) and
 * Perturbation ("roast 30s longer, which wedges move?") are not built - this is the direction the
 * existing wheel-click UI and `scoreAgainstAny` already fit, and it is enough to put the profiles to
 * work rather than leave them inert data.
 *
 * A profile legitimately carries several defensible descriptors at once, so each hole is scored
 * against the whole set via `scoreAgainstAny` rather than a single target - the same reasoning that
 * function's own docstring gives for coffee profiles specifically.
 */

export const CAUSE_EFFECT_ID = 'cause-effect';
export const CAUSE_EFFECT_HOLES = 5;

export interface CauseEffectHole {
  readonly profileId: string;
  readonly answerId: string | null;
  readonly result: ScoreResult | null;
}

export interface CauseEffectRound {
  readonly id: typeof CAUSE_EFFECT_ID;
  readonly holes: readonly CauseEffectHole[];
  readonly current: number;
  readonly complete: boolean;
}

export interface CauseEffectOptions {
  readonly seed?: number;
  /** Per-profile sampling weights, so spaced repetition can bias toward profiles missed before. */
  readonly weights?: ReadonlyMap<string, number>;
}

export function causeEffectPool(profiles: ProfileSet = PROFILES): string[] {
  return [...profiles.byId.keys()];
}

export function createCauseEffectRound(
  options: CauseEffectOptions = {},
  deps: RoundDeps = DEFAULT_DEPS,
  profiles: ProfileSet = PROFILES,
): CauseEffectRound {
  const pool = causeEffectPool(profiles);
  if (pool.length === 0) {
    throw new Error('no coffee profiles to draw a Cause & Effect round from');
  }

  const holesCount = Math.min(CAUSE_EFFECT_HOLES, pool.length);
  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const profileIds = sampleWithoutReplacement(pool, holesCount, random, options.weights);

  const holes = profileIds.map<CauseEffectHole>((profileId) => ({
    profileId,
    answerId: null,
    result: null,
  }));

  return { id: CAUSE_EFFECT_ID, holes, current: 0, complete: holes.length === 0 };
}

/** As `nextRound` is to belts: past performance biases which profiles come round next. */
export function nextCauseEffectRound(
  weightsFor: (candidates: readonly string[]) => ReadonlyMap<string, number>,
  options: CauseEffectOptions = {},
  deps: RoundDeps = DEFAULT_DEPS,
  profiles: ProfileSet = PROFILES,
): CauseEffectRound {
  return createCauseEffectRound(
    { ...options, weights: weightsFor(causeEffectPool(profiles)) },
    deps,
    profiles,
  );
}

export function answerCauseEffectHole(
  round: CauseEffectRound,
  answerId: string,
  deps: RoundDeps = DEFAULT_DEPS,
  profiles: ProfileSet = PROFILES,
): CauseEffectRound {
  if (round.complete) throw new Error('round is already complete');
  const hole = round.holes[round.current];
  if (!hole) throw new Error('no hole at the current index');
  if (hole.answerId !== null) throw new Error('hole has already been answered');

  const profile = profiles.byId.get(hole.profileId);
  if (!profile) throw new Error(`unknown profile "${hole.profileId}"`);

  const targetIds = profile.descriptors.map((d) => d.nodeId);
  const result = scoreAgainstAny(deps.wheel, deps.confusables, answerId, targetIds);

  const holes = round.holes.map((h, i) => (i === round.current ? { ...h, answerId, result } : h));
  const current = round.current + 1;

  return { ...round, holes, current, complete: current >= holes.length };
}

export interface CauseEffectSummary {
  readonly answered: number;
  readonly totalScore: number;
  readonly maxScore: number;
}

export function causeEffectSummary(round: CauseEffectRound): CauseEffectSummary {
  const answered = round.holes.filter((h) => h.result !== null);
  return {
    answered: answered.length,
    totalScore: answered.reduce((sum, h) => sum + h.result!.score, 0),
    maxScore: round.holes.length * 100,
  };
}
