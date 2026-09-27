import type { RoundRecord } from '../progress/types.js';
import { BELTS, type Belt } from './belts.js';
import { PAR_PER_HOLE } from './round.js';

/** A recorded round's score against par, on the same points scale as `roundSummary().vsPar`. */
export function recordVsPar(record: RoundRecord): number {
  return record.totalScore - record.holes * PAR_PER_HOLE;
}

/** Best score against par per belt id, over the round history. Belts never played are absent. */
export function bestVsPar(rounds: readonly RoundRecord[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const record of rounds) {
    const vs = recordVsPar(record);
    const prev = best.get(record.beltId);
    if (prev === undefined || vs > prev) best.set(record.beltId, vs);
  }
  return best;
}

/**
 * A belt is earned by finishing a round of it at par or better. Playing a deeper belt also counts
 * as having earned the ones before it: the round history is capped, and a belt that relocks
 * because its qualifying round aged out of the log would read as the app taking progress back.
 */
export function earnedBeltIds(rounds: readonly RoundRecord[]): Set<string> {
  const best = bestVsPar(rounds);
  const earned = new Set<string>();
  BELTS.forEach((belt, i) => {
    const played = (best.get(belt.id) ?? -Infinity) >= 0;
    const deeper = BELTS.slice(i + 1).some((b) => best.has(b.id));
    if (played || deeper) earned.add(belt.id);
  });
  return earned;
}

/** The first belt is always open; each later one opens when the belt before it is earned. */
export function unlockedBeltIds(rounds: readonly RoundRecord[]): Set<string> {
  const earned = earnedBeltIds(rounds);
  return new Set(BELTS.filter((_, i) => i === 0 || earned.has(BELTS[i - 1]!.id)).map((b) => b.id));
}

/** The deepest unlocked belt: where the player is working now. */
export function currentBelt(rounds: readonly RoundRecord[]): Belt {
  const unlocked = unlockedBeltIds(rounds);
  return [...BELTS].reverse().find((b) => unlocked.has(b.id)) ?? BELTS[0]!;
}
