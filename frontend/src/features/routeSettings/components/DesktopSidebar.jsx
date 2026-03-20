import React from "react";
import { useRoute } from "@/features/routing";
import { useRouteSettingsContext } from "../context/RouteSettingsContext";
import {
  SurfaceBits,
  SURFACE_GROUPS,
  PAVED_BITS_MASK,
  UNPAVED_BITS_MASK,
  ALL_BITS_MASK,
} from "../constants/surfaceTypes";
import BulkActions from "./BulkActions";
import SurfaceCheckboxGroup from "./SurfaceCheckboxGroup";
import SurfacePenaltyControl from "./SurfacePenaltyControl";
import RideStats from "./RideStats";
import GlobeIcon from "./GlobeIcon";
import * as styles from "./ControlPanel.styles";

export default function DesktopSidebar() {
  const {
    panelOpen,
    openPanel,
    closePanel,
    draftMask,
    setDraftMask,
    toggleDraftBit,
    draftPenalty,
    setDraftPenalty,
    applySettings,
    isSatView,
    toggleSatView,
  } = useRouteSettingsContext();

  const { totals, snappedStart, snappedEnd, routeCoords } = useRoute();
  const hasSelection = Boolean(snappedStart && snappedEnd);
  const hasRoute = routeCoords.length > 1;

  const applyBulk = (newMask) => {
    newMask |= SurfaceBits.SURF_UNKNOWN;
    setDraftMask?.(newMask);
  };

  const selectAll = () => applyBulk(ALL_BITS_MASK);
  const selectNone = () => applyBulk(0);
  const selectPaved = () => applyBulk(PAVED_BITS_MASK);
  const selectUnpaved = () => applyBulk(UNPAVED_BITS_MASK);

  const commitApply = () =>
    applySettings?.({ mask: draftMask, surfacePenaltySPerKm: Number(draftPenalty) });

  const satBtnStyle = {
    ...styles.btnSm,
    marginLeft: "auto",
    marginRight: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    backgroundColor: isSatView ? "#e3f2fd" : "#fff",
    border: isSatView ? "1px solid #2196f3" : "1px solid #ddd",
  };

  return (
    <div style={styles.containerStyle}>
      {!panelOpen && (
        <button
          type="button"
          aria-label="Open surface filters"
          onClick={openPanel}
          style={styles.toggleBtn}
        >
          ☰
        </button>
      )}

      {panelOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Surface filters"
          style={styles.panel}
        >
          <div style={styles.hdr}>
            <h2 style={styles.titleStyle}>Surface Types</h2>
            <button
              type="button"
              onClick={toggleSatView}
              style={satBtnStyle}
              aria-label={isSatView ? "Switch to map view" : "Switch to satellite view"}
              title={isSatView ? "Switch to map view" : "Switch to satellite view"}
            >
              <GlobeIcon />
            </button>
            <button type="button" onClick={closePanel} style={styles.btnSm}>
              Close
            </button>
            <button
              type="button"
              aria-label="Apply"
              onClick={commitApply}
              style={styles.applyBtn}
            >
              Apply
            </button>
          </div>

          <BulkActions
            onSelectAll={selectAll}
            onSelectNone={selectNone}
            onSelectPaved={selectPaved}
            onSelectUnpaved={selectUnpaved}
          />

          {SURFACE_GROUPS.map((group) => (
            <SurfaceCheckboxGroup
              key={group.title}
              group={group}
              surfaceMask={draftMask}
              onToggleSurface={toggleDraftBit}
            />
          ))}

          <div style={styles.stickyTray}>
            <SurfacePenaltyControl
              value={draftPenalty}
              onChange={setDraftPenalty}
              onApply={commitApply}
            />
            <RideStats
              sticky={false}
              hasSelection={hasSelection}
              hasRoute={hasRoute}
              totalDistanceM={totals.totalDistanceM}
              totalDurationS={totals.totalDurationS}
              distanceBikePreferred={totals.distanceBikePreferred}
              distanceBikeNonPreferred={totals.distanceBikeNonPreferred}
              distanceWalk={totals.totalDistanceWalk}
            />
          </div>
        </div>
      )}
    </div>
  );
}
