import React from "react";
import GlobeIcon from "./GlobeIcon";
import TripIcon from "@/shared/components/Icons/TripIcon";
import * as styles from "./ControlPanel.styles";
import { UI_COLORS } from "@/shared/constants/colors";
import { DEV_TOOLS_ENABLED, PreviewTripButton } from "@/features/devTools";

export default function PanelToolbar({
  title,
  headerStyle,
  headerDragHandlers,
  canClear,
  onClear,
  onClose,
  isSatView,
  onToggleSatView,
  isTripActive,
  isLocating,
  snappedEnd,
  geoError,
  startLocating,
  startTrip,
  stopTrip,
  stopLocating,
  onAfterTripStop,
  onAfterTripStart,
  tripContainerStyle,
}) {
  const showTrip = (isLocating && !!snappedEnd) || isTripActive;

  return (
    <>
      <div style={headerStyle} {...headerDragHandlers}>
        <h2 style={styles.titleStyle}>{title}</h2>
        {canClear && (
          <button type="button" onClick={onClear} style={styles.btnSm} aria-label="Clear route">
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={onToggleSatView}
          style={styles.satBtn(isSatView)}
          aria-label={isSatView ? "Switch to map view" : "Switch to satellite view"}
          title={isSatView ? "Switch to map view" : "Switch to satellite view"}
        >
          <GlobeIcon />
        </button>
        {onClose && (
          <button type="button" onClick={onClose} style={styles.btnSm}>
            Close
          </button>
        )}
      </div>

      {DEV_TOOLS_ENABLED && !isTripActive && isLocating && !!snappedEnd && (
        <PreviewTripButton onAfterTripStart={onAfterTripStart} />
      )}

      {showTrip && (
        <div style={tripContainerStyle ?? { marginBottom: 12 }}>
          <button
            type="button"
            aria-label={isTripActive ? "Stop trip" : "Start trip"}
            onClick={
              isTripActive
                ? () => { stopTrip(); stopLocating(); onAfterTripStop?.(); }
                : () => { if (!isLocating) startLocating(); startTrip(); onAfterTripStart?.(); }
            }
            style={{
              ...styles.btnSm,
              width: "100%",
              backgroundColor: UI_COLORS.primary,
              border: "none",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            <TripIcon size={14} /> {isTripActive ? "Stop Trip" : "Start Trip"}
          </button>
          {geoError && (
            <span style={{ fontSize: 11, color: UI_COLORS.error, display: "block", marginTop: 4 }}>
              {geoError}
            </span>
          )}
        </div>
      )}
    </>
  );
}
