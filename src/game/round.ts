import { ATTRIBUTES } from '../domain/attributes.js';
import { DEFAULT_SCORING, scoreAnswer, type Relation, type ScoreResult } from '../domain/scoring.js';
import type { ConfusableSet, Wheel } from '../domain/types.js';
import { CONFUSABLES, WHEEL, ancestorsOf, getNode } from '../domain/wheel.js';
import { getBelt, type Belt } from './belts.js';

/**
 * Par is the sibling tier: you found the right neighbourhood. Scores stay on the 0-100 points scale
 * rather than being inverted into strokes - golf's lower-is-better would fight the scoring engine
 * everywhere it surfaced, for the sake of a metaphor.
 */
export const PAR_PER_HOLE = DEFAULT_SCORING.sibling;

export interface Hole {
  /** The attribute the clue was written for; may be deeper than the target. */
  readonly clueNodeId: string;
  readonly targetId: string;
  readonly clue: string;
  readonly answerId: string | null;
  readonly result: ScoreResult | null;
}

export interface Round {
  readonly beltId: string;
  readonly holes: readonly Hole[];
  readonly current: number;
  readonly complete: boolean;
}

export interface RoundDeps {
  readonly wheel: Wheel;
  readonly confusables: ConfusableSet;
}

export const DEFAULT_DEPS: RoundDeps = { wheel: WHEEL, confusables: CONFUSABLES };

/**
 * Small deterministic PRNG, so a seed reproduces a round exactly in tests and in bug reports.
 * Exported so other seeded draws (Cause & Effect's profile pool) share one PRNG rather than growing
 * a second one.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The attribute at `ring` on the path to `nodeId`, or the node itself when it is shallower. */
function ancestorAtRing(wheel: Wheel, nodeId: string, ring: number): string {
  const node = getNode(wheel, nodeId);
  if (node.ring <= ring) return node.id;
  const chain = [...ancestorsOf(wheel, nodeId), node];
  return chain[ring - 1]?.id ?? node.id;
}

/**
 * Attributes that can supply a clue for this belt: inside an unlocked category, deep enough that
 * the belt's target ring exists on its path, and actually written up. No record, no hole - the
 * game never invents a clue it does not have.
 */
export function clueCandidates(belt: Belt, deps: RoundDeps = DEFAULT_DEPS): string[] {
  return [...ATTRIBUTES.byNode.keys()].filter((nodeId) => {
    const node = getNode(deps.wheel, nodeId);
    return belt.categoryIds.includes(node.categoryId) && node.ring >= belt.targetRing;
  });
}

export interface RoundOptions {
  readonly seed?: number;
  /** Per-attribute sampling weights, so spaced repetition can bias toward past misses. */
  readonly weights?: ReadonlyMap<string, number>;
}

/** Weighted draw with no repeats. Exported for the same reason as `mulberry32` above. */
export function sampleWithoutReplacement(
  pool: readonly string[],
  count: number,
  random: () => number,
  weights: ReadonlyMap<string, number> | undefined,
): string[] {
  const remaining = [...pool];
  const picked: string[] = [];

  while (picked.length < count && remaining.length > 0) {
    const weightOf = (id: string): number => Math.max(weights?.get(id) ?? 1, 0);
    const total = remaining.reduce((sum, id) => sum + weightOf(id), 0);

    let cursor = random() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      cursor -= weightOf(remaining[i]!);
      if (cursor <= 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining.splice(index, 1)[0]!);
  }

  return picked;
}

/**
 * Draw `holes` clues from `pool` and build the round. Shared by `createRound` (belt-driven) and by
 * Defect Lab, which draws from the fault-flagged attributes instead of a category. `id` is stored on
 * the round for the results screen and the progress record; it need not name a belt.
 */
