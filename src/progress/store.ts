import type { Round } from '../game/round.js';
import { roundSummary } from '../game/round.js';
import type { CauseEffectRound } from '../game/causeEffectRound.js';
import type { ReverseRound } from '../game/causeEffectReverse.js';
import type { Ring, Wheel } from '../domain/types.js';
import { DEFAULT_SCORING } from '../domain/scoring.js';
import { WHEEL, getNode } from '../domain/wheel.js';
import {
  EMPTY_ANSWER_TOTALS,
  EMPTY_PROGRESS,
  EMPTY_REVERSE_STATS,
  PROGRESS_VERSION,
  type AttributeStat,
  type ConfusionEntry,
  type Progress,
} from './types.js';

/**
 * Mastery rules. These implement the North Star from STRATEGY.md: a descriptor is mastered after
 * three exact answers spaced at least 48 hours apart. The spacing is the whole point - it is what
 * makes the metric un-crammable, and therefore what makes it a learning measure rather than an
 * engagement measure.
 */
export const MASTERY_EXACT_COUNT = 3;
export const MASTERY_SPACING_MS = 48 * 60 * 60 * 1000;
/** Rounds kept for the history sparkline. */
export const ROUND_HISTORY_LIMIT = 100;

/** Confusion pairs kept. Past this the least-frequent pair is evicted - a profile, not a log. */
export const CONFUSION_LIMIT = 80;

/** A category needs at least this many attempts before "weak" or "covered" means anything. */
export const CATEGORY_SAMPLE_MIN = 4;

/**
 * Mean score below this in a category reads as not yet perceiving it - it is the same-category
 * tier, i.e. the player is landing in the right ring-1 wedge at best. Above it, real discrimination
 * has started. Used for the coverage axis and the blind-sector callout, not for scoring.
 */
