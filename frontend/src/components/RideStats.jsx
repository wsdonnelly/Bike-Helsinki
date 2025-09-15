import React from "react";

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
  hasSelection = false,
  hasRoute = false,

  totalDistanceM = 0,
  totalDurationS = 0,
  distanceBikePreferred = 0,
  distanceBikeNonPreferred = 0,
  distanceWalk = 0,

  colorBikePreferred = "#007AFF",
  colorBikeNonPreferred = "#FF7F0E",
  colorWalk = "#000000",
  sticky = true,
}) {
  const statsBox = {
    position: "sticky",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    borderTop: "1px solid #eee",
    paddingTop: 10,
    paddingBottom: 12,
  };
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
  const statsHeader = { fontWeight: 700, fontSize: 13, marginBottom: 6 };
  const statsGrid = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    rowGap: 6,
    columnGap: 12,
    fontSize: 13,
  };
  const statVal = { fontWeight: 600 };
  const noRouteBox = {
    padding: 8,
    borderRadius: 6,
    background: "#fafafa",
    border: "1px solid #eee",
    fontSize: 13,
  };

  return (
    <div style={statsBox}>
    <div style={sticky ? statsBoxSticky : statsBoxNormal}></div>
      {!hasSelection ? (
        <div style={{ fontSize: 12, color: "#666" }}>
          Pick two points on the map to compute a route.
        </div>
      ) : !hasRoute ? (
        <div style={noRouteBox} role="status" aria-live="polite">
          <strong>No route found</strong>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Try adjusting surface filters or picking closer points.
          </div>
        </div>
      ) : (
        <>
          <div style={statsHeader}>Ride stats</div>
          <div style={statsGrid}>
            <div>Duration</div>
            <div style={statVal}>{formatDuration(totalDurationS)}</div>

            <div>Total Distance</div>
            <div style={statVal}>{formatKm(totalDistanceM)}</div>

            <div style={{ color: colorBikePreferred }}>
              Bike Preferred Surface
            </div>
            <div style={{ ...statVal, color: colorBikePreferred }}>
              {formatKm(distanceBikePreferred)}
            </div>

            <div style={{ color: colorBikeNonPreferred }}>
              Bike Non-Preferred Surface
            </div>
            <div style={{ ...statVal, color: colorBikeNonPreferred }}>
              {formatKm(distanceBikeNonPreferred)}
            </div>

            <div style={{ color: colorWalk }}>Walk</div>
            <div style={{ ...statVal, color: colorWalk }}>
              {formatKm(distanceWalk)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
