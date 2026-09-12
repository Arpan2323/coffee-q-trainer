import { describe, expect, it } from 'vitest';
import { WHEEL } from '../domain/wheel.js';
import {
  HUB_RADIUS,
  LABEL_PADDING,
  OUTER_RADIUS,
  annularSectorPath,
  arcPath,
  estimateTextWidth,
  fitFontSize,
  fitLabel,
  fitText,
  layoutWheel,
  occupiedRings,
  polarToCartesian,
  radialLabel,
  ringRadii,
  splitLabelLines,
} from './geometry.js';

describe('polar conversion', () => {
  it('puts zero degrees at twelve o clock and runs clockwise', () => {
    const top = polarToCartesian(0, 0, 100, 0);
    expect(top.x).toBeCloseTo(0, 6);
    expect(top.y).toBeCloseTo(-100, 6);

    const right = polarToCartesian(0, 0, 100, 90);
    expect(right.x).toBeCloseTo(100, 6);
    expect(right.y).toBeCloseTo(0, 6);

    const bottom = polarToCartesian(0, 0, 100, 180);
    expect(bottom.y).toBeCloseTo(100, 6);
  });

  it('honours the centre offset', () => {
    const p = polarToCartesian(50, 50, 10, 0);
    expect(p).toEqual({ x: 50, y: 40 });
  });
});

describe('wedge paths', () => {
  it('draws an annular sector that closes', () => {
    const d = annularSectorPath(0, 0, 50, 100, 0, 45);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/A /g)).toHaveLength(2);
  });

  it('sets the large-arc flag only past half a turn', () => {
    const largeArcFlag = (d: string): string =>
      d.match(/A [\d.]+ [\d.]+ 0 (\d) \d/)?.[1] ?? 'none';
    expect(largeArcFlag(annularSectorPath(0, 0, 50, 100, 0, 90))).toBe('0');
    expect(largeArcFlag(annularSectorPath(0, 0, 50, 100, 0, 200))).toBe('1');
  });

  it('collapses to a pie slice when the inner radius is zero', () => {
    const d = annularSectorPath(0, 0, 0, 100, 0, 45);
    expect(d.match(/A /g)).toHaveLength(1);
    expect(d).toContain('M 0 0');
  });

  it('draws a full ring as two arcs, since one SVG arc cannot span the circle', () => {
    const d = annularSectorPath(0, 0, 50, 100, 0, 360);
    expect(d.match(/A /g)).toHaveLength(4);
  });

  it('produces nothing for an empty sweep rather than a degenerate path', () => {
    expect(annularSectorPath(0, 0, 50, 100, 30, 30)).toBe('');
    expect(annularSectorPath(0, 0, 50, 100, 30, 10)).toBe('');
  });

  it('reverses the label baseline in the lower half so text is never upside down', () => {
    const startX = (d: string): number => Number(d.match(/^M ([-\d.]+)/)?.[1]);

    // Top of the wheel: baseline runs from the wedge's start angle, left to right.
    expect(startX(arcPath(0, 0, 100, -10, 10))).toBeCloseTo(
      polarToCartesian(0, 0, 100, -10).x,
      2,
    );
    // Bottom of the wheel: baseline runs backwards, from the end angle, so glyphs stay upright.
    expect(startX(arcPath(0, 0, 100, 170, 190))).toBeCloseTo(
      polarToCartesian(0, 0, 100, 190).x,
      2,
    );
  });
});

describe('label placement', () => {
  it('rotates labels to read outward on the right side', () => {
    expect(radialLabel(0, 0, 50, 100, 80, 100).rotation).toBeCloseTo(0, 6);
  });

  it('flips labels on the left side so they still read left to right', () => {
    expect(radialLabel(0, 0, 50, 100, 260, 280).rotation).toBeCloseTo(360, 6);
  });

  it('centres the label between the two radii', () => {
    const label = radialLabel(0, 0, 50, 100, 80, 100);
    expect(Math.hypot(label.x, label.y)).toBeCloseTo(75, 6);
  });
});

