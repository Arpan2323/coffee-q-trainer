/** Ring 1 = the nine categories, ring 2 = sub-groups, ring 3 = leaf attributes. */
export type Ring = 1 | 2 | 3;

/**
 * `true` means the attribute is a fault wherever it appears. `"contextual"` means it is a fault
 * only past a certain intensity or outside a certain process style - overripe and fermented are
 * sought after in some naturals and disqualifying in a washed lot. The distinction matters because
 * Defect Lab must not teach beginners that every ferment note is a flaw.
 */
export type DefectFlag = true | 'contextual';

export interface WheelNode {
  /** Dot-delimited path, e.g. "fruity.berry.blackberry". Stable across content edits. */
  readonly id: string;
  /** Author-facing id within its parent, e.g. "blackberry". */
  readonly localId: string;
  readonly label: string;
  readonly ring: Ring;
  readonly parentId: string | null;
  /** Ring-1 ancestor. For a category, its own id. */
  readonly categoryId: string;
  readonly childIds: readonly string[];
  /** Inherited from the ring-1 category; rings are differentiated by lightness at render time. */
  readonly color: string;
  readonly defect: DefectFlag | null;
  /** Degrees clockwise from 12 o'clock. Wedge width is proportional to descendant leaf count. */
  readonly angle: { readonly start: number; readonly end: number };
  /** Terminal descendants, counting the node itself when it has no children. */
  readonly leafCount: number;
}

export interface Wheel {
  readonly version: string;
  readonly nodes: ReadonlyMap<string, WheelNode>;
  /** Ring-1 ids in clockwise order. Adjacency in this array is perceptual adjacency. */
  readonly categoryOrder: readonly string[];
}

export interface ConfusablePair {
  readonly a: string;
  readonly b: string;
  /** Fraction of a perfect score this pair is worth, 0-1. */
  readonly weight: number;
  readonly note: string;
}

export interface ConfusableSet {
  readonly version: string;
  readonly reviewStatus: string;
  /** Keyed by node id; each entry maps the partner id to the pair. Symmetric. */
  readonly byNode: ReadonlyMap<string, ReadonlyMap<string, ConfusablePair>>;
  readonly pairs: readonly ConfusablePair[];
}
