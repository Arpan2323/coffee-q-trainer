import { describe, expect, it } from 'vitest';
import { homeworkPool, referenceIndexesIn } from '../domain/references.js';
import { EMPTY_SESSION_LOG } from '../session/types.js';
import { recordSession, newSessionId } from '../session/log.js';
import {
  HOMEWORK_DELAY_MS,
  HOMEWORK_ID,
  HOMEWORK_ITEMS,
  answerHomeworkHole,
  createAssignment,
  createHomeworkRound,
  daysUntilDue,
  homeworkIdentifications,
  homeworkSummary,
  isDue,
  type HomeworkRound,
} from './homework.js';

const NOW = 1_700_000_000_000;

const playAllExact = (round: HomeworkRound): HomeworkRound => {
  let current = round;
  while (!current.complete) {
    current = answerHomeworkHole(current, current.holes[current.current]!.targetId);
  }
  return current;
};

describe('a homework assignment', () => {
  it('draws five region-appropriate references', () => {
    const assignment = createAssignment('EU', NOW, { seed: 1 });
    expect(assignment.items).toHaveLength(HOMEWORK_ITEMS);
    expect(assignment.region).toBe('EU');

    for (const item of assignment.items) {
      expect(referenceIndexesIn(item.nodeId, 'EU')).toContain(item.referenceIndex);
    }
  });

  it('never assigns a product that is not sold in the region', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const item of createAssignment('IN', NOW, { seed }).items) {
        expect(referenceIndexesIn(item.nodeId, 'IN')).toContain(item.referenceIndex);
      }
    }
  });

  it('is reproducible from its seed', () => {
    expect(createAssignment('US', NOW, { seed: 5 })).toEqual(createAssignment('US', NOW, { seed: 5 }));
  });

  it('assigns each reference a distinct blinding code and never repeats an attribute', () => {
    const assignment = createAssignment('EU', NOW, { seed: 2, count: 8 });
    const codes = assignment.items.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(assignment.items.map((i) => i.nodeId)).size).toBe(assignment.items.length);
  });

  it('cannot ask for more references than the region has', () => {
    const pool = homeworkPool('IN');
    expect(createAssignment('IN', NOW, { seed: 3, count: pool.length + 50 }).items).toHaveLength(
      pool.length,
    );
  });

  // Weighting reaches homework for real, because the pool is keyed by attribute node id - the same
  // keys `weightsForRound` returns. This is the one mode where the spaced-repetition seam connects.
  it('honours sampling weights', () => {
    const pool = homeworkPool('EU');
    const wanted = pool[7]!;
    const weights = new Map(pool.map((id) => [id, id === wanted ? 10_000 : 0.000_01]));

    const assignment = createAssignment('EU', NOW, { seed: 4, weights, count: 1 });
    expect(assignment.items[0]!.nodeId).toBe(wanted);
  });

  it('refuses a region with no references rather than returning an empty list', () => {
    // No such region exists in the content set today, so this asserts the guard by forcing it.
    expect(() => createAssignment('XX' as never, NOW)).toThrow(/no reference standards/);
  });
});

describe('the delay before the quiz', () => {
  it('is three days, and the quiz is refused until it has passed', () => {
    const assignment = createAssignment('EU', NOW, { seed: 1 });
    expect(assignment.dueAt - assignment.assignedAt).toBe(HOMEWORK_DELAY_MS);

    expect(isDue(assignment, NOW)).toBe(false);
    expect(isDue(assignment, assignment.dueAt - 1)).toBe(false);
    expect(isDue(assignment, assignment.dueAt)).toBe(true);
  });

  it('counts the days still to wait', () => {
    const assignment = createAssignment('EU', NOW, { seed: 1 });
    expect(daysUntilDue(assignment, NOW)).toBe(3);
    expect(daysUntilDue(assignment, assignment.dueAt)).toBe(0);
    expect(daysUntilDue(assignment, assignment.dueAt + 99)).toBe(0);
  });
});

describe('the homework quiz', () => {
  it('covers every assigned reference exactly once', () => {
    const assignment = createAssignment('EU', NOW, { seed: 6 });
    const round = createHomeworkRound(assignment, { seed: 6 });

    expect(round.id).toBe(HOMEWORK_ID);
    expect(round.region).toBe('EU');
    expect(round.holes.map((h) => h.code).sort()).toEqual(
      assignment.items.map((i) => i.code).sort(),
    );
  });

  // Quizzed in assignment order, a taster works down the shopping list instead of smelling.
  it('presents the samples in a different order from the assignment', () => {
    const assignment = createAssignment('EU', NOW, { seed: 7, count: 8 });
    const orders = [1, 2, 3, 4, 5].map((seed) =>
      createHomeworkRound(assignment, { seed }).holes.map((h) => h.code).join(),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it('scores an answer with the same engine screen play uses', () => {
    const assignment = createAssignment('EU', NOW, { seed: 8 });
    const round = createHomeworkRound(assignment, { seed: 8 });
    const exact = answerHomeworkHole(round, round.holes[0]!.targetId);

    expect(exact.holes[0]!.result!.score).toBe(100);
    expect(exact.holes[0]!.result!.relation).toBe('exact');
    expect(exact.current).toBe(1);
  });

  it('gives partial credit for a near miss, as it would on the wheel', () => {
    const assignment = createAssignment('EU', NOW, { seed: 9 });
    const round = createHomeworkRound(assignment, { seed: 9 });
    // Answer the category rather than the leaf: a real answer, just a vague one.
    const category = round.holes[0]!.targetId.split('.')[0]!;
    const played = answerHomeworkHole(round, category);

    expect(played.holes[0]!.result!.score).toBeGreaterThan(0);
    expect(played.holes[0]!.result!.relation).not.toBe('exact');
  });

  it('refuses a second answer and anything after completion', () => {
    const round = createHomeworkRound(createAssignment('EU', NOW, { seed: 10 }), { seed: 10 });
    const played = playAllExact(round);

    expect(played.complete).toBe(true);
    expect(() => answerHomeworkHole(played, 'fruity')).toThrow(/already complete/);

    const oneAnswered = answerHomeworkHole(round, round.holes[0]!.targetId);
    expect(() => answerHomeworkHole({ ...oneAnswered, current: 0 }, 'fruity')).toThrow(
      /already been answered/,
    );
  });

  it('summarises what was smelled and named', () => {
    const played = playAllExact(
      createHomeworkRound(createAssignment('EU', NOW, { seed: 11 }), { seed: 11 }),
    );
    const summary = homeworkSummary(played);

    expect(summary.answered).toBe(HOMEWORK_ITEMS);
    expect(summary.exactCount).toBe(HOMEWORK_ITEMS);
    expect(summary.accuracy).toBe(100);
  });

  it('hands the session log a graded identification per sample', () => {
    const played = playAllExact(
      createHomeworkRound(createAssignment('EU', NOW, { seed: 12 }), { seed: 12 }),
    );
    const items = homeworkIdentifications(played);

    expect(items).toHaveLength(HOMEWORK_ITEMS);
    for (const item of items) {
      expect(item.exact).toBe(true);
      expect(item.answerId).toBe(item.targetId);
    }

    const log = recordSession(EMPTY_SESSION_LOG, {
      id: newSessionId('homework', NOW),
      at: NOW,
      durationSec: 300,
      note: '',
      detail: { kind: 'homework', region: 'EU', blinding: 'self', items },
    });
    expect(log.identification.attempts).toBe(HOMEWORK_ITEMS);
    expect(Object.keys(log.named)).toHaveLength(HOMEWORK_ITEMS);
  });
});
