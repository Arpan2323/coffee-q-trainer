import { describe, expect, it } from 'vitest';
import { WHEEL } from '../domain/wheel.js';
import { ROAST_TRENDS } from '../domain/roastTrends.js';
import { PROFILES } from '../domain/profiles.js';
import { EMPTY_PROGRESS } from '../progress/types.js';
import { recordPerturbationRound } from '../progress/store.js';
import {
  PERTURBATION_HOLES,
  PERTURBATION_ID,
  createPerturbationRound,
  furtherRoast,
  guessCategory,
  isHoleReady,
  nextPerturbationRound,
  perturbationPool,
  perturbationSummary,
  submitHole,
  type PerturbationRound,
} from './perturbation.js';

/** Guesses every category on the current hole and submits it. */
const playHole = (round: PerturbationRound, answer: (categoryId: string) => 'up' | 'down' | 'mixed'): PerturbationRound => {
  const hole = round.holes[round.current]!;
  let next = round;
  for (const g of hole.guesses) next = guessCategory(next, g.categoryId, answer(g.categoryId));
  return submitHole(next);
};

const playAllCorrect = (round: PerturbationRound): PerturbationRound => {
  let current = round;
  while (!current.complete) {
    current = playHole(current, (categoryId) => ROAST_TRENDS.byCategory.get(categoryId)!.direction);
  }
  return current;
};

describe('a Perturbation round', () => {
  it('asks about every ring-1 category on every hole', () => {
    const round = createPerturbationRound({ seed: 1 });
    expect(round.id).toBe(PERTURBATION_ID);
    expect(round.holes.length).toBe(Math.min(PERTURBATION_HOLES, perturbationPool().length));
    for (const hole of round.holes) {
      expect(hole.guesses.map((g) => g.categoryId).sort()).toEqual([...WHEEL.categoryOrder].sort());
    }
  });

  it('never repeats a profile within a round', () => {
    for (let seed = 0; seed < 20; seed++) {
      const round = createPerturbationRound({ seed });
      expect(new Set(round.holes.map((h) => h.profileId)).size).toBe(round.holes.length);
    }
  });

  it('is reproducible from a seed and varies without one', () => {
    const a = createPerturbationRound({ seed: 4 }).holes.map((h) => h.profileId);
    const b = createPerturbationRound({ seed: 4 }).holes.map((h) => h.profileId);
    const c = createPerturbationRound({ seed: 5 }).holes.map((h) => h.profileId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('refuses to submit until every category has a guess', () => {
    const round = createPerturbationRound({ seed: 1 });
    expect(isHoleReady(round.holes[0]!)).toBe(false);
    expect(() => submitHole(round)).toThrow(/every category needs a guess/);

    const oneGuessed = guessCategory(round, round.holes[0]!.guesses[0]!.categoryId, 'up');
    expect(isHoleReady(oneGuessed.holes[0]!)).toBe(false);
  });

  it('scores each category against the roast-trend table independently', () => {
    const round = createPerturbationRound({ seed: 2 });
    const played = playHole(round, (categoryId) => {
      const truth = ROAST_TRENDS.byCategory.get(categoryId)!.direction;
      // Answer correctly for "roasted", wrong for everything else.
      return categoryId === 'roasted' ? truth : truth === 'up' ? 'down' : 'up';
    });

    const roasted = played.holes[0]!.guesses.find((g) => g.categoryId === 'roasted')!;
    const other = played.holes[0]!.guesses.find((g) => g.categoryId !== 'roasted')!;
    expect(roasted.correct).toBe(true);
    expect(other.correct).toBe(false);
  });

  it('completes and summarises across every hole', () => {
    const round = playAllCorrect(createPerturbationRound({ seed: 3 }));
    expect(round.complete).toBe(true);
    const summary = perturbationSummary(round);
    expect(summary.total).toBe(round.holes.length * WHEEL.categoryOrder.length);
    expect(summary.correct).toBe(summary.total);
    expect(summary.answered).toBe(summary.total);
  });

  it('respects sampling weights, same as Forward and Reverse', () => {
    const pool = perturbationPool();
    const wanted = new Set(pool.slice(0, PERTURBATION_HOLES));
    const weights = new Map(pool.map((id) => [id, wanted.has(id) ? 1 : 0]));
    for (let seed = 0; seed < 10; seed++) {
      const round = nextPerturbationRound(() => weights, { seed });
      for (const hole of round.holes) expect(wanted.has(hole.profileId)).toBe(true);
    }
  });

  it('refuses to guess on or submit a hole that is already submitted, or a complete round', () => {
    const round = playAllCorrect(createPerturbationRound({ seed: 3 }));
    expect(() => guessCategory(round, WHEEL.categoryOrder[0]!, 'up')).toThrow(/already complete/);
    expect(() => submitHole(round)).toThrow(/already complete/);
  });
});

describe('further roast', () => {
  it('moves one step up the light-to-dark ladder', () => {
    expect(furtherRoast('light')).toBe('medium');
    expect(furtherRoast('medium')).toBe('medium-dark');
    expect(furtherRoast('medium-dark')).toBe('dark');
  });

  it('has nowhere further to go from dark', () => {
    expect(furtherRoast('dark')).toBeNull();
  });
});

describe('recording a Perturbation round', () => {
  it('refuses an unfinished round', () => {
    expect(() => recordPerturbationRound(EMPTY_PROGRESS, createPerturbationRound({ seed: 1 }))).toThrow(
      /completed round/,
    );
  });

  it('tallies attempts and correct guesses across all holes, and counts a streak day', () => {
    const round = playAllCorrect(createPerturbationRound({ seed: 5 }));
    const p = recordPerturbationRound(EMPTY_PROGRESS, round, Date.parse('2026-09-13T10:00:00'));

    const expectedTotal = round.holes.length * WHEEL.categoryOrder.length;
    expect(p.perturbation).toEqual({ attempts: expectedTotal, correct: expectedTotal });
    expect(p.streak.current).toBe(1);
  });

  it('does not touch attribute mastery, categories, or the confusion matrix', () => {
    const round = playAllCorrect(createPerturbationRound({ seed: 5 }));
    const p = recordPerturbationRound(EMPTY_PROGRESS, round, Date.parse('2026-09-13T10:00:00'));

    expect(Object.keys(p.attributes)).toHaveLength(0);
    expect(Object.keys(p.categories)).toHaveLength(0);
    expect(p.confusions).toHaveLength(0);
    expect(p.answers.count).toBe(0);
    expect(p.rounds).toHaveLength(0);
  });

  it('draws from the real profile set without throwing', () => {
    // A light sanity check that the pool this all runs against is the live PROFILES set, not a stub.
    expect(perturbationPool()).toEqual(expect.arrayContaining([...PROFILES.byId.keys()].slice(0, 1)));
  });
});
