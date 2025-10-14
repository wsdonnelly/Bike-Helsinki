import React from "react";
import { ROUTE_COLORS } from "@/shared/constants/colors";
import { formatKm } from "@/shared/utils/format";
import * as styles from "./RideStats.styles";

export default function DistanceBar({ widths, distances }) {
  const { bikePreferred, bikeNonPreferred, walk } = widths;
  const { bp, bn, wk } = distances;

  return (
    <div style={styles.barWrap}>
      <div
        style={styles.barOuter}
        role="img"
        aria-label={`Distance breakdown: Bike preferred ${formatKm(
          bp
        )}, Bike non-preferred ${formatKm(bn)}, Walk ${formatKm(wk)}`}
        title={`Bike preferred: ${formatKm(
          bp
        )} • Bike non-preferred: ${formatKm(bn)} • Walk: ${formatKm(wk)}`}
      >
        {bikePreferred > 0 && (
          <div
            style={{
              width: `${bikePreferred}%`,
              background: ROUTE_COLORS.bikePreferred,
            }}
          />
        )}
        {bikeNonPreferred > 0 && (
          <div
            style={{
              width: `${bikeNonPreferred}%`,
              background: ROUTE_COLORS.bikeNonPreferred,
            }}
          />
        )}
        {walk > 0 && (
          <div
            style={{
              width: `${walk}%`,
              background: `repeating-linear-gradient(90deg, ${ROUTE_COLORS.walk} 0 8px, transparent 8px 14px)`,
              opacity: 0.9,
            }}
          />
        )}
      </div>

      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <span style={styles.dot(ROUTE_COLORS.bikePreferred)} />
          <span style={styles.legendLabel}>Bike preferred surface</span>
          <span style={styles.legendVal}>{formatKm(bp)}</span>
        </div>
        <div style={styles.legendItem}>
          <span style={styles.dot(ROUTE_COLORS.bikeNonPreferred)} />
          <span style={styles.legendLabel}>Bike non-preferred surface</span>
          <span style={styles.legendVal}>{formatKm(bn)}</span>
        </div>
        <div style={styles.legendItem}>
          <span style={styles.dot(ROUTE_COLORS.walk)} />
          <span style={styles.legendLabel}>Walk</span>
          <span style={styles.legendVal}>{formatKm(wk)}</span>
        </div>
      </div>
    </div>
  );
}
