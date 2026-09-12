import { describe, expect, it } from 'vitest';
import { PROFILES } from '../domain/profiles.js';
import type { Process } from '../domain/schema.js';
import { EMPTY_PROGRESS } from '../progress/types.js';
import { recordReverseRound } from '../progress/store.js';
import {
  CAUSE_EFFECT_REVERSE_ID,
  REVERSE_HOLES,
  answerReverseHole,
  createReverseRound,
  nextReverseRound,
  reversePool,
  reverseSummary,
  type ReverseRound,
} from './causeEffectReverse.js';

const playRound = (round: ReverseRound, answer: (profileId: string) => Process): ReverseRound => {
  let current = round;
  while (!current.complete) {
    current = answerReverseHole(current, answer(current.holes[current.current]!.profileId));
  }
  return current;
};

describe('a Cause & Effect Reverse round', () => {
  it('draws one hole per profile, never repeating one in a round', () => {
    for (let seed = 0; seed < 20; seed++) {
      const round = createReverseRound({ seed });
      expect(round.id).toBe(CAUSE_EFFECT_REVERSE_ID);
      expect(round.holes.length).toBe(Math.min(REVERSE_HOLES, reversePool().length));
      expect(new Set(round.holes.map((h) => h.profileId)).size).toBe(round.holes.length);
    }
  });

  it('is reproducible from a seed and varies without one', () => {
    const a = createReverseRound({ seed: 4 }).holes.map((h) => h.profileId);
    const b = createReverseRound({ seed: 4 }).holes.map((h) => h.profileId);
    const c = createReverseRound({ seed: 5 }).holes.map((h) => h.profileId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('scores the true process correct and every other process wrong', () => {
    const round = createReverseRound({ seed: 1 });
    const profile = PROFILES.byId.get(round.holes[0]!.profileId)!;

    const right = answerReverseHole(round, profile.process);
    expect(right.holes[0]!.correct).toBe(true);

    const processes = ['washed', 'natural', 'honey', 'anaerobic', 'wet-hulled'] as const;
    const wrong = processes.find((p) => p !== profile.process)!;
    const missed = answerReverseHole(round, wrong);
    expect(missed.holes[0]!.correct).toBe(false);
  });

  it('completes and summarises like any round', () => {
    const round = playRound(createReverseRound({ seed: 6 }), (profileId) => PROFILES.byId.get(profileId)!.process);
    expect(round.complete).toBe(true);
    const summary = reverseSummary(round);
    expect(summary.answered).toBe(round.holes.length);
    expect(summary.correct).toBe(round.holes.length);
    expect(summary.total).toBe(round.holes.length);
  });

  it('respects sampling weights, same as the forward round', () => {
    const pool = reversePool();
    const wanted = new Set(pool.slice(0, REVERSE_HOLES));
    const weights = new Map(pool.map((id) => [id, wanted.has(id) ? 1 : 0]));
    for (let seed = 0; seed < 10; seed++) {
      const round = nextReverseRound(() => weights, { seed });
      for (const hole of round.holes) expect(wanted.has(hole.profileId)).toBe(true);
    }
  });

  it('leaves the round it was called on untouched, and refuses a complete round', () => {
    const round = createReverseRound({ seed: 2 });
    const profile = PROFILES.byId.get(round.holes[0]!.profileId)!;
    answerReverseHole(round, profile.process);
    expect(round.holes[0]!.answer).toBeNull(); // the caller's copy is immutable

    const complete = playRound(round, (profileId) => PROFILES.byId.get(profileId)!.process);
    expect(() => answerReverseHole(complete, 'washed')).toThrow(/already complete/);
  });
});

describe('recording a Reverse round', () => {
  it('refuses an unfinished round', () => {
    expect(() => recordReverseRound(EMPTY_PROGRESS, createReverseRound({ seed: 1 }))).toThrow(
      /completed round/,
    );
  });

  it('tallies attempts and correct guesses, and counts a streak day', () => {
    const round = playRound(createReverseRound({ seed: 3 }), (profileId) =>
      PROFILES.byId.get(profileId)!.process,
    );
    const p = recordReverseRound(EMPTY_PROGRESS, round, Date.parse('2026-09-12T10:00:00'));

    expect(p.reverse).toEqual({ attempts: round.holes.length, correct: round.holes.length });
    expect(p.streak.current).toBe(1);
  });

  it('does not touch attribute mastery, categories, or the confusion matrix', () => {
    const round = playRound(createReverseRound({ seed: 3 }), (profileId) =>
      PROFILES.byId.get(profileId)!.process,
    );
    const p = recordReverseRound(EMPTY_PROGRESS, round, Date.parse('2026-09-12T10:00:00'));

    expect(Object.keys(p.attributes)).toHaveLength(0);
    expect(Object.keys(p.categories)).toHaveLength(0);
    expect(p.confusions).toHaveLength(0);
    expect(p.answers.count).toBe(0);
    expect(p.rounds).toHaveLength(0); // not an attribute-practice round, so not in round history
  });

  it('accumulates across rounds rather than resetting each time', () => {
    const processes = ['washed', 'natural', 'honey', 'anaerobic', 'wet-hulled'] as const;
    let p = EMPTY_PROGRESS;
    for (let seed = 0; seed < 3; seed++) {
      // Deliberately answer wrong every time, to prove `correct` tracks accuracy, not just attempts.
      const round = playRound(createReverseRound({ seed }), (profileId) => {
        const actual = PROFILES.byId.get(profileId)!.process;
        return processes.find((x) => x !== actual)!;
      });
      p = recordReverseRound(p, round, Date.parse('2026-09-12T10:00:00') + seed * 86_400_000);
    }
    expect(p.reverse.attempts).toBeGreaterThan(0);
    expect(p.reverse.correct).toBe(0);
  });
});
