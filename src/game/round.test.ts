import { describe, expect, it } from 'vitest';
import { ATTRIBUTES } from '../domain/attributes.js';
import { WHEEL, getNode } from '../domain/wheel.js';
import { BELTS, CATEGORY_UNLOCK_ORDER, getBelt } from './belts.js';
import {
  PAR_PER_HOLE,
  answerHole,
  clueCandidates,
  createRound,
  roundSummary,
  type Round,
} from './round.js';

const playRound = (round: Round, answer: (targetId: string) => string): Round => {
  let current = round;
  while (!current.complete) {
    const hole = current.holes[current.current]!;
    current = answerHole(current, answer(hole.targetId));
  }
  return current;
};

describe('belts', () => {
  it('unlocks the familiar categories first, not the wheel order', () => {
    expect(CATEGORY_UNLOCK_ORDER.slice(0, 3)).toEqual(['roasted', 'nutty-cocoa', 'sweet']);
    expect(new Set(CATEGORY_UNLOCK_ORDER).size).toBe(WHEEL.categoryOrder.length);
    for (const id of CATEGORY_UNLOCK_ORDER) expect(WHEEL.nodes.has(id)).toBe(true);
  });

  it('has enough written attributes to fill every belt without repeating a clue', () => {
    // The content gate. A belt that cannot fill a round is a belt that would silently start
    // repeating clues, and the player would learn the round rather than the wheel.
    for (const belt of BELTS) {
      const pool = clueCandidates(belt);
      expect(pool.length, `belt ${belt.id} has only ${pool.length} clues`).toBeGreaterThanOrEqual(
        belt.holes,
      );
    }
  });

  it('draws clues only from unlocked categories', () => {
    for (const belt of BELTS) {
      for (const id of clueCandidates(belt)) {
        expect(belt.categoryIds).toContain(getNode(WHEEL, id).categoryId);
      }
    }
  });
});

describe('clue content', () => {
  it('never gives away the answer in its own clue', () => {
    // Enforced at load time too; asserted here so the reason stays visible next to the game.
    for (const [nodeId, record] of ATTRIBUTES.byNode) {
      const clue = record.definition.beginner.toLowerCase();
      for (const word of getNode(WHEEL, nodeId)
        .label.toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 2)) {
        expect(clue.includes(word), `${nodeId} leaks "${word}"`).toBe(false);
      }
    }
  });

  it('writes both registers for every attribute', () => {
    for (const [nodeId, record] of ATTRIBUTES.byNode) {
      expect(record.definition.beginner.length, nodeId).toBeGreaterThan(30);
      expect(record.definition.expert.length, nodeId).toBeGreaterThan(30);
      expect(record.definition.beginner).not.toBe(record.definition.expert);
    }
  });

  it('ships no invented intensity anchors', () => {
    // Anchors are panel measurements. A plausible-looking number here would be a fabrication
    // wearing the clothes of data.
    for (const record of ATTRIBUTES.byNode.values()) {
      for (const reference of record.references ?? []) {
        expect(reference.intensity).toBeUndefined();
      }
    }
  });

  it('covers every attribute on the wheel', () => {
    const missing = [...WHEEL.nodes.keys()].filter((id) => !ATTRIBUTES.byNode.has(id));
    expect(missing).toEqual([]);
    expect(ATTRIBUTES.byNode.size).toBe(WHEEL.nodes.size);
  });

  it('admits it has not been reviewed', () => {
    expect(ATTRIBUTES.reviewStatus).toBe('provisional');
  });
});

describe('building a round', () => {
  it('deals the belt its full complement of holes', () => {
    const round = createRound('leaves', { seed: 1 });
    expect(round.holes).toHaveLength(getBelt('leaves').holes);
    expect(round.current).toBe(0);
    expect(round.complete).toBe(false);
  });

  it('is reproducible from a seed, and varies without one', () => {
    const a = createRound('leaves', { seed: 42 }).holes.map((h) => h.clueNodeId);
    const b = createRound('leaves', { seed: 42 }).holes.map((h) => h.clueNodeId);
    const c = createRound('leaves', { seed: 43 }).holes.map((h) => h.clueNodeId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('never repeats a clue inside one round', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const belt of BELTS) {
        const ids = createRound(belt.id, { seed }).holes.map((h) => h.clueNodeId);
        expect(new Set(ids).size, `${belt.id} seed ${seed}`).toBe(ids.length);
      }
    }
  });

  it('asks for the category at belt 1 while quoting a clue written for a leaf', () => {
    // This is what makes Nine Doors a classification drill rather than nine identical questions.
    const round = createRound('nine-doors', { seed: 7 });
    for (const hole of round.holes) {
      expect(getNode(WHEEL, hole.targetId).ring).toBe(1);
      expect(hole.targetId).toBe(getNode(WHEEL, hole.clueNodeId).categoryId);
    }
    expect(new Set(round.holes.map((h) => h.clue)).size).toBe(round.holes.length);
  });

  it('targets the right ring for every belt', () => {
    for (const belt of BELTS) {
      for (const hole of createRound(belt.id, { seed: 3 }).holes) {
        expect(getNode(WHEEL, hole.targetId).ring).toBe(belt.targetRing);
      }
    }
  });

  it('lets sampling weights bias the draw, which is where spaced repetition will plug in', () => {
    const favoured = 'roasted.burnt.ashy';
    const weights = new Map(clueCandidates(getBelt('leaves')).map((id) => [id, 0.0001]));
    weights.set(favoured, 1000);
    const round = createRound('leaves', { seed: 5, weights });
    expect(round.holes[0]?.clueNodeId).toBe(favoured);
  });

  it('refuses a belt with no written content rather than inventing clues', () => {
    // Every category is written up now, so this points at one that does not exist. The guard
    // still matters: it is what stands between a content gap and a round of invented clues.
    const unwritten = { ...getBelt('leaves'), id: 'unwritten', categoryIds: ['not-a-category'] };
    expect(clueCandidates(unwritten)).toEqual([]);
    expect(() => createRound(unwritten, { seed: 1 })).toThrow(/no attribute records/);
  });
});

