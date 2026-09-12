import { describe, expect, it } from 'vitest';
import {
  CATEGORY_GAP_DEGREES,
  CONFUSABLES,
  WHEEL,
  ancestorsOf,
  buildWheel,
  categoryGap,
  getNode,
  isAncestor,
  lowestCommonAncestor,
  nodesInRing,
  terminals,
} from './wheel.js';
import { wheelSourceSchema } from './schema.js';
import { scoreAnswer } from './scoring.js';

describe('taxonomy shape', () => {
  it('has nine categories in the canonical clockwise order', () => {
    expect(WHEEL.categoryOrder).toEqual([
      'fruity',
      'sour-fermented',
      'green-vegetative',
      'other',
      'roasted',
      'spices',
      'nutty-cocoa',
      'sweet',
      'floral',
    ]);
  });

  it('holds 110 attributes across three rings', () => {
    expect(nodesInRing(WHEEL, 1)).toHaveLength(9);
    expect(nodesInRing(WHEEL, 2)).toHaveLength(28);
    expect(nodesInRing(WHEEL, 3)).toHaveLength(73);
    expect(WHEEL.nodes.size).toBe(110);
  });

  it('offers 85 terminal nodes a player can commit to', () => {
    // 73 ring-3 leaves plus the 12 ring-2 attributes that have no children of their own
    // (Olive Oil, Raw, Beany, Pipe Tobacco, Tobacco, Pungent, Pepper, Vanilla, Vanillin,
    // Overall Sweet, Sweet Aromatics, Black Tea).
    const t = terminals(WHEEL);
    expect(t).toHaveLength(85);
    expect(t.filter((n) => n.ring === 2)).toHaveLength(12);
  });

  it('gives every node a path id that matches its ancestry', () => {
    for (const node of WHEEL.nodes.values()) {
      const chain = [...ancestorsOf(WHEEL, node.id).map((a) => a.localId), node.localId];
      expect(node.id).toBe(chain.join('.'));
      expect(node.id.split('.')).toHaveLength(node.ring);
    }
  });

  it('inherits colour from the ring-1 category', () => {
    for (const node of WHEEL.nodes.values()) {
      expect(node.color).toBe(getNode(WHEEL, node.categoryId).color);
    }
  });

  it('rejects a fourth ring at the schema level', () => {
    const overDeep = {
      version: '0.0.0',
      categories: [
        {
          id: 'fruity',
          label: 'Fruity',
          color: '#D6455B',
          children: [
            {
              id: 'berry',
              label: 'Berry',
              children: [
                { id: 'blackberry', label: 'Blackberry', children: [{ id: 'x', label: 'X' }] },
              ],
            },
          ],
        },
      ],
    };
    expect(wheelSourceSchema.safeParse(overDeep).success).toBe(false);
  });

  it('refuses duplicate ids under one parent', () => {
    const dupe = {
      version: '0.0.0',
      categories: [
        {
          id: 'fruity',
          label: 'Fruity',
          color: '#D6455B',
          children: [
            { id: 'berry', label: 'Berry', children: [{ id: 'x', label: 'X' }] },
            { id: 'berry', label: 'Berry again' },
          ],
        },
      ],
    };
    expect(() => buildWheel(wheelSourceSchema.parse(dupe))).toThrow(/duplicate node id/);
  });
});

describe('wedge geometry', () => {
  it('tiles the full circle once gaps are accounted for', () => {
    const categories = WHEEL.categoryOrder.map((id) => getNode(WHEEL, id));
    const spans = categories.reduce((sum, c) => sum + (c.angle.end - c.angle.start), 0);
    expect(spans + CATEGORY_GAP_DEGREES * categories.length).toBeCloseTo(360, 6);
  });

  it('sizes each wedge in proportion to the attributes it contains', () => {
    const fruity = getNode(WHEEL, 'fruity');
    const floral = getNode(WHEEL, 'floral');
    expect(fruity.leafCount).toBe(18);
    expect(floral.leafCount).toBe(4);
    const ratio =
      (fruity.angle.end - fruity.angle.start) / (floral.angle.end - floral.angle.start);
    expect(ratio).toBeCloseTo(18 / 4, 6);
  });

  it('packs children edge to edge inside their parent', () => {
    for (const parent of WHEEL.nodes.values()) {
      if (parent.childIds.length === 0) continue;
      const children = parent.childIds.map((id) => getNode(WHEEL, id));
      expect(children[0]!.angle.start).toBeCloseTo(parent.angle.start, 6);
      expect(children.at(-1)!.angle.end).toBeCloseTo(parent.angle.end, 6);
      for (let i = 1; i < children.length; i++) {
        expect(children[i]!.angle.start).toBeCloseTo(children[i - 1]!.angle.end, 6);
      }
    }
  });

  it('never lets two categories overlap', () => {
    const sorted = WHEEL.categoryOrder
      .map((id) => getNode(WHEEL, id))
      .sort((a, b) => a.angle.start - b.angle.start);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.angle.start).toBeGreaterThanOrEqual(sorted[i - 1]!.angle.end);
    }
  });
});

