/**
 * Shared radar/spider-chart geometry.
 *
 * Two screens draw one of these: the Palate Profile (screen-play axes - Breadth, Specificity,
 * Accuracy, Commitment, Coverage) and the Coffee Journal (a personal tasting-impression wheel with a
 * fixed 16-term vocabulary, unrelated to the app's own flavour wheel). What they plot differs
 * completely; the trigonometry that turns N values into a polygon does not. Pulled out here so a
 * second radar didn't mean a second, quietly drifting copy of `spoke`/`polygon` - the same reasoning
 * `mulberry32` and `sampleWithoutReplacement` were exported from round.ts for.
 */

export interface RadarLayout {
  readonly size: number;
  readonly center: number;
  readonly radius: number;
}

export function radarLayout(size: number, radius: number): RadarLayout {
  return { size, center: size / 2, radius };
}

/** Point on spoke `i` of `n`, `value` in 0-1, starting at 12 o'clock and going clockwise. */
export function spokePoint(
  layout: RadarLayout,
  i: number,
  n: number,
  value: number,
): [number, number] {
  const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI;
  return [
    layout.center + Math.cos(angle) * layout.radius * value,
    layout.center + Math.sin(angle) * layout.radius * value,
  ];
}

/** SVG `points` attribute for the shape connecting one value per spoke, 0-1 each. */
export function radarPolygon(layout: RadarLayout, values: readonly number[]): string {
  return values.map((v, i) => spokePoint(layout, i, values.length, v).join(',')).join(' ');
}
