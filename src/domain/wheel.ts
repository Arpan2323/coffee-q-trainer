import type { ConfusablePair, ConfusableSet, Ring, Wheel, WheelNode } from './types.js';
import {
  confusableSourceSchema,
  wheelSourceSchema,
  type ConfusableSource,
  type WheelSource,
} from './schema.js';
import wheelJson from '../data/wheel.json' with { type: 'json' };
import confusablesJson from '../data/confusables.json' with { type: 'json' };

/** Degrees of empty space between adjacent categories. */
export const CATEGORY_GAP_DEGREES = 2;

/**
 * The published wheel uses variable gap widths to encode how far apart two categories sit
 * perceptually. Reproducing those widths needs the underlying sorting data, which we do not have,
 * so gaps are uniform for now and adjacency is treated as binary by the scoring engine. Revisit
 * when the wheel is rendered - see PLAN.md section 2.1.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function buildWheel(source: WheelSource): Wheel {
  const nodes = new Map<string, WheelNode>();
  const categoryOrder = source.categories.map((c) => c.id);

  assert(
    new Set(categoryOrder).size === categoryOrder.length,
    'duplicate category id in wheel source',
  );

  const leafCountPerCategory = source.categories.map((cat) =>
    cat.children.reduce((n, mid) => n + (mid.children?.length ?? 1), 0),
  );
  const totalLeaves = leafCountPerCategory.reduce((a, b) => a + b, 0);
  const usableDegrees = 360 - CATEGORY_GAP_DEGREES * source.categories.length;

  const add = (node: WheelNode): void => {
    assert(!nodes.has(node.id), `duplicate node id "${node.id}"`);
    nodes.set(node.id, node);
  };

  let cursor = 0;

  source.categories.forEach((cat, catIndex) => {
    const catLeaves = leafCountPerCategory[catIndex] ?? 0;
    const catSpan = (usableDegrees * catLeaves) / totalLeaves;
    const catStart = cursor;

    const midIds: string[] = [];
    let midCursor = catStart;

    for (const mid of cat.children) {
      const midId = `${cat.id}.${mid.id}`;
      const midLeaves = mid.children?.length ?? 1;
      const midSpan = (catSpan * midLeaves) / catLeaves;
      const midStart = midCursor;

      const childIds: string[] = [];
      if (mid.children) {
        const childSpan = midSpan / mid.children.length;
        mid.children.forEach((leaf, leafIndex) => {
          const leafId = `${midId}.${leaf.id}`;
          childIds.push(leafId);
          add({
            id: leafId,
            localId: leaf.id,
            label: leaf.label,
            ring: 3,
            parentId: midId,
            categoryId: cat.id,
            childIds: [],
            color: cat.color,
            defect: leaf.defect ?? null,
            angle: {
              start: midStart + childSpan * leafIndex,
              end: midStart + childSpan * (leafIndex + 1),
            },
            leafCount: 1,
          });
        });
      }

      midIds.push(midId);
      add({
        id: midId,
        localId: mid.id,
        label: mid.label,
        ring: 2,
        parentId: cat.id,
        categoryId: cat.id,
        childIds,
        color: cat.color,
        defect: mid.defect ?? null,
        angle: { start: midStart, end: midStart + midSpan },
        leafCount: midLeaves,
      });

      midCursor += midSpan;
    }

    add({
      id: cat.id,
      localId: cat.id,
      label: cat.label,
      ring: 1,
      parentId: null,
      categoryId: cat.id,
      childIds: midIds,
      color: cat.color,
      defect: null,
      angle: { start: catStart, end: catStart + catSpan },
      leafCount: catLeaves,
    });

    cursor = catStart + catSpan + CATEGORY_GAP_DEGREES;
  });

  return { version: source.version, nodes, categoryOrder };
}

export function buildConfusables(source: ConfusableSource, wheel: Wheel): ConfusableSet {
  const byNode = new Map<string, Map<string, ConfusablePair>>();
  const pairs: ConfusablePair[] = [];

  for (const raw of source.pairs) {
    assert(wheel.nodes.has(raw.a), `confusable references unknown node "${raw.a}"`);
    assert(wheel.nodes.has(raw.b), `confusable references unknown node "${raw.b}"`);
    assert(raw.a !== raw.b, `confusable pairs a node with itself: "${raw.a}"`);

    const existing = byNode.get(raw.a)?.get(raw.b);
    assert(!existing, `duplicate confusable pair "${raw.a}" <-> "${raw.b}"`);

    const pair: ConfusablePair = { a: raw.a, b: raw.b, weight: raw.weight, note: raw.note };
    pairs.push(pair);

    for (const [from, to] of [
      [raw.a, raw.b],
      [raw.b, raw.a],
    ] as const) {
      let entry = byNode.get(from);
      if (!entry) {
        entry = new Map();
        byNode.set(from, entry);
      }
      entry.set(to, pair);
    }
  }

  return { version: source.version, reviewStatus: source.reviewStatus, byNode, pairs };
}

export function getNode(wheel: Wheel, id: string): WheelNode {
  const node = wheel.nodes.get(id);
  if (!node) throw new Error(`unknown wheel node "${id}"`);
  return node;
}

/** Root-first: [category] for a ring-2 node, [category, mid] for a ring-3 node. */
export function ancestorsOf(wheel: Wheel, id: string): WheelNode[] {
  const out: WheelNode[] = [];
  let current = getNode(wheel, id).parentId;
  while (current !== null) {
    const node = getNode(wheel, current);
    out.unshift(node);
    current = node.parentId;
  }
  return out;
}

