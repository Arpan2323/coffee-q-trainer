import type { Ring, Wheel, WheelNode } from '../domain/types.js';
import { getNode } from '../domain/wheel.js';

/**
 * All angles are degrees clockwise from 12 o'clock, matching the convention the taxonomy stores.
 * SVG's native angle convention is different, so every conversion goes through polarToCartesian
 * rather than being open-coded at call sites.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const fmt = (n: number): string => (Math.round(n * 1000) / 1000).toString();

/**
 * An annular sector - the wedge shape the whole wheel is made of. Collapses to a pie slice when
 * the inner radius is zero, and to a full ring when the sweep covers the circle (SVG arcs cannot
 * express 360 degrees in one command, so that case is drawn as two half arcs).
 */
export function annularSectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  if (sweep <= 0) return '';

  if (sweep >= 359.999) {
    const arc = (r: number, dir: 0 | 1): string => {
      const a = polarToCartesian(cx, cy, r, 0);
      const b = polarToCartesian(cx, cy, r, 180);
      return `M ${fmt(a.x)} ${fmt(a.y)} A ${fmt(r)} ${fmt(r)} 0 1 ${dir} ${fmt(b.x)} ${fmt(b.y)} A ${fmt(r)} ${fmt(r)} 0 1 ${dir} ${fmt(a.x)} ${fmt(a.y)} Z`;
    };
    return rInner <= 0 ? arc(rOuter, 1) : `${arc(rOuter, 1)} ${arc(rInner, 0)}`;
  }

  const largeArc = sweep > 180 ? 1 : 0;
  const o0 = polarToCartesian(cx, cy, rOuter, startDeg);
  const o1 = polarToCartesian(cx, cy, rOuter, endDeg);

  if (rInner <= 0) {
    return [
      `M ${fmt(cx)} ${fmt(cy)}`,
      `L ${fmt(o0.x)} ${fmt(o0.y)}`,
      `A ${fmt(rOuter)} ${fmt(rOuter)} 0 ${largeArc} 1 ${fmt(o1.x)} ${fmt(o1.y)}`,
      'Z',
    ].join(' ');
  }

  const i1 = polarToCartesian(cx, cy, rInner, endDeg);
  const i0 = polarToCartesian(cx, cy, rInner, startDeg);
  return [
    `M ${fmt(o0.x)} ${fmt(o0.y)}`,
    `A ${fmt(rOuter)} ${fmt(rOuter)} 0 ${largeArc} 1 ${fmt(o1.x)} ${fmt(o1.y)}`,
    `L ${fmt(i1.x)} ${fmt(i1.y)}`,
    `A ${fmt(rInner)} ${fmt(rInner)} 0 ${largeArc} 0 ${fmt(i0.x)} ${fmt(i0.y)}`,
    'Z',
  ].join(' ');
}

/** A bare arc used as a textPath baseline, reversed when it would otherwise render text upside down. */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const mid = (startDeg + endDeg) / 2;
  const flip = mid > 90 && mid < 270;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const from = polarToCartesian(cx, cy, r, flip ? endDeg : startDeg);
  const to = polarToCartesian(cx, cy, r, flip ? startDeg : endDeg);
  return `M ${fmt(from.x)} ${fmt(from.y)} A ${fmt(r)} ${fmt(r)} 0 ${largeArc} ${flip ? 0 : 1} ${fmt(to.x)} ${fmt(to.y)}`;
}

export interface RadialLabel {
  readonly x: number;
  readonly y: number;
  /** Degrees, for an SVG rotate() transform about (x, y). */
  readonly rotation: number;
}

/**
 * Radial label placement, flipped in the left half of the wheel so text always reads
 * left-to-right rather than upside down.
 */
export function radialLabel(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
): RadialLabel {
  const mid = (startDeg + endDeg) / 2;
  const pos = polarToCartesian(cx, cy, (rInner + rOuter) / 2, mid);
  return { x: pos.x, y: pos.y, rotation: mid > 180 ? mid + 90 : mid - 90 };
}

/**
 * Rough truncation by average glyph width. Exact measurement needs a laid-out DOM, which the
 * geometry layer deliberately does not have - a label that overflows its wedge by a few pixels is
 * a smaller problem than making the layout untestable.
 */
