import React from "react";
import { formatKm, formatDuration } from "@/shared/utils/format";
import { calculateSegmentWidths } from "../utils/barChartCalculations";
import DistanceBar from "./DistanceBar";
import * as styles from "./RideStats.styles";

export default function RideStats({
  hasSelection = false,
  hasRoute = false,
  totalDistanceM = 0,
  totalDurationS = 0,
  distanceBikePreferred = 0,
  distanceBikeNonPreferred = 0,
  distanceWalk = 0,
  sticky = true,
}) {
  const boxStyle = sticky ? styles.statsBoxSticky : styles.statsBoxNormal;

  if (!hasSelection) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: 12, color: "#666" }}>
          Pick two points on the map to compute a route.
        </div>
      </div>
    );
  }

  if (!hasRoute) {
    return (
      <div style={boxStyle}>
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

  const { bikePreferred, bikeNonPreferred, walk, distances } =
    calculateSegmentWidths(
      distanceBikePreferred,
      distanceBikeNonPreferred,
      distanceWalk,
      totalDistanceM
    );

  return (
    <div style={boxStyle}>
      <div style={styles.statsHeader}>Ride stats</div>

      <div style={styles.statsGrid}>
        <div>Duration</div>
        <div style={styles.statVal}>{formatDuration(totalDurationS)}</div>

        <div>Total Distance</div>
        <div style={styles.statVal}>{formatKm(totalDistanceM)}</div>
      </div>

      <DistanceBar
        widths={{ bikePreferred, bikeNonPreferred, walk }}
        distances={distances}
      />
    </div>
  );
}