export const CATEGORY_WEAK_ACCURACY = 35;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day. Deliberately not UTC: a streak is about the user's day, not the server's. */
export function dayKey(at: number): string {
  const d = new Date(at);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function isConsecutive(previous: string, next: string): boolean {
  const [py, pm, pd] = previous.split('-').map(Number);
  const prior = new Date(py!, pm! - 1, pd!).getTime();
  return dayKey(prior + DAY_MS) === next;
}

/**
 * A streak day is a *completed round*, never an app open. Rewarding the open would make the streak
 * measure attendance, and the product already has one number that measures learning.
 */
export function recordStreakDay(progress: Progress, at: number): Progress {
  const today = dayKey(at);
  const { streak } = progress;
  if (streak.lastDay === today) return progress;

  const current = streak.lastDay !== null && isConsecutive(streak.lastDay, today) ? streak.current + 1 : 1;
  return {
    ...progress,
    streak: {
      current,
      longest: Math.max(streak.longest, current),
      lastDay: today,
      daysPlayed: streak.daysPlayed + 1,
    },
  };
}

const BLANK_STAT: AttributeStat = {
  attempts: 0,
  totalScore: 0,
  lastAt: 0,
  countedExact: [],
  masteredAt: null,
  lapses: 0,
};

interface AttemptOutcome {
  readonly nodeId: string;
  readonly score: number;
  readonly exact: boolean;
  readonly at: number;
}

export function recordAttempt(progress: Progress, attempt: AttemptOutcome): Progress {
  const previous = progress.attributes[attempt.nodeId] ?? BLANK_STAT;
  const wasMastered = previous.masteredAt !== null;

  let countedExact = previous.countedExact;
  let lapses = previous.lapses;
  let masteredAt = previous.masteredAt;
  let everMastered = progress.everMastered;
  let totalLapses = progress.lapses;

  if (attempt.exact) {
    const lastCounted = countedExact.at(-1) ?? -Infinity;
    if (attempt.at - lastCounted >= MASTERY_SPACING_MS) {
      countedExact = [...countedExact, attempt.at];
    }
    if (!wasMastered && countedExact.length >= MASTERY_EXACT_COUNT) {
      masteredAt = attempt.at;
      everMastered += 1;
    }
  } else if (wasMastered) {
    // The decay guardrail. A mastered descriptor that fails has to be re-earned from scratch -
    // anything softer would let the mastery count drift upward while real recall drifted down.
    masteredAt = null;
    countedExact = [];
    lapses += 1;
    totalLapses += 1;
  }

  return {
    ...progress,
    everMastered,
    lapses: totalLapses,
    attributes: {
      ...progress.attributes,
      [attempt.nodeId]: {
        attempts: previous.attempts + 1,
        totalScore: previous.totalScore + attempt.score,
        lastAt: attempt.at,
        countedExact,
        masteredAt,
        lapses,
      },
    },
  };
}

export interface AnswerOutcome {
  /** The attribute the clue was written for - what the player is learning to recognise. */
  readonly targetId: string;
  /** What the player committed to on the wheel. */
  readonly answerId: string;
  /** Ring-1 category of the target, so per-category coverage does not need a wheel lookup here. */
  readonly categoryId: string;
  readonly score: number;
  readonly exact: boolean;
  readonly hedged: boolean;
  /** Ring the player committed to. Averaged, this is the specificity index. */
  readonly ring: Ring;
  readonly at: number;
}

/**
 * The analytics half of recording an answer: lifetime sums, per-category coverage, the vocabulary
 * the player actually uses, and the confusion matrix. Kept separate from `recordAttempt` (which
 * owns mastery and decay) so each reducer stays small and independently testable.
 */
export function recordAnswerOutcome(progress: Progress, outcome: AnswerOutcome): Progress {
  const answers = {
    count: progress.answers.count + 1,
    scoreSum: progress.answers.scoreSum + outcome.score,
    ringSum: progress.answers.ringSum + outcome.ring,
    hedges: progress.answers.hedges + (outcome.hedged ? 1 : 0),
  };

  const prevCat = progress.categories[outcome.categoryId] ?? {
    attempts: 0,
    scoreSum: 0,
    exactCount: 0,
  };
  const categories = {
    ...progress.categories,
    [outcome.categoryId]: {
      attempts: prevCat.attempts + 1,
      scoreSum: prevCat.scoreSum + outcome.score,
      exactCount: prevCat.exactCount + (outcome.exact ? 1 : 0),
    },
  };

  const vocab = {
    ...progress.vocab,
    [outcome.answerId]: (progress.vocab[outcome.answerId] ?? 0) + 1,
  };

  let confusions = progress.confusions;
  if (!outcome.exact && outcome.answerId !== outcome.targetId) {
    confusions = bumpConfusion(confusions, outcome.targetId, outcome.answerId, outcome.at);
  }

  return { ...progress, answers, categories, vocab, confusions };
}

function bumpConfusion(
  entries: readonly ConfusionEntry[],
  targetId: string,
  answerId: string,
  at: number,
): ConfusionEntry[] {
  const i = entries.findIndex((e) => e.targetId === targetId && e.answerId === answerId);
  const next =
    i === -1
      ? [...entries, { targetId, answerId, count: 1, lastAt: at }]
      : entries.map((e, j) => (j === i ? { ...e, count: e.count + 1, lastAt: at } : e));

  if (next.length <= CONFUSION_LIMIT) return next;

  // Evict the least-frequent pair; oldest breaks the tie. A brand-new pair can be the one dropped,
  // which is the right call - a one-off miss is not yet a pattern worth keeping.
  let weakest = 0;
  for (let j = 1; j < next.length; j++) {
    const a = next[j]!;
    const b = next[weakest]!;
    if (a.count < b.count || (a.count === b.count && a.lastAt < b.lastAt)) weakest = j;
  }
  return next.filter((_, j) => j !== weakest);
}

/**
 * Recorded on completion rather than per hole: a finished round is the unit of practice, and
 * half-played rounds would let a player farm the easy holes and abandon the rest.
 */
export function recordRound(
  progress: Progress,
  round: Round,
  at: number = Date.now(),
  wheel: Wheel = WHEEL,
): Progress {
  if (!round.complete) throw new Error('only a completed round can be recorded');

  const summary = roundSummary(round);
  let next = recordStreakDay(progress, at);

  for (const hole of round.holes) {
    if (hole.result === null) continue;
    next = recordAttempt(next, {
      // Credit the attribute the clue was written for, not the belt's shallower target: that is
      // the thing the player is actually learning to recognise.
      nodeId: hole.clueNodeId,
      score: hole.result.score,
      exact: hole.result.relation === 'exact',
      at,
    });
    next = recordAnswerOutcome(next, {
      targetId: hole.clueNodeId,
      answerId: hole.result.answerId,
      categoryId: getNode(wheel, hole.clueNodeId).categoryId,
      score: hole.result.score,
      exact: hole.result.relation === 'exact',
      hedged: hole.result.hedged,
      ring: hole.result.specificity,
      at,
    });
  }

  const record = {
    at,
    beltId: summary.beltId,
    totalScore: summary.totalScore,
    maxScore: summary.maxScore,
    specificityIndex: summary.specificityIndex,
    hedgeRate: summary.hedgeRate,
    exactCount: summary.exactCount,
    holes: round.holes.length,
  };

  return { ...next, rounds: [...next.rounds, record].slice(-ROUND_HISTORY_LIMIT) };
}

/**
 * Cause & Effect records progress the same way, but there is no single `clueNodeId`: each hole is
 * scored against every descriptor a profile carries (`scoreAgainstAny`), because a real coffee is
 * legitimately several defensible descriptors at once. What gets credited is whichever descriptor
 * the player's answer matched best - `result.targetId` - which is exactly the node `scoreAgainstAny`
 * decided the answer was closest to, not an arbitrary pick.
 */
export function recordCauseEffectRound(
  progress: Progress,
  round: CauseEffectRound,
  at: number = Date.now(),
  wheel: Wheel = WHEEL,
): Progress {
  if (!round.complete) throw new Error('only a completed round can be recorded');

  let next = recordStreakDay(progress, at);
  let totalScore = 0;
  let specificity = 0;
  let hedges = 0;
  let exactCount = 0;
  let answered = 0;

  for (const hole of round.holes) {
    const result = hole.result;
    if (result === null) continue;
    answered += 1;
    totalScore += result.score;
    specificity += result.specificity;
    if (result.hedged) hedges += 1;
    if (result.relation === 'exact') exactCount += 1;

    next = recordAttempt(next, {
      nodeId: result.targetId,
      score: result.score,
      exact: result.relation === 'exact',
      at,
    });
    next = recordAnswerOutcome(next, {
      targetId: result.targetId,
      answerId: result.answerId,
      categoryId: getNode(wheel, result.targetId).categoryId,
      score: result.score,
      exact: result.relation === 'exact',
      hedged: result.hedged,
      ring: result.specificity,
      at,
    });
  }

  const record = {
    at,
    beltId: round.id,
    totalScore,
    maxScore: round.holes.length * DEFAULT_SCORING.exact,
    specificityIndex: answered === 0 ? 0 : specificity / answered,
    hedgeRate: answered === 0 ? 0 : hedges / answered,
    exactCount,
    holes: round.holes.length,
  };

  return { ...next, rounds: [...next.rounds, record].slice(-ROUND_HISTORY_LIMIT) };
}

/**
 * Reverse counts as real practice for the streak, same as any completed round - but it does not
 * touch `attributes`, `categories`, `confusions` or `vocab`. A process guess has no wheel node to
 * credit: crediting one would be inventing a link between "you said washed" and "you know Jasmine"
 * that isn't there. `reverse` is the whole of what gets recorded, and it stays out of `rounds`
 * (a history of attribute-practice rounds the belts/Defect Lab/Cause & Effect Forward share) rather
 * than force a `specificityIndex` and `hedgeRate` that mean nothing here.
 */
export function recordReverseRound(
  progress: Progress,
  round: ReverseRound,
  at: number = Date.now(),
): Progress {
  if (!round.complete) throw new Error('only a completed round can be recorded');

  const next = recordStreakDay(progress, at);
  const correct = round.holes.filter((h) => h.correct === true).length;

  return {
    ...next,
    reverse: {
      attempts: next.reverse.attempts + round.holes.length,
      correct: next.reverse.correct + correct,
    },
  };
}

export function masteredIds(progress: Progress): string[] {
  return Object.entries(progress.attributes)
    .filter(([, stat]) => stat.masteredAt !== null)
    .map(([nodeId]) => nodeId);
}

export interface ProgressStats {
  readonly mastered: number;
  readonly streak: number;
  readonly longestStreak: number;
  readonly roundsPlayed: number;
  readonly attributesSeen: number;
  /** Share of mastery events since lost. The honesty check on the mastered count. */
  readonly decayRate: number;
}

export function progressStats(progress: Progress): ProgressStats {
  return {
    mastered: masteredIds(progress).length,
    streak: progress.streak.current,
    longestStreak: progress.streak.longest,
    roundsPlayed: progress.rounds.length,
    attributesSeen: Object.keys(progress.attributes).length,
    decayRate: progress.everMastered === 0 ? 0 : progress.lapses / progress.everMastered,
  };
}

export interface CategoryCoverage {
  readonly categoryId: string;
  readonly label: string;
  readonly color: string;
  readonly attempts: number;
  /** Mean score in this category, 0-100. */
  readonly accuracy: number;
  readonly exactRate: number;
  /** Never attempted. */
  readonly blind: boolean;
  /** Attempted enough to judge, and the player is not yet perceiving it. */
  readonly weak: boolean;
}

/**
 * The Palate Profile from PLAN.md section 3.4. Four of the six axes are computable from screen play:
 * Breadth, Specificity, Accuracy, and Coverage. Precision (repeatability on a re-served sample) and
 * Consensus (agreement with a panel) need the physical track and are deliberately absent rather
 * than faked - the same discipline the attribute records apply to intensity anchors.
 */
export interface PalateProfile {
  readonly answered: number;
  /** Distinct descriptors the player has committed to. */
  readonly breadth: number;
  /** Breadth as a fraction of every node on the wheel, 0-1. */
  readonly breadthFraction: number;
  /** Mean ring committed to, 0-3. */
  readonly specificity: number;
  /** Mean score, 0-100. */
  readonly accuracy: number;
  /** Lifetime hedge rate, 0-1. */
  readonly hedgeRate: number;
  /** 1 - hedgeRate. On the radar as "Commitment" so every axis reads "more is better". */
  readonly commitment: number;
  /** Fraction of the nine categories attempted enough and not weak, 0-1. */
  readonly coverage: number;
  readonly perCategory: readonly CategoryCoverage[];
  /** Labels of categories never attempted or still weak - the "you are blind to X" line. */
  readonly blindSectors: readonly string[];
}

export function palateProfile(progress: Progress, wheel: Wheel = WHEEL): PalateProfile {
  const { answers } = progress;
  const n = answers.count;

  const perCategory: CategoryCoverage[] = wheel.categoryOrder.map((categoryId) => {
    const node = getNode(wheel, categoryId);
    const stat = progress.categories[categoryId];
    const attempts = stat?.attempts ?? 0;
    const accuracy = attempts === 0 ? 0 : stat!.scoreSum / attempts;
    const enough = attempts >= CATEGORY_SAMPLE_MIN;
    return {
      categoryId,
      label: node.label,
      color: node.color,
      attempts,
      accuracy,
      exactRate: attempts === 0 ? 0 : stat!.exactCount / attempts,
      blind: attempts === 0,
      weak: enough && accuracy < CATEGORY_WEAK_ACCURACY,
    };
  });

  const covered = perCategory.filter(
    (c) => c.attempts >= CATEGORY_SAMPLE_MIN && c.accuracy >= CATEGORY_WEAK_ACCURACY,
  ).length;

  return {
    answered: n,
    breadth: Object.keys(progress.vocab).length,
    breadthFraction: wheel.nodes.size === 0 ? 0 : Object.keys(progress.vocab).length / wheel.nodes.size,
    specificity: n === 0 ? 0 : answers.ringSum / n,
    accuracy: n === 0 ? 0 : answers.scoreSum / n,
    hedgeRate: n === 0 ? 0 : answers.hedges / n,
    commitment: n === 0 ? 0 : 1 - answers.hedges / n,
    coverage: covered / perCategory.length,
    perCategory,
    blindSectors: perCategory.filter((c) => c.blind || c.weak).map((c) => c.label),
  };
}

export interface Confusion {
  readonly targetId: string;
  readonly answerId: string;
  readonly targetLabel: string;
  readonly answerLabel: string;
  readonly count: number;
}

/** The confusion matrix, resolved to labels and sorted worst-first. */
export function topConfusions(
  progress: Progress,
  limit = 8,
  wheel: Wheel = WHEEL,
): Confusion[] {
  return [...progress.confusions]
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, limit)
    .map((e) => ({
      targetId: e.targetId,
      answerId: e.answerId,
      targetLabel: getNode(wheel, e.targetId).label,
      answerLabel: getNode(wheel, e.answerId).label,
      count: e.count,
    }));
}

