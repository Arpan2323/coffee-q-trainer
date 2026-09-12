export const PROGRESS_VERSION = 2;

export interface StreakState {
  readonly current: number;
  readonly longest: number;
  /** Local calendar day, YYYY-MM-DD. Local because "did I practise today" is a local question. */
  readonly lastDay: string | null;
  readonly daysPlayed: number;
}

export interface AttributeStat {
  readonly attempts: number;
  readonly totalScore: number;
  readonly lastAt: number;
  /**
   * Timestamps of exact answers that counted toward mastery. A second exact answer inside the
   * spacing window does not get an entry, which is what stops mastery being crammed in one sitting.
   */
  readonly countedExact: readonly number[];
  readonly masteredAt: number | null;
  readonly lapses: number;
}

/**
 * Lifetime answer aggregates, kept as running sums so the Palate Profile axes are a division rather
 * than a replay of every attempt. `ringSum / count` is the specificity index over all play, not
 * just the last round; `scoreSum / count` is accuracy; `hedges / count` is the lifetime hedge rate.
 */
export interface AnswerTotals {
  readonly count: number;
  readonly scoreSum: number;
  readonly ringSum: number;
  readonly hedges: number;
}

/** Per-category rollup, keyed by category id. Feeds the coverage axis and the blind-sector callout. */
export interface CategoryStat {
  readonly attempts: number;
  readonly scoreSum: number;
  readonly exactCount: number;
}

/**
 * One cell of the confusion matrix: the clue was written for `targetId`, the player committed to
 * `answerId`, and it has happened `count` times. Only genuine misses are recorded - an exact answer
 * is not a confusion - and the list is capped, evicting the least-frequent pair, because this is a
 * progress record and not an audit log.
 */
export interface ConfusionEntry {
  readonly targetId: string;
  readonly answerId: string;
  readonly count: number;
  readonly lastAt: number;
}

/**
 * A tally of binary guesses: how many, how many right. Shared shape for the two Cause & Effect
 * directions that don't fit the attribute-mastery model - Reverse (a process guess) and Perturbation
 * (a roast-trend guess) - neither has a wheel node to credit, so each gets its own small lifetime
 * tally rather than being forced through `attributes`/`categories`/`vocab`.
 */
export interface GuessStats {
  readonly attempts: number;
  readonly correct: number;
}

export interface RoundRecord {
  readonly at: number;
  readonly beltId: string;
  readonly totalScore: number;
  readonly maxScore: number;
  readonly specificityIndex: number;
  readonly hedgeRate: number;
  readonly exactCount: number;
  readonly holes: number;
}

export interface Progress {
  readonly version: number;
  readonly streak: StreakState;
  /** Newest last, capped - this is a progress record, not an audit log. */
  readonly rounds: readonly RoundRecord[];
  readonly attributes: Readonly<Record<string, AttributeStat>>;
  /** Counts mastery events ever earned, so the decay rate has a denominator. */
  readonly everMastered: number;
  readonly lapses: number;
  readonly answers: AnswerTotals;
  readonly categories: Readonly<Record<string, CategoryStat>>;
  /** Newest activity last is not guaranteed; sorted by count descending when surfaced. Capped. */
  readonly confusions: readonly ConfusionEntry[];
  /** Distinct descriptors the player has committed to, and how often. "Breadth" is its size. */
  readonly vocab: Readonly<Record<string, number>>;
  readonly reverse: GuessStats;
  readonly perturbation: GuessStats;
}

export const EMPTY_ANSWER_TOTALS: AnswerTotals = { count: 0, scoreSum: 0, ringSum: 0, hedges: 0 };
export const EMPTY_GUESS_STATS: GuessStats = { attempts: 0, correct: 0 };

export const EMPTY_PROGRESS: Progress = {
  version: PROGRESS_VERSION,
  streak: { current: 0, longest: 0, lastDay: null, daysPlayed: 0 },
  rounds: [],
  attributes: {},
  everMastered: 0,
  lapses: 0,
  answers: EMPTY_ANSWER_TOTALS,
  categories: {},
  confusions: [],
  vocab: {},
  reverse: EMPTY_GUESS_STATS,
  perturbation: EMPTY_GUESS_STATS,
};