/** Strict: a node is not its own ancestor. */
export function isAncestor(wheel: Wheel, ancestorId: string, descendantId: string): boolean {
  if (ancestorId === descendantId) return false;
  return ancestorsOf(wheel, descendantId).some((n) => n.id === ancestorId);
}

/** Null when the two nodes sit in different categories - the wheel has no shared root node. */
export function lowestCommonAncestor(wheel: Wheel, aId: string, bId: string): WheelNode | null {
  const a = getNode(wheel, aId);
  const b = getNode(wheel, bId);
  if (a.categoryId !== b.categoryId) return null;

  const aChain = [...ancestorsOf(wheel, aId), a].map((n) => n.id);
  const bChain = new Set([...ancestorsOf(wheel, bId), b].map((n) => n.id));

  let best: WheelNode | null = null;
  for (const id of aChain) {
    if (bChain.has(id)) best = getNode(wheel, id);
  }
  return best;
}

/**
 * Cyclic separation between two categories, 0-4. The wheel wraps, so Floral and Fruity are
 * neighbours despite sitting at opposite ends of the source array - which is perceptually correct.
 */
export function categoryGap(wheel: Wheel, aId: string, bId: string): number {
  const a = wheel.categoryOrder.indexOf(getNode(wheel, aId).categoryId);
  const b = wheel.categoryOrder.indexOf(getNode(wheel, bId).categoryId);
  assert(a >= 0 && b >= 0, 'node category is not in categoryOrder');
  const n = wheel.categoryOrder.length;
  const raw = Math.abs(a - b);
  return Math.min(raw, n - raw);
}

/** Nodes a player can commit to as a final answer: every node with no children. */
export function terminals(wheel: Wheel): WheelNode[] {
  return [...wheel.nodes.values()].filter((n) => n.childIds.length === 0);
}

export function nodesInRing(wheel: Wheel, ring: Ring): WheelNode[] {
  return [...wheel.nodes.values()].filter((n) => n.ring === ring);
}

/** The wheel and confusable set as shipped, validated at import time. */
export const WHEEL: Wheel = buildWheel(wheelSourceSchema.parse(wheelJson));
export const CONFUSABLES: ConfusableSet = buildConfusables(
  confusableSourceSchema.parse(confusablesJson),
  WHEEL,
);
