/**
 * Coffee Journal: a quick, non-blind, single-cup tasting note. Not one of PLAN.md's numbered modes -
 * it exists because a bag of coffee you bought and are drinking day to day is a different activity
 * from anything else in the physical track, and the difference is exactly the fields it needs.
 *
 * Every other physical mode is built around not knowing something until the answer is committed:
 * a coded bowl, a coded reference, a vial you have not yet turned over. Roaster, producer and price
 * are the opposite of that - information you already have before the first sip, printed on the bag.
 * Trying to fold this into the blind Cupping Session would mean adding fields to a protocol that
 * exists specifically to keep them hidden until the reveal.
 *
 * Ungraded, like the cupping session: your own cup has no answer key, so this reaches `cupsTasted`
 * in the session log and nothing else - no identification total, no `named` entry, no wheel score.
 * The tasting wheel here is a fixed 16-term vocabulary, not the app's own 110-node flavour wheel, so
 * it cannot feed `named` even if it wanted to: `named` is keyed by wheel node id, and none of these
 * sixteen terms are one.
 */

/**
 * Sixteen broad terms, clockwise from 12 o'clock, matching the printed tasting-journal template this
 * mode is modelled on. Deliberately not the SCA wheel's vocabulary: that wheel's structure (radial
 * position as perceptual distance, 110 leaf attributes) is what Descriptor Golf and the confusable
 * table are built to exploit, and forcing a 16-spoke radar through it would flatten the very thing
 * that makes it useful. This is a separate, much coarser scale for "what did this cup taste like",
 * the way a home taster jots a note - not a drill, and not scored against either wheel.
 */
export const JOURNAL_AXES = [
  'sweet',
  'sourTart',
  'floral',
  'spicy',
  'salty',
  'berryFruit',
  'citrusFruit',
  'stoneFruit',
  'chocolate',
  'caramel',
  'smoky',
  'bitter',
  'savory',
  'body',
  'clean',
  'lingerFinish',
] as const;

export type JournalAxis = (typeof JOURNAL_AXES)[number];

export const JOURNAL_AXIS_LABEL: Record<JournalAxis, string> = {
  sweet: 'Sweet',
  sourTart: 'Sour/Tart',
  floral: 'Floral',
  spicy: 'Spicy',
  salty: 'Salty',
  berryFruit: 'Berry Fruit',
  citrusFruit: 'Citrus Fruit',
  stoneFruit: 'Stone Fruit',
  chocolate: 'Chocolate',
  caramel: 'Caramel',
  smoky: 'Smoky',
  bitter: 'Bitter',
  savory: 'Savory',
  body: 'Body',
  clean: 'Clean',
  lingerFinish: 'Linger/Finish',
};

/** Rings on the printed wheel: 0 (centre, unmarked) through 5 (the outer ring). */
export const JOURNAL_INTENSITY_MAX = 5;

export const JOURNAL_RATING_MAX = 5;

/**
 * Single-select, unlike the printed card's checkboxes. One cup was brewed one way; a taster who
 * genuinely wants to log the same coffee two ways (say, espresso and pour-over side by side) gets
 * two journal entries, which keeps `radar` and `rating` unambiguous about which brew they describe.
 */
export const BREW_METHODS = [
  'espresso',
  'drip',
  'pour-over',
  'press',
  'cupping',
  'siphon',
  'other',
] as const;

export type BrewMethod = (typeof BREW_METHODS)[number];

export const BREW_METHOD_LABEL: Record<BrewMethod, string> = {
  espresso: 'Espresso',
  drip: 'Drip',
  'pour-over': 'Pour-over',
  press: 'Press',
  cupping: 'Cupping',
  siphon: 'Siphon',
  other: 'Other',
};

export type JournalRadar = Readonly<Record<JournalAxis, number>>;

export const EMPTY_JOURNAL_RADAR: JournalRadar = Object.fromEntries(
  JOURNAL_AXES.map((axis) => [axis, 0]),
) as JournalRadar;

/** Keeps a hand-typed or clicked intensity inside the wheel's five rings. */
export function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(JOURNAL_INTENSITY_MAX, Math.max(0, Math.round(value)));
}

export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(JOURNAL_RATING_MAX, Math.max(0, Math.round(value)));
}

export function setAxis(radar: JournalRadar, axis: JournalAxis, value: number): JournalRadar {
  return { ...radar, [axis]: clampIntensity(value) };
}

/** 0-1 per axis, in `JOURNAL_AXES` order, for the radar chart - see `src/ui/radar.ts`. */
export function radarValues(radar: JournalRadar): number[] {
  return JOURNAL_AXES.map((axis) => radar[axis] / JOURNAL_INTENSITY_MAX);
}
