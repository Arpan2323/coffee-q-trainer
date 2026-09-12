import { describe, expect, it } from 'vitest';
import { answerHole, createRound, nextRound, type Round } from '../game/round.js';
import { getBelt } from '../game/belts.js';
import { EMPTY_PROGRESS, PROGRESS_VERSION, type Progress } from './types.js';
import {
  CATEGORY_SAMPLE_MIN,
  CONFUSION_LIMIT,
  MASTERY_EXACT_COUNT,
  MASTERY_SPACING_MS,
  ROUND_HISTORY_LIMIT,
  UNSEEN_WEIGHT,
  type AnswerOutcome,
  dayKey,
  masteredIds,
  palateProfile,
  progressStats,
  recordAnswerOutcome,
  recordAttempt,
  recordRound,
  recordStreakDay,
  reviveProgress,
  topConfusions,
  weightsForRound,
} from './store.js';
import { STORAGE_KEY, createLocalStorage, createMemoryStorage } from './storage.js';
import { WHEEL } from '../domain/wheel.js';

const DAY = 24 * 60 * 60 * 1000;
const at = (day: number, hour = 12): number => new Date(2026, 7, day, hour).getTime();

const exactly = (progress: Progress, nodeId: string, when: number): Progress =>
  recordAttempt(progress, { nodeId, score: 100, exact: true, at: when });

const wrongly = (progress: Progress, nodeId: string, when: number): Progress =>
  recordAttempt(progress, { nodeId, score: 12, exact: false, at: when });

const playAll = (round: Round, answer: (targetId: string) => string): Round => {
  let current = round;
  while (!current.complete) {
    current = answerHole(current, answer(current.holes[current.current]!.targetId));
  }
  return current;
};

describe('streaks', () => {
  it('counts consecutive local days', () => {
    let p = recordStreakDay(EMPTY_PROGRESS, at(10));
    expect(p.streak.current).toBe(1);
    p = recordStreakDay(p, at(11));
    p = recordStreakDay(p, at(12));
    expect(p.streak.current).toBe(3);
    expect(p.streak.longest).toBe(3);
    expect(p.streak.daysPlayed).toBe(3);
  });

  it('does not advance twice in one day', () => {
    let p = recordStreakDay(EMPTY_PROGRESS, at(10, 9));
    p = recordStreakDay(p, at(10, 21));
    expect(p.streak.current).toBe(1);
    expect(p.streak.daysPlayed).toBe(1);
  });

  it('resets after a missed day but remembers the best run', () => {
    let p = EMPTY_PROGRESS;
    for (const d of [10, 11, 12, 13]) p = recordStreakDay(p, at(d));
    p = recordStreakDay(p, at(16));
    expect(p.streak.current).toBe(1);
    expect(p.streak.longest).toBe(4);
  });

  it('crosses a month boundary', () => {
    let p = recordStreakDay(EMPTY_PROGRESS, new Date(2026, 7, 31, 12).getTime());
    p = recordStreakDay(p, new Date(2026, 8, 1, 12).getTime());
    expect(p.streak.current).toBe(2);
  });

  it('keys days locally, not in UTC', () => {
    // 23:30 local is still today for the person holding the cup, whatever UTC thinks.
    const late = new Date(2026, 7, 10, 23, 30).getTime();
    expect(dayKey(late)).toBe('2026-08-10');
  });
});

describe('mastery', () => {
  it('needs three exact answers spaced beyond the cramming window', () => {
    let p = EMPTY_PROGRESS;
    p = exactly(p, 'sweet.vanilla', at(1));
    p = exactly(p, 'sweet.vanilla', at(3));
    expect(masteredIds(p)).toEqual([]);
    p = exactly(p, 'sweet.vanilla', at(5));
    expect(masteredIds(p)).toEqual(['sweet.vanilla']);
    expect(progressStats(p).mastered).toBe(1);
  });

  it('cannot be crammed in one sitting', () => {
    // The point of the spacing rule: ten right answers in an afternoon count once.
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 10; i++) p = exactly(p, 'sweet.vanilla', at(1) + i * 60_000);
    expect(masteredIds(p)).toEqual([]);
    expect(p.attributes['sweet.vanilla']?.countedExact).toHaveLength(1);
    expect(p.attributes['sweet.vanilla']?.attempts).toBe(10);
  });

  it('counts an exact answer exactly at the spacing boundary', () => {
    let p = exactly(EMPTY_PROGRESS, 'sweet.vanilla', at(1));
    p = exactly(p, 'sweet.vanilla', at(1) + MASTERY_SPACING_MS);
    expect(p.attributes['sweet.vanilla']?.countedExact).toHaveLength(2);
  });

  it('lapses when a mastered attribute is later missed, and tracks the decay rate', () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < MASTERY_EXACT_COUNT; i++) p = exactly(p, 'sweet.vanilla', at(1 + i * 3));
    expect(progressStats(p).mastered).toBe(1);
    expect(progressStats(p).decayRate).toBe(0);

    p = wrongly(p, 'sweet.vanilla', at(30));
    expect(progressStats(p).mastered).toBe(0);
    expect(progressStats(p).decayRate).toBe(1);
    // Re-earned from scratch: anything softer lets the mastery count drift up while recall drifts down.
    expect(p.attributes['sweet.vanilla']?.countedExact).toEqual([]);
    expect(p.attributes['sweet.vanilla']?.lapses).toBe(1);
  });

  it('does not count a miss on an unmastered attribute as decay', () => {
    const p = wrongly(EMPTY_PROGRESS, 'sweet.vanilla', at(1));
    expect(progressStats(p).decayRate).toBe(0);
    expect(p.lapses).toBe(0);
  });
});

