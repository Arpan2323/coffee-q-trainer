import type { Ring } from '../domain/types.js';

/**
 * Pedagogical order, not wheel order. Roasted, Nutty/Cocoa and Sweet come first because they are
 * the high-frequency, familiar categories a beginner can already half-perceive. Fruity and
 * Sour/Fermented follow - high value and genuinely hard. The last four are the ones most beginners
 * simply cannot perceive yet, and putting them early teaches failure rather than vocabulary.
 */
export const CATEGORY_UNLOCK_ORDER = [
  'roasted',
  'nutty-cocoa',
  'sweet',
  'fruity',
  'sour-fermented',
  'floral',
  'spices',
  'green-vegetative',
  'other',
] as const;

export interface Belt {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  /**
   * The ring an answer is expected to land on. The clue is always drawn from a specific attribute;
   * the target is that attribute's ancestor at this ring. So belt 1 asks "which of the nine does
   * this belong to?" using a clue written for a leaf - which is the actual Nine Doors drill.
   */
  readonly targetRing: Ring;
  /** Categories in play, in unlock order. */
  readonly categoryIds: readonly string[];
  readonly holes: number;
}

/**
 * Belts narrow as they deepen. All nine categories are in play at ring 1 - a beginner can sort
 * anything into nine boxes, and "Nine Doors" would be a lie with fewer. Depth is where the
 * familiar categories earn their head start: you go to the leaves only in the three you know.
 */
export const BELTS: readonly Belt[] = [
  {
    id: 'nine-doors',
    label: 'Nine Doors',
    blurb: 'Read the description and name the category it belongs to.',
    targetRing: 1,
    categoryIds: CATEGORY_UNLOCK_ORDER,
    holes: 9,
  },
  {
    id: 'branching',
    label: 'Branching',
    blurb: 'Now find the group inside the category.',
    targetRing: 2,
    categoryIds: CATEGORY_UNLOCK_ORDER.slice(0, 5),
    holes: 9,
  },
  {
    id: 'leaves',
    label: 'Leaves',
    blurb: 'All the way to the specific attribute. Committing beats hedging.',
    targetRing: 3,
    categoryIds: CATEGORY_UNLOCK_ORDER.slice(0, 3),
    holes: 9,
  },
];

export function getBelt(id: string): Belt {
  const belt = BELTS.find((b) => b.id === id);
  if (!belt) throw new Error(`unknown belt "${id}"`);
  return belt;
}
