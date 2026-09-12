import { roastTrendsSourceSchema, type RoastTrend, type RoastTrendsSource } from './schema.js';
import type { Wheel } from './types.js';
import { WHEEL } from './wheel.js';
import roastTrendsJson from '../data/roastTrends.json' with { type: 'json' };

export interface RoastTrendSet {
  readonly version: string;
  readonly reviewStatus: string;
  readonly byCategory: ReadonlyMap<string, RoastTrend>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Built the same way `buildConfusables` and `buildProfiles` are: validate against the wheel at load
 * time. Perturbation asks about every ring-1 category every round, so a category missing its trend
 * would be a silent gap in the round rather than a load-time error - full coverage is asserted here
 * specifically so that can't happen.
 */
export function buildRoastTrends(source: RoastTrendsSource, wheel: Wheel): RoastTrendSet {
  const byCategory = new Map<string, RoastTrend>();

  for (const trend of source.trends) {
    assert(
      wheel.categoryOrder.includes(trend.categoryId),
      `roast trend for "${trend.categoryId}" is not a ring-1 category`,
    );
    assert(!byCategory.has(trend.categoryId), `duplicate roast trend for "${trend.categoryId}"`);
    byCategory.set(trend.categoryId, trend);
  }

  for (const categoryId of wheel.categoryOrder) {
    assert(byCategory.has(categoryId), `category "${categoryId}" has no roast trend`);
  }

  return { version: source.version, reviewStatus: source.reviewStatus, byCategory };
}

export const ROAST_TRENDS: RoastTrendSet = buildRoastTrends(
  roastTrendsSourceSchema.parse(roastTrendsJson),
  WHEEL,
);