describe('recording a round', () => {
  it('refuses an unfinished round', () => {
    expect(() => recordRound(EMPTY_PROGRESS, createRound('leaves', { seed: 1 }), at(1))).toThrow(
      /completed round/,
    );
  });

  it('credits the attribute the clue was written for, not the shallower target', () => {
    // On Nine Doors the target is a category, but what the player is learning to recognise is the
    // leaf the clue describes. Crediting the category would make progress meaningless.
    const round = playAll(createRound('nine-doors', { seed: 3 }), (t) => t);
    const p = recordRound(EMPTY_PROGRESS, round, at(1));

    const credited = Object.entries(p.attributes)
      .flatMap(([id, stat]) => Array.from({ length: stat.attempts }, () => id))
      .sort();
    expect(credited).toEqual(round.holes.map((h) => h.clueNodeId).sort());

    // And at least one hole really did have a deeper clue than its target, or this proves nothing.
    expect(round.holes.some((h) => h.clueNodeId !== h.targetId)).toBe(true);
  });

  it('records one streak day and one history entry per round', () => {
    const round = playAll(createRound('leaves', { seed: 2 }), (t) => t);
    const p = recordRound(EMPTY_PROGRESS, round, at(1));
    expect(p.rounds).toHaveLength(1);
    expect(p.rounds[0]?.totalScore).toBe(900);
    expect(p.rounds[0]?.beltId).toBe('leaves');
    expect(p.streak.current).toBe(1);
  });

  it('caps the history without losing the newest rounds', () => {
    let p = EMPTY_PROGRESS;
    const round = playAll(createRound('leaves', { seed: 2 }), (t) => t);
    for (let i = 0; i < ROUND_HISTORY_LIMIT + 10; i++) p = recordRound(p, round, at(1) + i * DAY);
    expect(p.rounds).toHaveLength(ROUND_HISTORY_LIMIT);
    expect(p.rounds.at(-1)?.at).toBe(at(1) + (ROUND_HISTORY_LIMIT + 9) * DAY);
  });

  it('leaves the previous progress untouched', () => {
    const round = playAll(createRound('leaves', { seed: 2 }), (t) => t);
    recordRound(EMPTY_PROGRESS, round, at(1));
    expect(EMPTY_PROGRESS.rounds).toHaveLength(0);
    expect(Object.keys(EMPTY_PROGRESS.attributes)).toHaveLength(0);
  });
});