describe('text fitting', () => {
  it('leaves a label alone when it fits', () => {
    expect(fitText('Rose', 200, 10)).toBe('Rose');
  });

  it('truncates with an ellipsis when it does not', () => {
    const out = fitText('Isovaleric Acid', 30, 10);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThan('Isovaleric Acid'.length);
  });

  it('returns nothing rather than a bare ellipsis in a hopeless space', () => {
    expect(fitText('Blackberry', 4, 10)).toBe('');
  });

  it('leaves a label whole when fitFontSize sized it to fit exactly', () => {
    // Regression: the two together used to clip the last character off "Isovaleric Acid" and
    // "Sweet Aromatics", because a size chosen to fit exactly floors to one character short.
    for (const label of ['Isovaleric Acid', 'Sweet Aromatics', 'Green/Vegetative', 'Rose']) {
      for (const available of [58, 64, 70, 100]) {
        const size = fitFontSize(label, available, 10, 7);
        if (estimateTextWidth(label, size) > available) continue; // genuinely too big, must truncate
        expect(fitText(label, available, size), `${label} at ${available}px`).toBe(label);
      }
    }
  });
});

describe('label sizing', () => {
  it('shrinks a label to fit rather than truncating it', () => {
    const size = fitFontSize('Green/Vegetative', 100, 13, 8);
    expect(estimateTextWidth('Green/Vegetative', size)).toBeLessThanOrEqual(100.001);
    expect(size).toBeLessThan(13);
  });

  it('never shrinks past the floor or grows past the ceiling', () => {
    expect(fitFontSize('Isovaleric Acid', 5, 13, 8)).toBe(8);
    expect(fitFontSize('Rose', 900, 13, 8)).toBe(13);
  });

  it('stacks a slashed category name at the slash, keeping every word', () => {
    expect(splitLabelLines('Green/Vegetative')).toEqual(['Green/', 'Vegetative']);
    expect(splitLabelLines('Nutty/Cocoa')).toEqual(['Nutty/', 'Cocoa']);
    expect(splitLabelLines('Fruity')).toEqual(['Fruity']);
  });

  it('stacks only when shrinking is not enough', () => {
    expect(fitLabel('Sour/Fermented', 200, 13, 8).lines).toEqual(['Sour/Fermented']);
    expect(fitLabel('Sour/Fermented', 40, 13, 8).lines).toEqual(['Sour/', 'Fermented']);
    // Nothing to split on, so it shrinks to the floor and lets the renderer truncate.
    expect(fitLabel('Isovaleric Acid', 20, 13, 8).lines).toEqual(['Isovaleric Acid']);
  });

  it('leaves every ring-1 category renderable along its own arc', () => {
    // This is the check that caught five of nine categories silently falling back to radial text,
    // and then caught Floral - the narrowest wedge - being unrenderable at any legible size.
    const layout = layoutWheel(WHEEL, null).filter((w) => w.displayRing === 1);
    const ring = ringRadii(3)[0]!;
    const midRadius = (ring.rInner + ring.rOuter) / 2;
    expect(layout).toHaveLength(9);

    for (const wedge of layout) {
      const label = wedge.node.label;
      const refRadius = label.includes('/') ? midRadius - 7 : midRadius;
      const available = ((wedge.end - wedge.start) / 360) * 2 * Math.PI * refRadius - LABEL_PADDING;
      const fit = fitLabel(label, available, 13, 8);
      const longest = fit.lines.reduce((a, b) => (a.length >= b.length ? a : b), '');

      expect(estimateTextWidth(longest, fit.fontSize), `${label} overflows`).toBeLessThanOrEqual(
        available + 0.001,
      );
      expect(fit.fontSize, `${label} is illegibly small`).toBeGreaterThanOrEqual(8);
      expect(fit.lines.join(''), `${label} loses characters`).toBe(label);
    }
  });

  it('leaves every ring-2 and ring-3 attribute renderable across its ring', () => {
    const radii = ringRadii(3);
    for (const wedge of layoutWheel(WHEEL, null)) {
      if (wedge.displayRing === 1) continue;
      const ring = radii[wedge.displayRing - 1]!;
      const base = wedge.displayRing === 2 ? 10 : 8.5;
      const available = ring.rOuter - ring.rInner - LABEL_PADDING * 2;
      const fit = fitLabel(wedge.node.label, available, base, 7);
      const longest = fit.lines.reduce((a, b) => (a.length >= b.length ? a : b), '');
      expect(
        estimateTextWidth(longest, fit.fontSize),
        `${wedge.node.label} overflows its ring`,
      ).toBeLessThanOrEqual(available + 0.001);
    }
  });
});