describe('tree navigation', () => {
  it('walks ancestors root first', () => {
    expect(ancestorsOf(WHEEL, 'fruity.berry.blackberry').map((n) => n.id)).toEqual([
      'fruity',
      'fruity.berry',
    ]);
    expect(ancestorsOf(WHEEL, 'fruity')).toEqual([]);
  });

  it('treats ancestry as strict', () => {
    expect(isAncestor(WHEEL, 'fruity', 'fruity.berry.blackberry')).toBe(true);
    expect(isAncestor(WHEEL, 'fruity.berry.blackberry', 'fruity')).toBe(false);
    expect(isAncestor(WHEEL, 'fruity', 'fruity')).toBe(false);
  });

  it('finds the lowest common ancestor, or none across categories', () => {
    expect(lowestCommonAncestor(WHEEL, 'fruity.berry.blackberry', 'fruity.berry.raspberry')?.id).toBe(
      'fruity.berry',
    );
    expect(
      lowestCommonAncestor(WHEEL, 'fruity.berry.blackberry', 'fruity.dried-fruit.raisin')?.id,
    ).toBe('fruity');
    expect(lowestCommonAncestor(WHEEL, 'sweet.vanilla', 'sweet.vanillin')?.id).toBe('sweet');
    expect(lowestCommonAncestor(WHEEL, 'fruity.berry.blackberry', 'other.chemical.rubber')).toBeNull();
  });

  it('measures category separation around the wheel, wrapping at the seam', () => {
    // Floral sits last in the array and Fruity first, but they are neighbours on the wheel -
    // which is perceptually right, and the reason the gap is cyclic rather than linear.
    expect(categoryGap(WHEEL, 'floral', 'fruity')).toBe(1);
    expect(categoryGap(WHEEL, 'fruity', 'sour-fermented')).toBe(1);
    expect(categoryGap(WHEEL, 'fruity', 'fruity.berry.blackberry')).toBe(0);
    expect(categoryGap(WHEEL, 'fruity', 'other')).toBe(3);
    expect(categoryGap(WHEEL, 'green-vegetative', 'roasted')).toBe(2);
  });

  it('throws on an unknown id rather than returning a silent default', () => {
    expect(() => getNode(WHEEL, 'fruity.berry.durian')).toThrow(/unknown wheel node/);
  });
});

describe('confusable table', () => {
  it('resolves every referenced node and stays symmetric', () => {
    for (const pair of CONFUSABLES.pairs) {
      expect(WHEEL.nodes.has(pair.a)).toBe(true);
      expect(WHEEL.nodes.has(pair.b)).toBe(true);
      expect(CONFUSABLES.byNode.get(pair.a)?.get(pair.b)).toBe(pair);
      expect(CONFUSABLES.byNode.get(pair.b)?.get(pair.a)).toBe(pair);
    }
  });

  it('carries no dead entries', () => {
    // An entry that scores at or below its own structural base teaches nothing and hides the
    // fact that the table is doing no work. Every pair must beat the tree.
    const dead = CONFUSABLES.pairs.filter((pair) => {
      const result = scoreAnswer(WHEEL, CONFUSABLES, pair.a, pair.b);
      return result.relation !== 'confusable';
    });
    expect(dead.map((p) => `${p.a} <-> ${p.b}`)).toEqual([]);
  });

  it('does not restate sibling relationships the tree already credits', () => {
    for (const pair of CONFUSABLES.pairs) {
      const lca = lowestCommonAncestor(WHEEL, pair.a, pair.b);
      expect(lca?.ring, `${pair.a} <-> ${pair.b} are ring-3 siblings`).not.toBe(2);
    }
  });

  it('explains itself, and admits it is not yet reviewed', () => {
    for (const pair of CONFUSABLES.pairs) {
      expect(pair.note.length).toBeGreaterThan(40);
    }
    expect(CONFUSABLES.reviewStatus).toBe('provisional');
  });
});