describe('sampling weights', () => {
  it('favours weak attributes over well-answered ones', () => {
    let p = wrongly(EMPTY_PROGRESS, 'sweet.vanilla', at(1));
    p = exactly(p, 'sweet.vanillin', at(1));
    const w = weightsForRound(p, ['sweet.vanilla', 'sweet.vanillin', 'floral.floral.rose']);
    expect(w.get('sweet.vanilla')!).toBeGreaterThan(w.get('floral.floral.rose')!);
    expect(w.get('floral.floral.rose')).toBe(UNSEEN_WEIGHT);
    expect(w.get('sweet.vanillin')!).toBeLessThan(w.get('floral.floral.rose')!);
  });

  it('damps mastered attributes without silencing them', () => {
    // Something that never comes round again can never be shown to have decayed.
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < MASTERY_EXACT_COUNT; i++) p = exactly(p, 'sweet.vanilla', at(1 + i * 3));
    const w = weightsForRound(p, ['sweet.vanilla']);
    expect(w.get('sweet.vanilla')!).toBeGreaterThan(0);
    expect(w.get('sweet.vanilla')!).toBeLessThan(UNSEEN_WEIGHT);
  });

  it('gives every candidate a positive weight, so nothing becomes unreachable', () => {
    const w = weightsForRound(EMPTY_PROGRESS, ['a', 'b']);
    expect([...w.values()].every((v) => v > 0)).toBe(true);
  });

  it('actually biases the next round toward weak attributes', () => {
    // The end-to-end check on the spaced-repetition seam: progress in, biased draw out. Proving
    // this through the UI would mean playing dozens of rounds and squinting at a distribution.
    const belt = getBelt('leaves');
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 4; i++) p = wrongly(p, 'roasted.burnt.ashy', at(1 + i));

    let appearances = 0;
    for (let seed = 0; seed < 30; seed++) {
      const round = nextRound(belt, (c) => weightsForRound(p, c), { seed });
      if (round.holes.some((h) => h.clueNodeId === 'roasted.burnt.ashy')) appearances += 1;
    }

    let baseline = 0;
    for (let seed = 0; seed < 30; seed++) {
      const round = nextRound(belt, (c) => weightsForRound(EMPTY_PROGRESS, c), { seed });
      if (round.holes.some((h) => h.clueNodeId === 'roasted.burnt.ashy')) baseline += 1;
    }

    expect(appearances).toBeGreaterThan(baseline);
  });

  it('leaves a mastered attribute reachable, just rarer', () => {
    const belt = getBelt('leaves');
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < MASTERY_EXACT_COUNT; i++) p = exactly(p, 'roasted.burnt.ashy', at(1 + i * 3));

    let appearances = 0;
    for (let seed = 0; seed < 60; seed++) {
      const round = nextRound(belt, (c) => weightsForRound(p, c), { seed });
      if (round.holes.some((h) => h.clueNodeId === 'roasted.burnt.ashy')) appearances += 1;
    }
    expect(appearances).toBeGreaterThan(0);
  });
});