describe('ring radii', () => {
  it('fills the canvas between hub and edge whatever the ring count', () => {
    for (const count of [1, 2, 3]) {
      const rings = ringRadii(count);
      expect(rings).toHaveLength(count);
      expect(rings[0]!.rInner).toBe(HUB_RADIUS);
      expect(rings.at(-1)!.rOuter).toBe(OUTER_RADIUS);
    }
  });

  it('leaves no gap between adjacent rings', () => {
    const rings = ringRadii(3);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i]!.rInner).toBeCloseTo(rings[i - 1]!.rOuter, 6);
    }
  });

  it('widens rings outward at full zoom, where the long names live', () => {
    const [r1, r2, r3] = ringRadii(3);
    const width = (r: { rInner: number; rOuter: number }) => r.rOuter - r.rInner;
    expect(width(r1!)).toBeLessThan(width(r2!));
    expect(width(r2!)).toBeLessThan(width(r3!));
  });
});

describe('layout', () => {
  it('renders the whole taxonomy unchanged when nothing is focused', () => {
    const layout = layoutWheel(WHEEL, null);
    expect(layout).toHaveLength(110);
    expect(occupiedRings(layout)).toBe(3);

    const fruity = layout.find((w) => w.node.id === 'fruity');
    expect(fruity?.start).toBe(0);
    expect(fruity?.displayRing).toBe(1);
  });

  it('stretches a focused category to fill the circle', () => {
    const layout = layoutWheel(WHEEL, 'fruity');
    const first = layout.find((w) => w.node.id === 'fruity.berry');
    const last = layout.find((w) => w.node.id === 'fruity.citrus-fruit');
    expect(first?.start).toBeCloseTo(0, 6);
    expect(last?.end).toBeCloseTo(360, 6);
  });

  it('moves descendants inward so a zoomed view uses every ring', () => {
    const layout = layoutWheel(WHEEL, 'fruity');
    expect(layout.find((w) => w.node.id === 'fruity.berry')?.displayRing).toBe(1);
    expect(layout.find((w) => w.node.id === 'fruity.berry.blackberry')?.displayRing).toBe(2);
    expect(occupiedRings(layout)).toBe(2);
  });

  it('drops everything outside the focused subtree', () => {
    const layout = layoutWheel(WHEEL, 'fruity');
    expect(layout.every((w) => w.node.categoryId === 'fruity')).toBe(true);
    expect(layout.some((w) => w.node.id === 'fruity')).toBe(false);
    expect(layout).toHaveLength(22); // 4 ring-2 groups + 18 leaves
  });

  it('keeps children inside their parent after the zoom transform', () => {
    const layout = layoutWheel(WHEEL, 'fruity');
    const byId = new Map(layout.map((w) => [w.node.id, w]));
    for (const wedge of layout) {
      const parent = byId.get(wedge.node.parentId ?? '');
      if (!parent) continue;
      expect(wedge.start).toBeGreaterThanOrEqual(parent.start - 1e-6);
      expect(wedge.end).toBeLessThanOrEqual(parent.end + 1e-6);
    }
  });

  it('zooms into a ring-2 group down to a single ring of leaves', () => {
    const layout = layoutWheel(WHEEL, 'fruity.berry');
    expect(layout).toHaveLength(4);
    expect(occupiedRings(layout)).toBe(1);
    expect(layout.every((w) => w.displayRing === 1)).toBe(true);
    expect(layout.map((w) => w.node.localId)).toEqual([
      'blackberry',
      'raspberry',
      'blueberry',
      'strawberry',
    ]);
  });

  it('yields an empty view for a terminal node, which has nothing to show', () => {
    expect(layoutWheel(WHEEL, 'fruity.berry.blackberry')).toEqual([]);
    expect(layoutWheel(WHEEL, 'sweet.vanilla')).toEqual([]);
  });

  it('tiles the circle without overlap at every zoom level', () => {
    for (const focus of [null, 'fruity', 'other', 'fruity.berry']) {
      const layout = layoutWheel(WHEEL, focus);
      const ring1 = layout
        .filter((w) => w.displayRing === 1)
        .sort((a, b) => a.start - b.start);
      for (let i = 1; i < ring1.length; i++) {
        expect(ring1[i]!.start).toBeGreaterThanOrEqual(ring1[i - 1]!.end - 1e-6);
      }
      for (const wedge of layout) {
        expect(wedge.end).toBeGreaterThan(wedge.start);
        expect(wedge.start).toBeGreaterThanOrEqual(-1e-6);
        expect(wedge.end).toBeLessThanOrEqual(360 + 1e-6);
      }
    }
  });
});