export function buildRound(
  id: string,
  pool: readonly string[],
  targetRing: number,
  holes: number,
  options: RoundOptions = {},
  deps: RoundDeps = DEFAULT_DEPS,
): Round {
  if (pool.length === 0) {
    throw new Error(`round "${id}" has no attribute records to draw on`);
  }

  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const clueIds = sampleWithoutReplacement(pool, holes, random, options.weights);

  const built = clueIds.map<Hole>((clueNodeId) => ({
    clueNodeId,
    targetId: ancestorAtRing(deps.wheel, clueNodeId, targetRing),
    clue: ATTRIBUTES.byNode.get(clueNodeId)!.definition.beginner,
    answerId: null,
    result: null,
  }));

  return { beltId: id, holes: built, current: 0, complete: built.length === 0 };
}

export function createRound(
  belt: string | Belt,
  options: RoundOptions = {},
  deps: RoundDeps = DEFAULT_DEPS,
): Round {
  const resolved = typeof belt === 'string' ? getBelt(belt) : belt;
  return buildRound(
    resolved.id,
    clueCandidates(resolved, deps),
    resolved.targetRing,
    resolved.holes,
    options,
    deps,
  );
}

/** Returns a new round; the caller's copy is untouched, so history stays inspectable. */
export function answerHole(round: Round, answerId: string, deps: RoundDeps = DEFAULT_DEPS): Round {
  if (round.complete) throw new Error('round is already complete');
  const hole = round.holes[round.current];
  if (!hole) throw new Error('no hole at the current index');
  if (hole.answerId !== null) throw new Error('hole has already been answered');

  const result = scoreAnswer(deps.wheel, deps.confusables, answerId, hole.targetId);
  const holes = round.holes.map((h, i) => (i === round.current ? { ...h, answerId, result } : h));
  const current = round.current + 1;

  return { ...round, holes, current, complete: current >= holes.length };
}

/**
 * Which round comes next, given what the player has done before. This is policy, not view: it
 * belongs beside the engine so it can be tested, rather than inside a component where the only
 * way to check it is to play a few dozen rounds and squint at the distribution.
 */
export function nextRound(
  belt: string | Belt,
  weightsFor: (candidates: readonly string[]) => ReadonlyMap<string, number>,
  options: RoundOptions = {},
  deps: RoundDeps = DEFAULT_DEPS,
): Round {
  const resolved = typeof belt === 'string' ? getBelt(belt) : belt;
  return createRound(
    resolved,
    { ...options, weights: weightsFor(clueCandidates(resolved, deps)) },
    deps,
  );
}

export interface RoundSummary {
  readonly beltId: string;
  readonly answered: number;
  readonly totalScore: number;
  readonly maxScore: number;
  readonly par: number;
  readonly vsPar: number;
  /** Mean ring the player committed to. The plan's specificity index. */
  readonly specificityIndex: number;
  /** Share of answers that stopped short of the target's depth. The plan's hedge-rate guardrail. */
  readonly hedgeRate: number;
  readonly exactCount: number;
  readonly byRelation: Readonly<Partial<Record<Relation, number>>>;
  readonly weakest: Hole | null;
}

export function roundSummary(round: Round): RoundSummary {
  const answered = round.holes.filter((h) => h.result !== null);
  const byRelation: Partial<Record<Relation, number>> = {};
  let totalScore = 0;
  let specificity = 0;
  let hedges = 0;
  let exactCount = 0;
  let weakest: Hole | null = null;

  for (const hole of answered) {
    const result = hole.result!;
    totalScore += result.score;
    specificity += result.specificity;
    if (result.hedged) hedges += 1;
    if (result.relation === 'exact') exactCount += 1;
    byRelation[result.relation] = (byRelation[result.relation] ?? 0) + 1;
    if (weakest === null || result.score < weakest.result!.score) weakest = hole;
  }

  const n = answered.length;
  return {
    beltId: round.beltId,
    answered: n,
    totalScore,
    maxScore: round.holes.length * DEFAULT_SCORING.exact,
    par: round.holes.length * PAR_PER_HOLE,
    vsPar: totalScore - n * PAR_PER_HOLE,
    specificityIndex: n === 0 ? 0 : specificity / n,
    hedgeRate: n === 0 ? 0 : hedges / n,
    exactCount,
    byRelation,
    weakest,
  };
}
