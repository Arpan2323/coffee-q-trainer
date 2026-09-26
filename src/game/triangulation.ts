import { mulberry32 } from './round.js';
import { drawCodes } from '../session/codes.js';
import type { Blinding } from '../session/types.js';

/**
 * Physical triangulation (PLAN.md section 3.2, mode 5): three bowls, two of one coffee and one of
 * another, and the task is to find the odd one. The Q exam's sensory-skills module is built on it
 * because it is the cleanest discrimination test there is - no vocabulary, no scale, no scoring
 * form, just "are these the same". Chance is one in three, and that is the number every result here
 * is measured against (see `TRIANGULATION_CHANCE` in session/log.ts).
 *
 * ## How the blinding actually works
 *
 * The app cannot pour, so it cannot blind anything by itself. What it can do is code the bowls the
 * way a sensory panel does: three-digit codes, written on the *base* of each bowl, assigned to
 * coffees by this module before the taster knows which is which.
 *
 * Self-poured, the sequence is: write the codes on the bases, pour to the sheet below, then shuffle
 * the bowls around the table without tracking them and never look at a base again until a choice is
 * committed. Knowing that code 417 is the odd one is harmless once you have lost track of which bowl
 * 417 is. Helper-poured, the sheet goes to the helper and the taster never sees it at all.
 *
 * **The app cannot verify any of this**, which is why `Blinding` is recorded per session and the two
 * are never added together. A taster who peeks has lied to their own log, and that is a real limit on
 * what the physical track can claim: these numbers are evidence for the taster, not data about the
 * product. Efficacy measurement (STRATEGY.md) needs helper-poured sets or an observer.
 */

export const TRIANGULATION_ID = 'triangulation';

/**
 * Three sets, nine bowls, about the 15 minutes PLAN.md budgets. The Q exam runs six; six is the
 * right number for a calibration claim and the wrong number for a Tuesday, so the count is an
 * option and this is the default.
 */
export const TRIANGULATION_SETS = 3;
export const CUPS_PER_SET = 3;

/** Which of the two coffees a bowl holds. Never shown to the taster before the choice. */
export type CupCoffee = 'A' | 'B';

export interface TriangulationCup {
  /** Three digits, written on the bowl's base. Unique across the whole round, not just the set. */
  readonly code: string;
  readonly coffee: CupCoffee;
}

export interface TriangulationSet {
  readonly cups: readonly TriangulationCup[];
  readonly oddCode: string;
  /** The code the taster read off the base of the bowl they judged odd. */
  readonly pickedCode: string | null;
  readonly correct: boolean | null;
}

export interface TriangulationRound {
  readonly id: typeof TRIANGULATION_ID;
  readonly coffeeA: string;
  readonly coffeeB: string;
  readonly blinding: Blinding;
  readonly sets: readonly TriangulationSet[];
  readonly current: number;
  readonly complete: boolean;
}

export interface TriangulationOptions {
  readonly seed?: number;
  readonly sets?: number;
  /** Free text: whatever the taster calls the two coffees. Only they know what is in the bag. */
  readonly coffeeA?: string;
  readonly coffeeB?: string;
  readonly blinding?: Blinding;
}

export function createTriangulationRound(options: TriangulationOptions = {}): TriangulationRound {
  const setCount = Math.max(1, Math.floor(options.sets ?? TRIANGULATION_SETS));
  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));
  const codes = drawCodes(setCount * CUPS_PER_SET, random);

  const sets = Array.from({ length: setCount }, (_, i): TriangulationSet => {
    const setCodes = codes.slice(i * CUPS_PER_SET, (i + 1) * CUPS_PER_SET);
    // Both which bowl is odd and which coffee is the odd one are drawn per set. Fixing either
    // would let a taster who got one set right infer the next.
    const oddIndex = Math.floor(random() * CUPS_PER_SET);
    const oddCoffee: CupCoffee = random() < 0.5 ? 'A' : 'B';
    const pairCoffee: CupCoffee = oddCoffee === 'A' ? 'B' : 'A';

    return {
      cups: setCodes.map((code, j) => ({ code, coffee: j === oddIndex ? oddCoffee : pairCoffee })),
      oddCode: setCodes[oddIndex]!,
      pickedCode: null,
      correct: null,
    };
  });

  return {
    id: TRIANGULATION_ID,
    coffeeA: options.coffeeA?.trim() || 'Coffee A',
    coffeeB: options.coffeeB?.trim() || 'Coffee B',
    blinding: options.blinding ?? 'self',
    sets,
    current: 0,
    complete: false,
  };
}

/** The pour sheet for one set: which codes get which coffee. The one screen a taster must not read. */
export function pourSheet(set: TriangulationSet): Record<CupCoffee, string[]> {
  return {
    A: set.cups.filter((c) => c.coffee === 'A').map((c) => c.code),
    B: set.cups.filter((c) => c.coffee === 'B').map((c) => c.code),
  };
}

export function isCodeInSet(set: TriangulationSet, code: string): boolean {
  return set.cups.some((c) => c.code === code.trim());
}

/**
 * Commit a choice for the current set. Takes the code the taster read off the base rather than a
 * position, because position is the thing that got shuffled - the app never knew it.
 */
export function pickOddCup(round: TriangulationRound, code: string): TriangulationRound {
  if (round.complete) throw new Error('round is already complete');
  const set = round.sets[round.current];
  if (!set) throw new Error('no set at the current index');
  if (set.pickedCode !== null) throw new Error('set has already been answered');

  const picked = code.trim();
  if (!isCodeInSet(set, picked)) {
    throw new Error(`"${picked}" is not one of this set's codes`);
  }

  const sets = round.sets.map((s, i) =>
    i === round.current ? { ...s, pickedCode: picked, correct: picked === s.oddCode } : s,
  );
  const current = round.current + 1;
  return { ...round, sets, current, complete: current >= sets.length };
}

export interface TriangulationSummary {
  readonly answered: number;
  readonly correct: number;
  readonly total: number;
}

export function triangulationSummary(round: TriangulationRound): TriangulationSummary {
  const answered = round.sets.filter((s) => s.correct !== null);
  return {
    answered: answered.length,
    correct: answered.filter((s) => s.correct === true).length,
    total: round.sets.length,
  };
}
