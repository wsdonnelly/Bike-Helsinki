/**
 * Calculates segment widths for a stacked bar chart
 * Ensures tiny segments get minimum visibility while maintaining ~100% total
 */
export function calculateSegmentWidths(
  distanceBikePreferred,
  distanceBikeNonPreferred,
  distanceWalk,
  totalDistanceM
) {
  const bp = Math.max(0, distanceBikePreferred || 0);
  const bn = Math.max(0, distanceBikeNonPreferred || 0);
  const wk = Math.max(0, distanceWalk || 0);

  const sumSegments = bp + bn + wk;
  const base = totalDistanceM > 0 ? totalDistanceM : sumSegments;

  const pct = (part) => (base > 0 ? (part / base) * 100 : 0);
  let wBP = pct(bp);
  let wBN = pct(bn);
  let wWK = pct(wk);

  // Minimal visibility for tiny segments (keeps total near 100%)
  const minPct = 1.5;
  const boosts = [
    wBP < minPct && wBP > 0,
    wBN < minPct && wBN > 0,
    wWK < minPct && wWK > 0,
  ].filter(Boolean).length;

  if (boosts > 0) {
    const give = minPct * boosts;
    const pool = 100 - (wBP + wBN + wWK);

    if (pool >= give) {
      if (wBP > 0 && wBP < minPct) wBP = minPct;
      if (wBN > 0 && wBN < minPct) wBN = minPct;
      if (wWK > 0 && wWK < minPct) wWK = minPct;
    }
  }

  // Normalize to 100% (avoid rounding gaps)
  const totalPct = wBP + wBN + wWK;
  if (totalPct > 0) {
    wBP = (wBP / totalPct) * 100;
    wBN = (wBN / totalPct) * 100;
    wWK = (wWK / totalPct) * 100;
  }

  return {
    bikePreferred: wBP,
    bikeNonPreferred: wBN,
    walk: wWK,
    distances: { bp, bn, wk },
  };
}
