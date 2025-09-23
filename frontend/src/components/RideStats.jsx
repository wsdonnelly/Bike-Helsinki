import React from "react";

// --- helpers ---
const formatKm = (m) => {
  const km = (m || 0) / 1000;
  if (km === 0) return "0.0 km";
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
};
const formatDuration = (t) => {
  const total = Math.max(0, Math.floor(t ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(
      2,
      "0"
    )}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
};

export default function RideStats({
  // state flags
  hasSelection = false,
  hasRoute = false,

  // stats (meters / seconds)
  totalDistanceM = 0,
  totalDurationS = 0,
  distanceBikePreferred = 0,
  distanceBikeNonPreferred = 0,
  distanceWalk = 0,

  // colors to match the map
  colorBikePreferred = "#007AFF",
  colorBikeNonPreferred = "#FF7F0E",
  colorWalk = "#000000",

  // layout
  sticky = true,
}) {
  // Layout styles
  const statsBoxSticky = {
    position: "sticky",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    borderTop: "1px solid #eee",
    paddingTop: 10,
    paddingBottom: 12,
  };
  const statsBoxNormal = {
    background: "#fff",
    borderTop: "1px solid #eee",
    paddingTop: 10,
    paddingBottom: 12,
  };
  const statsHeader = { fontWeight: 700, fontSize: 13, marginBottom: 8 };
  const statsGrid = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    rowGap: 6,
    columnGap: 12,
    fontSize: 13,
    marginBottom: 10,
  };
  const statVal = { fontWeight: 600 };

  // Stacked bar container
  const barWrap = { marginTop: 6, marginBottom: 8 };
  const barOuter = {
    display: "flex",
    width: "100%",
    height: 14,
    borderRadius: 8,
    overflow: "hidden",
    background: "#f3f4f6", // light gray track
  };
  const legend = {
    marginTop: 8,
    display: "grid",
    rowGap: 6,
  };
  const legendItem = {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto", // dot | label | value
    alignItems: "center",
    columnGap: 8,
    padding: "2px 0",
  };
  const legendLabel = {
    fontSize: 12, // smaller label
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const legendVal = {
    marginLeft: 8,
    fontWeight: 700, // keep numbers strong
    fontSize: 12,
    lineHeight: 1.1,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums", // aligns digits neatly
  };
  const dot = (color) => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color,
    flex: "0 0 10px",
  });

  // Compute widths
  const bp = Math.max(0, distanceBikePreferred || 0);
  const bn = Math.max(0, distanceBikeNonPreferred || 0);
  const wk = Math.max(0, distanceWalk || 0);

  // Use total distance if it’s consistent; otherwise fall back to sum
  const sumSegments = bp + bn + wk;
  const base = totalDistanceM > 0 ? totalDistanceM : sumSegments;

  const pct = (part) => (base > 0 ? (part / base) * 100 : 0);
  const wBP = pct(bp);
  const wBN = pct(bn);
  const wWK = pct(wk);

  // Minimal visibility for tiny segments (keeps total near 100%)
  const minPct = 1.5; // %
  let adjBP = wBP,
    adjBN = wBN,
    adjWK = wWK;
  const boosts = [
    adjBP < minPct && adjBP > 0,
    adjBN < minPct && adjBN > 0,
    adjWK < minPct && adjWK > 0,
  ].filter(Boolean).length;
  if (boosts > 0) {
    const give = minPct * boosts;
    const pool = 100 - (wBP + wBN + wWK);
    // only boost if we have room; otherwise leave as-is
    if (pool >= give) {
      if (wBP > 0 && adjBP < minPct) adjBP = minPct;
      if (wBN > 0 && adjBN < minPct) adjBN = minPct;
      if (wWK > 0 && adjWK < minPct) adjWK = minPct;
    }
  }
  // normalize to 100% (avoid rounding gaps)
  const totalPct = adjBP + adjBN + adjWK;
  if (totalPct > 0) {
    adjBP = (adjBP / totalPct) * 100;
    adjBN = (adjBN / totalPct) * 100;
    adjWK = (adjWK / totalPct) * 100;
  }

  if (!hasSelection) {
    return (
      <div style={sticky ? statsBoxSticky : statsBoxNormal}>
        <div style={{ fontSize: 12, color: "#666" }}>
          Pick two points on the map to compute a route.
        </div>
      </div>
    );
  }
  if (!hasRoute) {
    return (
      <div style={sticky ? statsBoxSticky : statsBoxNormal}>
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: 8,
            borderRadius: 6,
            background: "#fafafa",
            border: "1px solid #eee",
            fontSize: 13,
          }}
        >
          <strong>No route found</strong>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Pick different start and end points. This bug has been logged
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={sticky ? statsBoxSticky : statsBoxNormal}>
      <div style={statsHeader}>Ride stats</div>

      {/* Text rows for duration & total distance */}
      <div style={statsGrid}>
        <div>Duration</div>
        <div style={statVal}>{formatDuration(totalDurationS)}</div>

        <div>Total Distance</div>
        <div style={statVal}>{formatKm(totalDistanceM)}</div>
      </div>

      {/* Stacked bar for segment distances */}
      <div style={barWrap}>
        <div
          style={barOuter}
          role="img"
          aria-label={`Distance breakdown: Bike preferred ${formatKm(
            bp
          )}, Bike non-preferred ${formatKm(bn)}, Walk ${formatKm(wk)}`}
          title={`Bike preferred: ${formatKm(
            bp
          )} • Bike non-preferred: ${formatKm(bn)} • Walk: ${formatKm(wk)}`}
        >
          {/* Bike Preferred */}
          {adjBP > 0 && (
            <div
              style={{ width: `${adjBP}%`, background: colorBikePreferred }}
            />
          )}
          {/* Bike Non-Preferred */}
          {adjBN > 0 && (
            <div
              style={{ width: `${adjBN}%`, background: colorBikeNonPreferred }}
            />
          )}
          {/* Walk (dashed look via repeating gradient) */}
          {adjWK > 0 && (
            <div
              style={{
                width: `${adjWK}%`,
                background: `repeating-linear-gradient(90deg, ${colorWalk} 0 8px, transparent 8px 14px)`,
                opacity: 0.9,
              }}
            />
          )}
        </div>

        {/* Legend under the bar */}
        <div style={legend}>
          <div style={legendItem}>
            <span style={dot(colorBikePreferred)} />
            <span style={legendLabel}>Bike preferred surface</span>
            <span style={legendVal}>{formatKm(bp)}</span>
          </div>
          <div style={legendItem}>
            <span style={dot(colorBikeNonPreferred)} />
            <span style={legendLabel}>Bike non-preferred surface</span>
            <span style={legendVal}>{formatKm(bn)}</span>
          </div>
          <div style={legendItem}>
            <span style={dot(colorWalk)} />
            <span style={legendLabel}>Walk</span>
            <span style={legendVal}>{formatKm(wk)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