describe('playing a round', () => {
  it('scores each answer and advances', () => {
    const round = createRound('leaves', { seed: 11 });
    const played = answerHole(round, round.holes[0]!.targetId);
    expect(played.current).toBe(1);
    expect(played.holes[0]?.result?.score).toBe(100);
    expect(played.holes[1]?.result).toBeNull();
  });

  it('leaves the previous round untouched, so history stays inspectable', () => {
    const round = createRound('leaves', { seed: 11 });
    answerHole(round, round.holes[0]!.targetId);
    expect(round.current).toBe(0);
    expect(round.holes[0]?.answerId).toBeNull();
  });

  it('completes after the last hole and refuses another answer', () => {
    const played = playRound(createRound('leaves', { seed: 2 }), (t) => t);
    expect(played.complete).toBe(true);
    expect(played.current).toBe(played.holes.length);
    expect(() => answerHole(played, 'sweet')).toThrow(/already complete/);
  });

  it('accepts an answer at any ring, because hedging has to be measurable', () => {
    // Nothing stops a player answering "Sweet" on a leaf hole. The engine scores it and flags it
    // rather than blocking it - a blocked hedge produces no data about hedging.
    const round = createRound('leaves', { seed: 4 });
    const hole = round.holes[0]!;
    const played = answerHole(round, getNode(WHEEL, hole.targetId).categoryId);
    expect(played.holes[0]?.result?.hedged).toBe(true);
    expect(played.holes[0]?.result?.specificity).toBe(1);
  });
});

describe('round summary', () => {
  it('reports a perfect round against par', () => {
    const summary = roundSummary(playRound(createRound('leaves', { seed: 8 }), (t) => t));
    expect(summary.totalScore).toBe(900);
    expect(summary.maxScore).toBe(900);
    expect(summary.par).toBe(9 * PAR_PER_HOLE);
    expect(summary.vsPar).toBe(900 - 9 * PAR_PER_HOLE);
    expect(summary.exactCount).toBe(9);
    expect(summary.hedgeRate).toBe(0);
    expect(summary.specificityIndex).toBe(3);
  });

  it('computes the two guardrail metrics the strategy hangs on', () => {
    // Every answer hedged to the category: hedge rate 1, specificity 1. These are the numbers
    // that decide whether the tier table needs retuning after the pilot.
    const summary = roundSummary(
      playRound(createRound('leaves', { seed: 9 }), (t) => getNode(WHEEL, t).categoryId),
    );
    expect(summary.hedgeRate).toBe(1);
    expect(summary.specificityIndex).toBe(1);
    expect(summary.vsPar).toBeLessThan(0);
  });

  it('counts answers by relation and names the weakest hole', () => {
    const summary = roundSummary(
      playRound(createRound('leaves', { seed: 6 }), (t) =>
        t === 'sweet.brown-sugar.honey' ? 'other.chemical.rubber' : t,
      ),
    );
    expect(summary.byRelation.exact).toBeGreaterThan(0);
    if (summary.byRelation.distant) {
      expect(summary.weakest?.result?.score).toBe(0);
      expect(summary.weakest?.targetId).toBe('sweet.brown-sugar.honey');
    }
  });

  it('handles a round nobody has played yet', () => {
    const summary = roundSummary(createRound('leaves', { seed: 1 }));
    expect(summary.answered).toBe(0);
    expect(summary.totalScore).toBe(0);
    expect(summary.hedgeRate).toBe(0);
    expect(summary.specificityIndex).toBe(0);
    expect(summary.weakest).toBeNull();
  });
});
