import { describe, expect, it } from 'vitest';
import { WHEEL } from './wheel.js';
import { roastTrendsSourceSchema } from './schema.js';
import { ROAST_TRENDS, buildRoastTrends } from './roastTrends.js';
import roastTrendsJson from '../data/roastTrends.json' with { type: 'json' };

describe('roast trends', () => {
  it('covers every ring-1 category exactly once', () => {
    expect(ROAST_TRENDS.byCategory.size).toBe(WHEEL.categoryOrder.length);
    for (const categoryId of WHEEL.categoryOrder) {
      expect(ROAST_TRENDS.byCategory.has(categoryId)).toBe(true);
    }
  });

  it('is provisional and every entry has a note explaining the direction', () => {
    expect(ROAST_TRENDS.reviewStatus).toBe('provisional');
    for (const trend of ROAST_TRENDS.byCategory.values()) {
      expect(['up', 'down', 'mixed']).toContain(trend.direction);
      expect(trend.note.length).toBeGreaterThan(0);
    }
  });

  it('rejects a trend for a category the wheel does not have', () => {
    const source = roastTrendsSourceSchema.parse(roastTrendsJson);
    const bad = {
      ...source,
      trends: [...source.trends, { categoryId: 'nonexistent', direction: 'up' as const, note: 'x' }],
    };
    expect(() => buildRoastTrends(bad, WHEEL)).toThrow(/not a ring-1 category/);
  });

  it('rejects a duplicate trend for the same category', () => {
    const source = roastTrendsSourceSchema.parse(roastTrendsJson);
    const dup = { ...source, trends: [...source.trends, source.trends[0]!] };
    expect(() => buildRoastTrends(dup, WHEEL)).toThrow(/duplicate/);
  });

  it('rejects incomplete coverage', () => {
    const source = roastTrendsSourceSchema.parse(roastTrendsJson);
    const incomplete = { ...source, trends: source.trends.slice(1) };
    expect(() => buildRoastTrends(incomplete, WHEEL)).toThrow(/has no roast trend/);
  });
});
