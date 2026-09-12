import { describe, expect, it } from 'vitest';
import { WHEEL, getNode } from '../domain/wheel.js';
import { PROFILES } from '../domain/profiles.js';
import { EMPTY_PROGRESS } from '../progress/types.js';
import { recordCauseEffectRound } from '../progress/store.js';
import {
  CAUSE_EFFECT_HOLES,
  CAUSE_EFFECT_ID,
  answerCauseEffectHole,
  causeEffectPool,
  causeEffectSummary,
  createCauseEffectRound,
  nextCauseEffectRound,
  type CauseEffectRound,
} from './causeEffectRound.js';

const playRound = (round: CauseEffectRound, answer: (profileId: string) => string): CauseEffectRound => {
  let current = round;
  while (!current.complete) {
    current = answerCauseEffectHole(current, answer(current.holes[current.current]!.profileId));
  }
  return current;
};

describe('a Cause & Effect round', () => {
  it('draws one hole per profile, never repeating one in a round', () => {
    for (let seed = 0; seed < 20; seed++) {
      const round = createCauseEffectRound({ seed });
      expect(round.id).toBe(CAUSE_EFFECT_ID);
      expect(round.holes.length).toBe(Math.min(CAUSE_EFFECT_HOLES, causeEffectPool().length));
      expect(new Set(round.holes.map((h) => h.profileId)).size).toBe(round.holes.length);
    }
  });

  it('is reproducible from a seed and varies without one', () => {
    const a = createCauseEffectRound({ seed: 4 }).holes.map((h) => h.profileId);
    const b = createCauseEffectRound({ seed: 4 }).holes.map((h) => h.profileId);
    const c = createCauseEffectRound({ seed: 5 }).holes.map((h) => h.profileId);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('scores the exact descriptor at 100, crediting it as the matched target', () => {
    const round = createCauseEffectRound({ seed: 1 });
    const profile = PROFILES.byId.get(round.holes[0]!.profileId)!;
    const named = profile.descriptors[0]!.nodeId;
    const played = answerCauseEffectHole(round, named);
    expect(played.holes[0]!.result!.score).toBe(100);
    expect(played.holes[0]!.result!.targetId).toBe(named);
  });

  it('scores against the best-matching descriptor, not just the first one', () => {
    // Kenya Nyeri's descriptors include Blackberry; answering with its sibling Raspberry should
    // score as a near miss against Blackberry specifically, not fall back to a worse match.
    const kenya = PROFILES.byId.get('kenya-nyeri-washed-light')!;
    expect(kenya.descriptors.map((d) => d.nodeId)).toContain('fruity.berry.blackberry');

    const round = createCauseEffectRound({ seed: 2 });
    const holeIndex = round.holes.findIndex((h) => h.profileId === kenya.id);
    if (holeIndex === -1) return; // this seed did not draw Kenya - nothing to assert

    let r = round;
    for (let i = 0; i < holeIndex; i++) {
      r = answerCauseEffectHole(r, PROFILES.byId.get(r.holes[i]!.profileId)!.descriptors[0]!.nodeId);
    }
    r = answerCauseEffectHole(r, 'fruity.berry.raspberry');
    expect(r.holes[holeIndex]!.result!.targetId).toBe('fruity.berry.blackberry');
    expect(r.holes[holeIndex]!.result!.relation).toBe('sibling');
  });

  it('a wildly distant answer scores 0 against every descriptor', () => {
    // Yirgacheffe is floral/citrus/sweet; a chemical-fault answer sits in a distant category from
    // all four of its descriptors.
    const yirgacheffe = PROFILES.byId.get('ethiopia-yirgacheffe-washed-light')!;
    let round = createCauseEffectRound({ seed: 3 });
    let holeIndex = round.holes.findIndex((h) => h.profileId === yirgacheffe.id);
    if (holeIndex === -1) {
      round = createCauseEffectRound({
        weights: new Map(causeEffectPool().map((id) => [id, id === yirgacheffe.id ? 1 : 0])),
      });
      holeIndex = 0;
    }

    let r = round;
    for (let i = 0; i < holeIndex; i++) {
      r = answerCauseEffectHole(r, PROFILES.byId.get(r.holes[i]!.profileId)!.descriptors[0]!.nodeId);
    }
    r = answerCauseEffectHole(r, 'other.chemical.rubber');
    expect(r.holes[holeIndex]!.result!.score).toBe(0);
  });

  it('completes and summarises like any round', () => {
    const round = playRound(createCauseEffectRound({ seed: 6 }), (profileId) =>
      PROFILES.byId.get(profileId)!.descriptors[0]!.nodeId,
    );
    expect(round.complete).toBe(true);
    const summary = causeEffectSummary(round);
    expect(summary.answered).toBe(round.holes.length);
    expect(summary.totalScore).toBe(round.holes.length * 100);
    expect(summary.maxScore).toBe(round.holes.length * 100);
  });

  it('respects sampling weights, same as belts and Defect Lab', () => {
    const pool = causeEffectPool();
    // Exactly enough nonzero-weight candidates to fill a round: with CAUSE_EFFECT_HOLES of them at
    // weight 1 and the rest at weight 0, the zero-weight ones can never be drawn.
    const wanted = new Set(pool.slice(0, CAUSE_EFFECT_HOLES));
    const weights = new Map(pool.map((id) => [id, wanted.has(id) ? 1 : 0]));
    for (let seed = 0; seed < 10; seed++) {
      const round = nextCauseEffectRound(() => weights, { seed });
      for (const hole of round.holes) expect(wanted.has(hole.profileId)).toBe(true);
    }
  });
});

describe('recording a Cause & Effect round', () => {
  it('refuses an unfinished round', () => {
    expect(() => recordCauseEffectRound(EMPTY_PROGRESS, createCauseEffectRound({ seed: 1 }))).toThrow(
      /completed round/,
    );
  });

  it('credits the matched target, not an arbitrary node, and feeds the profile', () => {
    const round = playRound(createCauseEffectRound({ seed: 7 }), (profileId) =>
      PROFILES.byId.get(profileId)!.descriptors[0]!.nodeId,
    );
    const p = recordCauseEffectRound(EMPTY_PROGRESS, round, Date.parse('2026-09-12T10:00:00'));

    expect(p.streak.current).toBe(1);
    expect(p.rounds[0]?.beltId).toBe(CAUSE_EFFECT_ID);
    expect(p.answers.count).toBe(round.holes.length);
    expect(p.answers.scoreSum).toBe(round.holes.length * 100);

    const creditedIds = Object.keys(p.attributes);
    const expectedIds = round.holes.map((h) => h.result!.targetId);
    expect(new Set(creditedIds)).toEqual(new Set(expectedIds));

    // Categories rolled up are the categories of the matched targets.
    const expectedCategories = new Set(expectedIds.map((id) => getNode(WHEEL, id).categoryId));
    expect(new Set(Object.keys(p.categories))).toEqual(expectedCategories);
  });
});
