import { describe, expect, it } from 'vitest';
import type { RoundRecord } from '../progress/types.js';
import { bestVsPar, currentBelt, earnedBeltIds, unlockedBeltIds } from './beltProgress.js';
import { PAR_PER_HOLE } from './round.js';

const round = (beltId: string, vsPar: number, at = 0): RoundRecord => ({
  at,
  beltId,
  totalScore: 9 * PAR_PER_HOLE + vsPar,
  maxScore: 900,
  specificityIndex: 2,
  hedgeRate: 0,
  exactCount: 0,
  holes: 9,
});

describe('belt progress', () => {
  it('starts with only the first belt open', () => {
    expect([...unlockedBeltIds([])]).toEqual(['nine-doors']);
    expect(currentBelt([]).id).toBe('nine-doors');
  });

  it('keeps the best score per belt', () => {
    const best = bestVsPar([round('nine-doors', -20), round('nine-doors', 30), round('nine-doors', 5)]);
    expect(best.get('nine-doors')).toBe(30);
  });

  it('opens the next belt only at par or better', () => {
    expect(unlockedBeltIds([round('nine-doors', -1)]).has('branching')).toBe(false);
    expect(unlockedBeltIds([round('nine-doors', 0)]).has('branching')).toBe(true);
    expect(currentBelt([round('nine-doors', 0)]).id).toBe('branching');
  });

  it('does not skip a belt', () => {
    const unlocked = unlockedBeltIds([round('nine-doors', 10)]);
    expect(unlocked.has('leaves')).toBe(false);
  });

  it('treats a played deeper belt as proof the earlier one was earned', () => {
    // The qualifying Nine Doors round has aged out of the capped history; Branching rounds remain.
    const rounds = [round('branching', -40)];
    expect(earnedBeltIds(rounds).has('nine-doors')).toBe(true);
    expect(unlockedBeltIds(rounds).has('branching')).toBe(true);
  });

  it('ignores rounds that are not belts', () => {
    expect([...unlockedBeltIds([round('defects', 100)])]).toEqual(['nine-doors']);
  });
});
