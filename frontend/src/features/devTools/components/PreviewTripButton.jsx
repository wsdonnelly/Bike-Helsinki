import React from "react";
import { usePreviewTrip } from "../context/PreviewTripContext";
import { useGeolocation } from "@/features/geolocation/context/GeolocationContext";
import { useRoute } from "@/features/routing";
import { buildCumulativeTable } from "../utils/routeInterpolation";
import * as styles from "@/features/routeSettings/components/ControlPanel.styles";

export function PreviewTripButton({ onAfterTripStart }) {
  const { setPositionOverride, startLocating, startTrip } = useGeolocation();
  const { routeCoords, snappedStart, snappedEnd } = useRoute();
  const { startPreview } = usePreviewTrip();

  const canPreview = snappedStart && snappedEnd && routeCoords.length >= 2;

  function handleClick() {
    if (!canPreview) return;
    const table = buildCumulativeTable(routeCoords);
    const [lat, lon] = routeCoords[0];
    setPositionOverride({ lat, lon, accuracy: 10, heading: null, speed: 0 });
    startLocating();
    startPreview(table.total);
    startTrip();
    onAfterTripStart?.();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canPreview}
      style={{
        ...styles.btnSm,
        width: "100%",
        backgroundColor: "#e8f4fd",
        border: "1px solid #90caf9",
        color: "#1565c0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        marginTop: 6,
      }}
    >
      Preview Trip
    </button>
  );
}