/**
 * Sampling weights for the next round: the spaced-repetition seam that `createRound` already
 * accepts. Weak attributes come round more often; mastered ones are damped but never silenced,
 * because a descriptor that never reappears can never be shown to have decayed.
 */
export function samplingWeights(progress: Progress): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [nodeId, stat] of Object.entries(progress.attributes)) {
    if (stat.masteredAt !== null) {
      weights.set(nodeId, 0.4);
      continue;
    }
    const mean = stat.attempts === 0 ? 0 : stat.totalScore / stat.attempts;
    weights.set(nodeId, 1 + 2 * (1 - Math.min(mean, 100) / 100));
  }
  return weights;
}

/** Unseen attributes get this. Above a well-answered one, below a repeatedly missed one. */
export const UNSEEN_WEIGHT = 1.5;

export function weightsForRound(progress: Progress, candidates: readonly string[]): Map<string, number> {
  const known = samplingWeights(progress);
  return new Map(candidates.map((id) => [id, known.get(id) ?? UNSEEN_WEIGHT]));
}

/** Discards anything written by a different schema version rather than guessing at a migration. */
export function reviveProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PROGRESS;
  const candidate = raw as Partial<Progress>;
  if (candidate.version !== PROGRESS_VERSION) return EMPTY_PROGRESS;
  return {
    ...EMPTY_PROGRESS,
    ...candidate,
    streak: { ...EMPTY_PROGRESS.streak, ...candidate.streak },
    rounds: candidate.rounds ?? [],
    attributes: candidate.attributes ?? {},
    answers: { ...EMPTY_ANSWER_TOTALS, ...candidate.answers },
    categories: candidate.categories ?? {},
    confusions: candidate.confusions ?? [],
    vocab: candidate.vocab ?? {},
    reverse: { ...EMPTY_REVERSE_STATS, ...candidate.reverse },
  };
}