describe('palate profile', () => {
  const answer = (p: Progress, o: Partial<AnswerOutcome> & Pick<AnswerOutcome, 'targetId' | 'answerId' | 'categoryId'>): Progress =>
    recordAnswerOutcome(p, { score: 0, exact: false, hedged: false, ring: 3, at: at(1), ...o });

  it('turns lifetime sums into the four screen-computable axes', () => {
    let p = EMPTY_PROGRESS;
    p = answer(p, {
      targetId: 'sweet.brown-sugar.molasses', answerId: 'sweet.brown-sugar.molasses',
      categoryId: 'sweet', score: 100, exact: true, ring: 3,
    });
    p = answer(p, {
      targetId: 'sweet.brown-sugar.honey', answerId: 'sweet',
      categoryId: 'sweet', score: 35, hedged: true, ring: 1,
    });

    const prof = palateProfile(p);
    expect(prof.answered).toBe(2);
    expect(prof.accuracy).toBe(67.5);
    expect(prof.specificity).toBe(2);
    expect(prof.hedgeRate).toBe(0.5);
    expect(prof.commitment).toBe(0.5);
    expect(prof.breadth).toBe(2); // "molasses" and the hedge to "sweet" are two distinct descriptors
  });

  it('is all zeroes and no NaN before the first answer', () => {
    const prof = palateProfile(EMPTY_PROGRESS);
    for (const v of [prof.accuracy, prof.specificity, prof.hedgeRate, prof.commitment, prof.coverage, prof.breadth]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(prof.perCategory).toHaveLength(9);
    expect(prof.blindSectors).toHaveLength(9); // every category is a blind sector at the start
  });

  it('counts a category as covered only past the sample floor and the accuracy floor', () => {
    let strong = EMPTY_PROGRESS;
    for (let i = 0; i < CATEGORY_SAMPLE_MIN; i++) {
      strong = answer(strong, {
        targetId: 'roasted.burnt.ashy', answerId: 'roasted.burnt.ashy',
        categoryId: 'roasted', score: 100, exact: true,
      });
    }
    const roasted = palateProfile(strong).perCategory.find((c) => c.categoryId === 'roasted')!;
    expect(roasted.blind).toBe(false);
    expect(roasted.weak).toBe(false);
    expect(palateProfile(strong).coverage).toBeCloseTo(1 / 9);

    let weak = EMPTY_PROGRESS;
    for (let i = 0; i < CATEGORY_SAMPLE_MIN; i++) {
      weak = answer(weak, {
        targetId: 'spices.brown-spice.clove', answerId: 'roasted', categoryId: 'spices', score: 12,
      });
    }
    const spices = palateProfile(weak).perCategory.find((c) => c.categoryId === 'spices')!;
    expect(spices.weak).toBe(true);
    expect(palateProfile(weak).blindSectors).toContain(spices.label);
    expect(palateProfile(weak).coverage).toBe(0);
  });

  it('does not log an exact answer as a confusion', () => {
    const p = answer(EMPTY_PROGRESS, {
      targetId: 'sweet.vanilla', answerId: 'sweet.vanilla', categoryId: 'sweet',
      score: 100, exact: true, ring: 2,
    });
    expect(p.confusions).toEqual([]);
  });

  it('builds the confusion matrix, counting repeats and resolving labels worst-first', () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 3; i++) {
      p = answer(p, {
        targetId: 'sour-fermented.alcohol-fermented.fermented',
        answerId: 'sour-fermented.alcohol-fermented.winey',
        categoryId: 'sour-fermented', score: 70, at: at(1 + i),
      });
    }
    p = answer(p, {
      targetId: 'fruity.berry.blackberry', answerId: 'fruity.berry.raspberry',
      categoryId: 'fruity', score: 70,
    });

    expect(p.confusions).toHaveLength(2);
    const top = topConfusions(p);
    expect(top[0]).toMatchObject({ targetLabel: 'Fermented', answerLabel: 'Winey', count: 3 });
    expect(top[1]).toMatchObject({ targetLabel: 'Blackberry', answerLabel: 'Raspberry', count: 1 });
  });

  it('caps the confusion matrix by evicting the least-frequent pair', () => {
    let p = EMPTY_PROGRESS;
    // One ring-2 pair seen twice; the eviction loop below only makes ring-3 pairs, so it is safe.
    for (let i = 0; i < 2; i++) {
      p = answer(p, { targetId: 'sweet.vanilla', answerId: 'sweet.vanillin', categoryId: 'sweet', ring: 2 });
    }
    // Then CONFUSION_LIMIT fresh once-seen pairs, one more than the cap can hold.
    const leaves = [...WHEEL.nodes.values()].filter((n) => n.ring === 3).map((n) => n.id);
    let made = 0;
    outer: for (let a = 0; a < leaves.length; a++) {
      for (let b = 0; b < leaves.length; b++) {
        if (a === b) continue;
        p = answer(p, { targetId: leaves[a]!, answerId: leaves[b]!, categoryId: 'fruity', at: at(2) + made });
        if (++made >= CONFUSION_LIMIT) break outer;
      }
    }
    expect(p.confusions).toHaveLength(CONFUSION_LIMIT);
    // The twice-seen pair survives; a once-seen pair was dropped.
    expect(p.confusions.find((c) => c.targetId === 'sweet.vanilla')?.count).toBe(2);
  });

  it('is populated end-to-end by recording a round', () => {
    const round = playAll(createRound('leaves', { seed: 7 }), (t) => t);
    const p = recordRound(EMPTY_PROGRESS, round, at(1));
    const prof = palateProfile(p);
    expect(prof.answered).toBe(round.holes.length);
    expect(prof.accuracy).toBeGreaterThan(0);
    expect(Object.keys(p.categories).length).toBeGreaterThan(0);
  });
});

describe('persistence', () => {
  it('round-trips through localStorage', () => {
    const backing = new Map<string, string>();
    const fake = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    } as unknown as Storage;

    const storage = createLocalStorage(fake);
    const round = playAll(createRound('leaves', { seed: 2 }), (t) => t);
    storage.save(recordRound(EMPTY_PROGRESS, round, at(1)));

    const loaded = storage.load();
    expect(loaded.rounds).toHaveLength(1);
    expect(loaded.streak.current).toBe(1);
    expect(Object.keys(loaded.attributes)).toHaveLength(9);
    expect(backing.has(STORAGE_KEY)).toBe(true);
  });

  it('survives corrupt data instead of taking the app down', () => {
    const fake = {
      getItem: () => '{not json',
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage;
    expect(createLocalStorage(fake).load()).toEqual(EMPTY_PROGRESS);
  });

  it('keeps playing when storage refuses writes, as in private browsing', () => {
    const fake = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    expect(() => createLocalStorage(fake).save(EMPTY_PROGRESS)).not.toThrow();
  });

  it('discards a different schema version rather than guessing a migration', () => {
    expect(reviveProgress({ version: PROGRESS_VERSION + 1, streak: { current: 99 } })).toEqual(
      EMPTY_PROGRESS,
    );
    expect(reviveProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(reviveProgress({ version: PROGRESS_VERSION }).streak.current).toBe(0);
  });

  it('offers an in-memory store for environments with none', () => {
    const storage = createMemoryStorage();
    storage.save({ ...EMPTY_PROGRESS, everMastered: 4 });
    expect(storage.load().everMastered).toBe(4);
    storage.clear();
    expect(storage.load()).toEqual(EMPTY_PROGRESS);
  });
});
