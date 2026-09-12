import { describe, expect, it } from 'vitest';
import { WHEEL, getNode } from '../domain/wheel.js';
import { ATTRIBUTES } from '../domain/attributes.js';
import { EMPTY_PROGRESS } from '../progress/types.js';
import { recordRound } from '../progress/store.js';
import { answerHole, roundSummary, type Round } from './round.js';
import {
  DEFECT_LAB_HOLES,
  DEFECT_LAB_ID,
  createDefectRound,
  defectKind,
  defectPool,
  nextDefectRound,
} from './defects.js';

const playRound = (round: Round, answer: (targetId: string) => string): Round => {
  let current = round;
  while (!current.complete) {
    current = answerHole(current, answer(current.holes[current.current]!.targetId));
  }
  return current;
};

describe('defect pool', () => {
  it('is exactly the fault-flagged attributes, and every one has a clue', () => {
    const pool = defectPool();
    expect(pool.length).toBeGreaterThanOrEqual(DEFECT_LAB_HOLES);
    for (const id of pool) {
      expect(getNode(WHEEL, id).defect).not.toBeNull();
      expect(ATTRIBUTES.byNode.has(id)).toBe(true);
    }
    // Nothing fault-flagged is left out.
    const flagged = [...WHEEL.nodes.values()].filter((n) => n.defect !== null).map((n) => n.id);
    expect(new Set(pool)).toEqual(new Set(flagged.filter((id) => ATTRIBUTES.byNode.has(id))));
  });

  it('classifies each flag', () => {
    expect(defectKind(WHEEL, 'roasted.burnt.ashy')).toBe('fault');
    expect(defectKind(WHEEL, 'roasted.burnt.smoky')).toBe('contextual');
    expect(defectKind(WHEEL, 'fruity.berry.blackberry')).toBeNull();
  });
});

describe('a defect round', () => {
  it('asks for the fault itself - target equals clue, always ring 3', () => {
    const round = createDefectRound({ seed: 1 });
    expect(round.beltId).toBe(DEFECT_LAB_ID);
    expect(round.holes).toHaveLength(DEFECT_LAB_HOLES);
    for (const hole of round.holes) {
      expect(hole.targetId).toBe(hole.clueNodeId);
      expect(getNode(WHEEL, hole.targetId).ring).toBe(3);
      expect(getNode(WHEEL, hole.targetId).defect).not.toBeNull();
    }
  });

  it('is reproducible from a seed and varies without one', () => {
    const a = createDefectRound({ seed: 9 }).holes.map((h) => h.clueNodeId);
    const b = createDefectRound({ seed: 9 }).holes.map((h) => h.clueNodeId);
    const c = createDefectRound({ seed: 10 }).holes.map((h) => h.clueNodeId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('never repeats a fault inside one round', () => {
    for (let seed = 0; seed < 20; seed++) {
      const ids = createDefectRound({ seed }).holes.map((h) => h.clueNodeId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('scores and completes like any round, and feeds progress', () => {
    const round = playRound(createDefectRound({ seed: 3 }), (t) => t);
    expect(round.complete).toBe(true);
    const summary = roundSummary(round);
    expect(summary.totalScore).toBe(DEFECT_LAB_HOLES * 100);

    const p = recordRound(EMPTY_PROGRESS, round, Date.parse('2026-09-10T12:00:00'));
    expect(p.rounds[0]?.beltId).toBe(DEFECT_LAB_ID);
    expect(p.answers.count).toBe(DEFECT_LAB_HOLES);
    expect(p.streak.current).toBe(1);
  });

  it('routes the pool through the spaced-repetition weights', () => {
    const pool = defectPool();
    const wanted = new Set(pool.slice(0, DEFECT_LAB_HOLES));
    const weights = new Map(pool.map((id) => [id, wanted.has(id) ? 1 : 0.00001]));

    for (let seed = 0; seed < 10; seed++) {
      const round = nextDefectRound(() => weights, { seed });
      for (const hole of round.holes) expect(wanted.has(hole.clueNodeId)).toBe(true);
    }
  });
});
