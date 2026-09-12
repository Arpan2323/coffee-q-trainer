import { attributesSourceSchema, type AttributeRecord, type AttributesSource } from './schema.js';
import type { Wheel } from './types.js';
import { WHEEL, getNode } from './wheel.js';
import attributesJson from '../data/attributes.json' with { type: 'json' };

export interface AttributeSet {
  readonly version: string;
  readonly reviewStatus: string;
  readonly byNode: ReadonlyMap<string, AttributeRecord>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function buildAttributes(source: AttributesSource, wheel: Wheel): AttributeSet {
  const byNode = new Map<string, AttributeRecord>();

  for (const record of source.records) {
    assert(wheel.nodes.has(record.nodeId), `attribute record for unknown node "${record.nodeId}"`);
    assert(!byNode.has(record.nodeId), `duplicate attribute record for "${record.nodeId}"`);

    // The beginner definition is the Descriptor Golf clue. If it contains a word from its own
    // label the hole degenerates into a word search against the wheel, which teaches nothing.
    const clue = record.definition.beginner.toLowerCase();
    const label = getNode(wheel, record.nodeId).label.toLowerCase();
    for (const word of label.split(/[^a-z]+/).filter((w) => w.length > 2)) {
      assert(
        !clue.includes(word),
        `clue for "${record.nodeId}" gives away its own label with "${word}"`,
      );
    }

    byNode.set(record.nodeId, record);
  }

  return { version: source.version, reviewStatus: source.reviewStatus, byNode };
}

export const ATTRIBUTES: AttributeSet = buildAttributes(
  attributesSourceSchema.parse(attributesJson),
  WHEEL,
);

/** Nodes that can be used as a game target, because there is something to ask about them. */
export function hasClue(nodeId: string): boolean {
  return ATTRIBUTES.byNode.has(nodeId);
}
