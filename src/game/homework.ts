import { homeworkPool, referenceIndexesIn } from '../domain/references.js';
import { scoreAnswer, type ScoreResult } from '../domain/scoring.js';
import type { Region } from '../domain/schema.js';
import type { ConfusableSet, Wheel } from '../domain/types.js';
import { CONFUSABLES, WHEEL } from '../domain/wheel.js';
import { drawCodes } from '../session/codes.js';
import type { HomeworkAssignment, HomeworkItem, Identification } from '../session/types.js';
import { mulberry32, sampleWithoutReplacement } from './round.js';

/**
 * Reference Homework (PLAN.md section 3.2, mode 8) - the Track A / Track B bridge, and the mode the
 * whole two-track design exists to make possible: the app assigns physical references from the
 * lexicon, then quizzes you blind days later.
 *
 * ## The delay is the mode
 *
 * Assigning a reference and quizzing it in the same sitting tests short-term memory and nothing else.
 * `HOMEWORK_DELAY_MS` is therefore not a cosmetic wait: `isDue` refuses the quiz until it has passed,
 * for exactly the reason `MASTERY_SPACING_MS` refuses a third exact answer inside 48 hours. A
 * learning metric that can be crammed is an engagement metric wearing a lab coat.
 *
 * ## What this mode can and cannot claim
 *
 * Answers are scored by the same engine as screen play, against a target the app knew first, so the
 * numbers are real. The blinding is not: a coded saucer of grated zest is often recognisable on
 * sight, and a taster preparing their own samples has already seen every one. That is why the session
 * record carries `blinding`, why the UI says so, and why the aroma kit exists alongside this mode -
 * drawing a numbered vial without looking at the number is genuinely blind in a way this is not.
 *
 * Handled honestly, homework is a recall test against ground truth. Overclaimed, it is a way to log
 * flattering numbers. The app cannot tell the difference, so it says which it is.
 *
 * ## Spaced repetition reaches here for real
 *
 * The pool is attribute node ids, which is exactly what `weightsForRound` in the progress store is
 * keyed by - so unlike the Cause & Effect modes (whose pools are profile ids and whose weighting is
 * therefore a documented no-op), passing weights in here genuinely biases the draw. A descriptor you
 * keep missing on the wheel is a descriptor you should be sent to go and smell, and that connection
 * is the single most useful thing in the physical track.
 */

export const HOMEWORK_ID = 'reference-homework';

/** Five references a week is a shopping list, not a chore. */
export const HOMEWORK_ITEMS = 5;

/** Three days. Long enough that the answer is recall; short enough that the sample is still good. */
export const HOMEWORK_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

export interface AssignmentOptions {
  readonly seed?: number;
  readonly count?: number;
  /** Per-attribute sampling weights - `weightsForRound(progress, pool)` fits straight in. */
  readonly weights?: ReadonlyMap<string, number>;
  readonly delayMs?: number;
}

/**
 * Draw an assignment for one region. Throws when the region has no references at all rather than
 * handing back an empty assignment: an empty homework list is a content gap, and silence about it
 * would leave a player waiting for a quiz that can never become due.
 */
export function createAssignment(
  region: Region,
  at: number,
  options: AssignmentOptions = {},
): HomeworkAssignment {
  const pool = homeworkPool(region);
  if (pool.length === 0) {
    throw new Error(`no reference standards are available in region "${region}"`);
  }

  const count = Math.min(options.count ?? HOMEWORK_ITEMS, pool.length);
  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const nodeIds = sampleWithoutReplacement(pool, count, random, options.weights);
  const codes = drawCodes(nodeIds.length, random);

  const items = nodeIds.map<HomeworkItem>((nodeId, i) => ({
    nodeId,
    // Pick one of the record's references at random when it offers several - the alternatives are
    // alternatives, not a set to be smelled together.
    referenceIndex: pickReferenceIndex(nodeId, region, random),
    code: codes[i]!,
  }));

  return {
    region,
    assignedAt: at,
    dueAt: at + (options.delayMs ?? HOMEWORK_DELAY_MS),
    items,
  };
}

