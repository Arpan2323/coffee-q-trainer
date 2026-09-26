import { describe, expect, it } from 'vitest';
import { mulberry32 } from './round.js';
import { drawCodes } from '../session/codes.js';
import {
  CUPS_PER_SET,
  TRIANGULATION_ID,
  TRIANGULATION_SETS,
  createTriangulationRound,
  isCodeInSet,
  pickOddCup,
  pourSheet,
  triangulationSummary,
  type TriangulationRound,
} from './triangulation.js';

const playAllCorrect = (round: TriangulationRound): TriangulationRound => {
  let current = round;
  while (!current.complete) {
    current = pickOddCup(current, current.sets[current.current]!.oddCode);
  }
  return current;
};

describe('a triangulation round', () => {
  it('builds three sets of three coded bowls by default', () => {
    const round = createTriangulationRound({ seed: 7 });
    expect(round.id).toBe(TRIANGULATION_ID);
    expect(round.sets).toHaveLength(TRIANGULATION_SETS);
    for (const set of round.sets) {
      expect(set.cups).toHaveLength(CUPS_PER_SET);
    }
  });

  it('is reproducible from its seed', () => {
    const a = createTriangulationRound({ seed: 42 });
    const b = createTriangulationRound({ seed: 42 });
    expect(a).toEqual(b);
    expect(createTriangulationRound({ seed: 43 })).not.toEqual(a);
  });

  // A code is what the taster reports, so a code appearing in two sets makes the record ambiguous.
  it('never repeats a code across the whole round', () => {
    const round = createTriangulationRound({ seed: 3, sets: 8 });
    const codes = round.sets.flatMap((s) => s.cups.map((c) => c.code));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('puts exactly one odd bowl in every set', () => {
    const round = createTriangulationRound({ seed: 11, sets: 12 });
    for (const set of round.sets) {
      const coffees = set.cups.map((c) => c.coffee);
      const odd = set.cups.find((c) => c.code === set.oddCode)!;
      expect(coffees.filter((c) => c === odd.coffee)).toHaveLength(1);
      expect(coffees.filter((c) => c !== odd.coffee)).toHaveLength(2);
    }
  });

  // If the odd coffee were always B, a taster who got one set right could infer the rest.
  it('varies which of the two coffees is the odd one', () => {
    const round = createTriangulationRound({ seed: 5, sets: 20 });
    const oddCoffees = round.sets.map((s) => s.cups.find((c) => c.code === s.oddCode)!.coffee);
    expect(new Set(oddCoffees).size).toBe(2);
  });

  it('varies which position in the set is odd', () => {
    const round = createTriangulationRound({ seed: 9, sets: 20 });
    const positions = round.sets.map((s) => s.cups.findIndex((c) => c.code === s.oddCode));
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it('names the coffees the taster gave it, and falls back to placeholders', () => {
    expect(createTriangulationRound({ seed: 1, coffeeA: ' Guji ' }).coffeeA).toBe('Guji');
    expect(createTriangulationRound({ seed: 1, coffeeA: '   ' }).coffeeA).toBe('Coffee A');
  });

  it('defaults to self-poured, the weaker blinding, rather than claiming a helper', () => {
    expect(createTriangulationRound({ seed: 1 }).blinding).toBe('self');
    expect(createTriangulationRound({ seed: 1, blinding: 'helper' }).blinding).toBe('helper');
  });
});

describe('the pour sheet', () => {
  it('splits the set into the two coffees', () => {
    const round = createTriangulationRound({ seed: 2 });
    const sheet = pourSheet(round.sets[0]!);
    expect(sheet.A.length + sheet.B.length).toBe(CUPS_PER_SET);
    expect([sheet.A.length, sheet.B.length].sort()).toEqual([1, 2]);
  });
});

describe('picking the odd bowl', () => {
  it('grades the code the taster read and advances', () => {
    const round = createTriangulationRound({ seed: 4 });
    const played = pickOddCup(round, round.sets[0]!.oddCode);

    expect(played.sets[0]!.correct).toBe(true);
    expect(played.sets[0]!.pickedCode).toBe(round.sets[0]!.oddCode);
    expect(played.current).toBe(1);
  });

  it('marks a wrong code wrong without losing what was picked', () => {
    const round = createTriangulationRound({ seed: 4 });
    const wrong = round.sets[0]!.cups.find((c) => c.code !== round.sets[0]!.oddCode)!.code;
    const played = pickOddCup(round, wrong);

    expect(played.sets[0]!.correct).toBe(false);
    expect(played.sets[0]!.pickedCode).toBe(wrong);
  });

  it('tolerates a code typed with stray spaces', () => {
    const round = createTriangulationRound({ seed: 4 });
    expect(pickOddCup(round, ` ${round.sets[0]!.oddCode} `).sets[0]!.correct).toBe(true);
  });

  // A code from another set is a mis-read base, not an answer. Accepting it would score a set the
  // taster never actually judged.
  it('refuses a code that is not in the current set', () => {
    const round = createTriangulationRound({ seed: 4 });
    const otherSetCode = round.sets[1]!.cups[0]!.code;
    expect(() => pickOddCup(round, otherSetCode)).toThrow(/not one of this set/);
    expect(() => pickOddCup(round, '000')).toThrow(/not one of this set/);
  });

  it('refuses a second answer for the same set', () => {
    const round = createTriangulationRound({ seed: 4 });
    const played = pickOddCup(round, round.sets[0]!.oddCode);
    expect(() => pickOddCup({ ...played, current: 0 }, round.sets[0]!.cups[0]!.code)).toThrow(
      /already been answered/,
    );
  });

  it('completes after the last set and refuses anything further', () => {
    const played = playAllCorrect(createTriangulationRound({ seed: 6 }));
    expect(played.complete).toBe(true);
    expect(() => pickOddCup(played, '123')).toThrow(/already complete/);
  });
});

describe('the triangulation summary', () => {
  it('counts only the sets that were judged', () => {
    const round = createTriangulationRound({ seed: 8 });
    expect(triangulationSummary(round)).toEqual({ answered: 0, correct: 0, total: 3 });

    const one = pickOddCup(round, round.sets[0]!.oddCode);
    expect(triangulationSummary(one)).toEqual({ answered: 1, correct: 1, total: 3 });
    expect(triangulationSummary(playAllCorrect(round)).correct).toBe(3);
  });
});

describe('blinding codes', () => {
  it('draws distinct three-digit codes', () => {
    const codes = drawCodes(40, mulberry32(1));
    expect(new Set(codes).size).toBe(40);
    for (const code of codes) expect(code).toMatch(/^[1-9][0-9]{2}$/);
  });

  it('is reproducible from the same PRNG seed', () => {
    expect(drawCodes(5, mulberry32(99))).toEqual(drawCodes(5, mulberry32(99)));
  });

  it('checks membership on the trimmed code', () => {
    const set = createTriangulationRound({ seed: 1 }).sets[0]!;
    expect(isCodeInSet(set, ` ${set.cups[0]!.code}`)).toBe(true);
    expect(isCodeInSet(set, '000')).toBe(false);
  });
});
