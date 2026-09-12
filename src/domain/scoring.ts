import type { ConfusablePair, ConfusableSet, Ring, Wheel } from './types.js';
import { categoryGap, getNode, isAncestor, lowestCommonAncestor } from './wheel.js';

export type Relation =
  | 'exact'
  | 'sibling'
  | 'descendant'
  | 'ancestor-ring2'
  | 'ancestor-ring1'
  | 'same-category'
  | 'adjacent-category'
  | 'confusable'
  | 'distant';

export interface ScoringConfig {
  readonly exact: number;
  /** Same ring-2 parent. Raspberry for blackberry. */
  readonly sibling: number;
  /** Answer sits below the target. Blackberry for "Berry" - over-specified but in the right branch. */
  readonly descendant: number;
  /** Correct ring-2 branch, target was ring 3. Right neighbourhood, no house number. */
  readonly ancestorRing2: number;
  /** Correct category, target was deeper. The classic hedge. */
  readonly ancestorRing1: number;
  /** Same category, different ring-2 branch. Raisin for blackberry. */
  readonly sameCategory: number;
  readonly adjacentCategory: number;
  readonly distant: number;
}

/**
 * The tier values are the product's main behavioural lever, so they live in one object and are
 * injectable. Two properties are deliberate and worth defending:
 *
 * 1. `sibling` (70) beats `ancestorRing2` (60). Committing to a specific leaf and landing on a
 *    neighbour scores better than stopping at the branch and being technically right. That is the
 *    anti-hedging incentive, and it is the whole pedagogy: the game exists to build specific
 *    vocabulary, not to reward safe answers.
 * 2. `ancestorRing1` equals `sameCategory` (35). An earlier draft scored the correct-but-vague
 *    answer below a wrong-but-same-category one. That reads as punishing a correct answer, which
 *    costs more in trust than it buys in incentive. Equal is enough - the real pressure comes from
 *    the gap up to 70.
 *
 * If pilot hedge rate stays above 20% by session 5 (STRATEGY.md guardrail), widen the gap here
 * before touching content.
 */
export const DEFAULT_SCORING: ScoringConfig = {
  exact: 100,
  sibling: 70,
  descendant: 65,
  ancestorRing2: 60,
  ancestorRing1: 35,
  sameCategory: 35,
  adjacentCategory: 12,
  distant: 0,
};

export interface ScoreResult {
  readonly answerId: string;
  readonly targetId: string;
  readonly score: number;
  readonly relation: Relation;
  /** Structural score before any confusable override, for analytics on how often the table fires. */
  readonly baseScore: number;
  /** Edge count through the tree, plus a cyclic penalty across categories. Lower is closer. */
  readonly wheelDistance: number;
  /** True when the answer is a strict ancestor of the target. Feeds the hedge-rate guardrail. */
  readonly hedged: boolean;
  /** Ring the player committed to. Averaged over attempts this is the specificity index. */
  readonly specificity: Ring;
  readonly confusable: ConfusablePair | null;
}

function structuralRelation(wheel: Wheel, answerId: string, targetId: string): Relation {
  if (answerId === targetId) return 'exact';

  const answer = getNode(wheel, answerId);

  if (isAncestor(wheel, answerId, targetId)) {
    return answer.ring === 2 ? 'ancestor-ring2' : 'ancestor-ring1';
  }
  if (isAncestor(wheel, targetId, answerId)) return 'descendant';

  const lca = lowestCommonAncestor(wheel, answerId, targetId);
  if (lca !== null) {
    // Sibling means "shares a ring-2 parent", which only two ring-3 leaves can do. Two ring-2
    // nodes under the same category (Vanilla and Vanillin, Tobacco and Pipe Tobacco) share only
    // the category, so they land in same-category alongside Blackberry/Raisin. That is the point:
    // the same perceptual gap should not score 70 at ring 2 and 35 at ring 3 merely because of
    // where the tree happens to branch. Ring-2 pairs that really are close get their credit from
    // the curated confusable table instead, which is exactly what curation is for.
    return lca.ring === 2 ? 'sibling' : 'same-category';
  }
  return categoryGap(wheel, answerId, targetId) === 1 ? 'adjacent-category' : 'distant';
}

function baseFor(relation: Relation, config: ScoringConfig): number {
  switch (relation) {
    case 'exact':
      return config.exact;
    case 'sibling':
      return config.sibling;
    case 'descendant':
      return config.descendant;
    case 'ancestor-ring2':
      return config.ancestorRing2;
    case 'ancestor-ring1':
      return config.ancestorRing1;
    case 'same-category':
      return config.sameCategory;
    case 'adjacent-category':
      return config.adjacentCategory;
    case 'distant':
    case 'confusable':
      return config.distant;
  }
}

/**
 * Edges to the lowest common ancestor from each side. Across categories the wheel has no shared
 * root, so the two ring depths are summed and a cyclic penalty added - which keeps the measure
 * monotone with perceptual distance rather than merely well-defined.
 */
export function wheelDistance(wheel: Wheel, aId: string, bId: string): number {
  if (aId === bId) return 0;
  const a = getNode(wheel, aId);
  const b = getNode(wheel, bId);
  const lca = lowestCommonAncestor(wheel, aId, bId);

  if (lca === null) {
    return a.ring + b.ring + 2 * categoryGap(wheel, aId, bId);
  }

  // The lca is an ancestor-or-self of both, so ring difference is the edge count.
  return a.ring - lca.ring + (b.ring - lca.ring);
}

export function scoreAnswer(
  wheel: Wheel,
  confusables: ConfusableSet,
  answerId: string,
  targetId: string,
  config: ScoringConfig = DEFAULT_SCORING,
): ScoreResult {
  const answer = getNode(wheel, answerId);
  getNode(wheel, targetId); // validate

  const relation = structuralRelation(wheel, answerId, targetId);
  const baseScore = baseFor(relation, config);

  const pair = confusables.byNode.get(answerId)?.get(targetId) ?? null;
  const confusableScore = pair ? Math.round(pair.weight * config.exact) : 0;
  const useConfusable = pair !== null && confusableScore > baseScore;

  return {
    answerId,
    targetId,
    score: useConfusable ? confusableScore : baseScore,
    relation: useConfusable ? 'confusable' : relation,
    baseScore,
    wheelDistance: wheelDistance(wheel, answerId, targetId),
    hedged: relation === 'ancestor-ring1' || relation === 'ancestor-ring2',
    specificity: answer.ring,
    confusable: pair,
  };
}

/**
 * Real coffees carry several defensible descriptors at once, so a round may hold more than one
 * target. Scoring against the best match avoids punishing a player for naming the blueberry in a
 * cup that is also blackberry - a failure mode that would teach exactly the wrong lesson.
 */
export function scoreAgainstAny(
  wheel: Wheel,
  confusables: ConfusableSet,
  answerId: string,
  targetIds: readonly string[],
  config: ScoringConfig = DEFAULT_SCORING,
): ScoreResult {
  if (targetIds.length === 0) throw new Error('scoreAgainstAny needs at least one target');

  let best: ScoreResult | null = null;
  for (const targetId of targetIds) {
    const result = scoreAnswer(wheel, confusables, answerId, targetId, config);
    if (
      best === null ||
      result.score > best.score ||
      (result.score === best.score && result.wheelDistance < best.wheelDistance)
    ) {
      best = result;
    }
  }
  return best as ScoreResult;
}