/** Only references buyable in the assignment's region are eligible, not every one on the record. */
function pickReferenceIndex(nodeId: string, region: Region, random: () => number): number {
  const eligible = referenceIndexesIn(nodeId, region);
  return eligible[Math.floor(random() * eligible.length)] ?? 0;
}

export function isDue(assignment: HomeworkAssignment, now: number): boolean {
  return now >= assignment.dueAt;
}

/** Whole days still to wait, rounded up. 0 once due. */
export function daysUntilDue(assignment: HomeworkAssignment, now: number): number {
  return Math.max(0, Math.ceil((assignment.dueAt - now) / (24 * 60 * 60 * 1000)));
}

export interface HomeworkHole {
  readonly code: string;
  readonly targetId: string;
  readonly referenceIndex: number;
  readonly answerId: string | null;
  readonly result: ScoreResult | null;
}

export interface HomeworkRound {
  readonly id: typeof HOMEWORK_ID;
  readonly region: Region;
  readonly holes: readonly HomeworkHole[];
  readonly current: number;
  readonly complete: boolean;
}

export interface HomeworkRoundOptions {
  readonly seed?: number;
}

/**
 * Turn a due assignment into a quiz. The samples are presented in a different order from the
 * assignment, drawn from the seed - a list quizzed in the order it was written lets the taster count
 * down the shopping list instead of smelling.
 */
export function createHomeworkRound(
  assignment: HomeworkAssignment,
  options: HomeworkRoundOptions = {},
): HomeworkRound {
  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const order = sampleWithoutReplacement(
    assignment.items.map((item) => item.code),
    assignment.items.length,
    random,
    undefined,
  );

  const byCode = new Map(assignment.items.map((item) => [item.code, item]));
  const holes = order.map<HomeworkHole>((code) => {
    const item = byCode.get(code)!;
    return {
      code,
      targetId: item.nodeId,
      referenceIndex: item.referenceIndex,
      answerId: null,
      result: null,
    };
  });

  return {
    id: HOMEWORK_ID,
    region: assignment.region,
    holes,
    current: 0,
    complete: holes.length === 0,
  };
}

export interface HomeworkDeps {
  readonly wheel: Wheel;
  readonly confusables: ConfusableSet;
}

const DEFAULT_DEPS: HomeworkDeps = { wheel: WHEEL, confusables: CONFUSABLES };

export function answerHomeworkHole(
  round: HomeworkRound,
  answerId: string,
  deps: HomeworkDeps = DEFAULT_DEPS,
): HomeworkRound {
  if (round.complete) throw new Error('round is already complete');
  const hole = round.holes[round.current];
  if (!hole) throw new Error('no hole at the current index');
  if (hole.answerId !== null) throw new Error('hole has already been answered');

  // The same engine screen play uses. A physical reference is not graded on a different scale just
  // because it arrived through the nose: near misses are near misses everywhere.
  const result = scoreAnswer(deps.wheel, deps.confusables, answerId, hole.targetId);
  const holes = round.holes.map((h, i) => (i === round.current ? { ...h, answerId, result } : h));
  const current = round.current + 1;

  return { ...round, holes, current, complete: current >= holes.length };
}

export interface HomeworkSummary {
  readonly answered: number;
  readonly total: number;
  readonly exactCount: number;
  readonly totalScore: number;
  readonly accuracy: number;
}

export function homeworkSummary(round: HomeworkRound): HomeworkSummary {
  const answered = round.holes.filter((h) => h.result !== null);
  const totalScore = answered.reduce((sum, h) => sum + h.result!.score, 0);
  return {
    answered: answered.length,
    total: round.holes.length,
    exactCount: answered.filter((h) => h.result!.relation === 'exact').length,
    totalScore,
    accuracy: answered.length === 0 ? 0 : totalScore / answered.length,
  };
}

/** The graded results, in the shape the session log stores. */
export function homeworkIdentifications(round: HomeworkRound): Identification[] {
  return round.holes
    .filter((h) => h.result !== null)
    .map((h) => ({
      targetId: h.targetId,
      answerId: h.result!.answerId,
      score: h.result!.score,
      exact: h.result!.relation === 'exact',
    }));
}