export function fitText(label: string, availablePx: number, fontSizePx: number): string {
  const perChar = fontSizePx * 0.55;
  // The epsilon matters: fitFontSize hands back a size that fits exactly, and without it the
  // division lands a hair under a whole character and clips the last letter off a label that fits.
  const maxChars = Math.floor(availablePx / perChar + 1e-6);
  if (maxChars >= label.length) return label;
  if (maxChars <= 1) return '';
  return `${label.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Same average-glyph-width approximation fitText uses, kept in one place. */
export function estimateTextWidth(text: string, fontSizePx: number): number {
  return text.length * fontSizePx * 0.55;
}

/** Largest font size that fits, clamped - shrinking a label beats truncating it. */
export function fitFontSize(
  text: string,
  availablePx: number,
  maxSize: number,
  minSize: number,
): number {
  if (text.length === 0) return maxSize;
  const ideal = availablePx / (text.length * 0.55);
  return Math.max(minSize, Math.min(maxSize, ideal));
}

/**
 * Category names carrying a slash are two concepts, and the published wheel stacks them on two
 * lines for exactly that reason. Splitting there rather than truncating keeps "Green/Vegetative"
 * readable in a wedge too narrow for it - and a learner needs the whole name, not "Green/Veg…".
 */
export function splitLabelLines(label: string): string[] {
  const at = label.indexOf('/');
  if (at < 0) return [label];
  return [label.slice(0, at + 1), label.slice(at + 1)];
}

export interface LabelFit {
  readonly lines: readonly string[];
  readonly fontSize: number;
}

/**
 * Chooses how to render one label in the space available: shrink first, stack at the slash if
 * shrinking would take it below the legibility floor, and only then let fitText truncate. Shared
 * by curved and radial labels so both behave the same way.
 */
export function fitLabel(
  label: string,
  availablePx: number,
  maxSize: number,
  minSize: number,
): LabelFit {
  const single = fitFontSize(label, availablePx, maxSize, minSize);
  const fitsSingle = estimateTextWidth(label, single) <= availablePx;
  if (fitsSingle || !label.includes('/')) return { lines: [label], fontSize: single };

  const lines = splitLabelLines(label);
  const longest = lines.reduce((a, b) => (a.length >= b.length ? a : b), '');
  return { lines, fontSize: fitFontSize(longest, availablePx, maxSize, minSize) };
}

/**
 * The hub is large because ring 1 sits closest to the centre and therefore has the least arc to
 * write on - Floral, the narrowest category, could not hold a legible curved label until the whole
 * ring was pushed outward.
 */
export const HUB_RADIUS = 100;
export const OUTER_RADIUS = 300;
/** Breathing room subtracted from the space a label may occupy. */
export const LABEL_PADDING = 6;

/**
 * Rings widen outward at full zoom: ring 3 carries the longest names and has the most room to
 * spare, while ring 1 writes along the arc and needs radius more than width. Fewer rings split
 * evenly, since a zoomed view has no such pressure.
 */
const RING_WEIGHTS: Record<number, readonly number[]> = { 3: [0.27, 0.35, 0.38] };

export function ringRadii(ringCount: number): { rInner: number; rOuter: number }[] {
  const n = Math.max(ringCount, 1);
  const weights = RING_WEIGHTS[n] ?? Array.from({ length: n }, () => 1 / n);
  const total = OUTER_RADIUS - HUB_RADIUS;

  let cursor = HUB_RADIUS;
  return weights.map((weight, i) => {
    const rInner = cursor;
    cursor += total * weight;
    // Pin the last edge exactly, so accumulated float error never leaves a sliver at the rim.
    return { rInner, rOuter: i === n - 1 ? OUTER_RADIUS : cursor };
  });
}

export interface WedgeLayout {
  readonly node: WheelNode;
  /** Ring position on screen, which differs from node.ring once the view is zoomed. */
  readonly displayRing: Ring;
  readonly start: number;
  readonly end: number;
}

/**
 * Maps the taxonomy onto screen rings. With no focus this is the authored geometry unchanged.
 * With a focus, that node's angular span is stretched to fill the circle and its descendants move
 * inward by however many rings the focus sits at - so zooming into Fruity puts Berry in ring 1 and
 * Blackberry in ring 2, using the whole canvas instead of a thin slice of it.
 */
export function layoutWheel(wheel: Wheel, focusId: string | null): WedgeLayout[] {
  if (focusId === null) {
    return [...wheel.nodes.values()].map((node) => ({
      node,
      displayRing: node.ring,
      start: node.angle.start,
      end: node.angle.end,
    }));
  }

  const focus = getNode(wheel, focusId);
  const span = focus.angle.end - focus.angle.start;
  if (span <= 0) return [];

  const scale = 360 / span;
  const out: WedgeLayout[] = [];

  const walk = (id: string): void => {
    const node = getNode(wheel, id);
    if (node.id !== focus.id) {
      const displayRing = node.ring - focus.ring;
      if (displayRing >= 1 && displayRing <= 3) {
        out.push({
          node,
          displayRing: displayRing as Ring,
          start: (node.angle.start - focus.angle.start) * scale,
          end: (node.angle.end - focus.angle.start) * scale,
        });
      }
    }
    for (const childId of node.childIds) walk(childId);
  };

  walk(focus.id);
  return out;
}

/** Highest ring actually occupied, used to size the rings so no empty band is drawn. */
export function occupiedRings(layout: readonly WedgeLayout[]): number {
  return layout.reduce((max, w) => Math.max(max, w.displayRing), 0);
}
