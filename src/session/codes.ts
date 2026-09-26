/**
 * Three-digit blinding codes, the way a sensory panel labels samples.
 *
 * Shared by every physical mode because they all need the same thing: a label that identifies a
 * sample to the app without telling the taster what is in it. Codes are drawn distinct across a
 * whole session rather than merely within a set - the taster reports a code, so a code appearing
 * twice makes the record ambiguous about which sample was meant.
 *
 * Three digits, not one or two, for the same reason panels use them: 1/2/3 invites a taster to
 * assume an order, and 417 does not.
 */
export const CODE_MIN = 100;
export const CODE_RANGE = 900;

export function drawCodes(count: number, random: () => number): string[] {
  const codes = new Set<string>();
  // 900 codes against at most a few dozen samples, so this cannot realistically stall.
  while (codes.size < count) {
    codes.add(String(CODE_MIN + Math.floor(random() * CODE_RANGE)));
  }
  return [...codes];
}
