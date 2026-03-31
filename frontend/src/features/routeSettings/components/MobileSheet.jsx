import React, { useState, useRef, useLayoutEffect } from "react";
import { useRoute } from "@/features/routing";
import { useRouteSettingsContext } from "../context/RouteSettingsContext";
import { useDraggableSheet } from "../hooks/useDraggableSheet";
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
import MapAttribution from "./MapAttribution";
import * as styles from "./ControlPanel.styles";
import { useGeolocation } from "@/features/geolocation";
import AddressSearch from "@/features/routing/components/AddressSearch";

function TripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function MobileSheet() {
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
    triggerRouteFit,
    setSheetHeight,
  } = useRouteSettingsContext();

  const { isLocating, isTripActive, error: geoError, startLocating, stopLocating, startTrip, stopTrip } = useGeolocation();

  const { totals, snappedStart, snappedEnd, routeCoords } = useRoute();
  const hasSelection = Boolean(snappedStart && snappedEnd);
  const hasRoute = routeCoords.length > 1;

  const [activeTab, setActiveTab] = useState("planner");
  const { sheetOffset, draggingRef, startDrag, onDragMove, endDrag } =
    useDraggableSheet(panelOpen);

  const sheetRef = useRef(null);
  useLayoutEffect(() => {
    const node = sheetRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setSheetHeight(node.offsetHeight));
    ro.observe(node);
    return () => ro.disconnect();
  }, [panelOpen]);

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
    <>
      {!panelOpen && (
        <button
          type="button"
          aria-label="Open route planner"
          onClick={openPanel}
          style={styles.mobileToggleBtn}
        >
          ☰
        </button>
      )}

      {panelOpen && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Route Planner"
          style={{
            ...styles.mobileSheet,
            transform: `translateY(${sheetOffset}px)`,
            transition: draggingRef.current ? "none" : "transform .2s ease",
          }}
          onPointerMove={onDragMove}
          onPointerUp={() => endDrag(closePanel)}
          onPointerCancel={() => endDrag(closePanel)}
          onTouchMove={onDragMove}
          onTouchEnd={() => endDrag(closePanel)}
          onTouchCancel={() => endDrag(closePanel)}
        >
          <div
            style={styles.handleArea}
            onPointerDown={startDrag}
            onTouchStart={startDrag}
          >
            <div style={styles.handleBar} />
          </div>

          <div
            style={styles.mobileHdr}
            onPointerDown={startDrag}
            onTouchStart={startDrag}
          >
            <h2 style={styles.titleStyle}>{activeTab === "preferences" ? "Route Preferences" : "Route Planner"}</h2>
            <button
              type="button"
              onClick={toggleSatView}
              style={satBtnStyle}
              aria-label={isSatView ? "Switch to map view" : "Switch to satellite view"}
              title={isSatView ? "Switch to map view" : "Switch to satellite view"}
            >
              <GlobeIcon />
            </button>

          </div>

          {(hasSelection || isTripActive) && (
            <div style={{ paddingBottom: 8, borderBottom: "1px solid #eee", marginBottom: 8 }}>
              <button
                type="button"
                aria-label={isTripActive ? "Stop trip" : "Start trip"}
                onClick={isTripActive ? () => { stopTrip(); stopLocating(); if (hasSelection) triggerRouteFit(); } : () => { if (!isLocating) startLocating(); startTrip(); closePanel(); }}
                style={{
                  ...styles.btnSm,
                  width: "100%",
                  backgroundColor: "#007AFF",
                  border: "none",
                  color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}
              >
                <TripIcon /> {isTripActive ? "Stop Trip" : "Start Trip"}
              </button>
              {geoError && (
                <span style={{ fontSize: 11, color: "#e53935", display: "block", marginTop: 4 }}>
                  {geoError}
                </span>
              )}
            </div>
          )}

          <div style={styles.tabsContainer}>
            <button
              onClick={() => setActiveTab("planner")}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === "planner" ? "#f0f0f0" : "#fff",
                fontWeight: activeTab === "planner" ? 600 : 400,
              }}
            >
              Planner
            </button>
            <button
              onClick={() => { setActiveTab("preferences"); if (hasSelection) setTimeout(triggerRouteFit, 0); }}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === "preferences" ? "#f0f0f0" : "#fff",
                fontWeight: activeTab === "preferences" ? 600 : 400,
              }}
            >
              Preferences
            </button>
          </div>

          {activeTab === "planner" && (
            <>
              <div style={{ padding: "8px 0", marginBottom: 8 }}>
                <AddressSearch />
              </div>
              <BulkActions
                onSelectAll={selectAll}
                onSelectNone={selectNone}
                onSelectPaved={selectPaved}
                onSelectUnpaved={selectUnpaved}
                onApply={() => { commitApply(); setActiveTab("preferences"); }}
              />
              {SURFACE_GROUPS.map((group) => (
                <SurfaceCheckboxGroup
                  key={group.title}
                  group={group}
                  surfaceMask={draftMask}
                  onToggleSurface={toggleDraftBit}
                />
              ))}
              <MapAttribution />
            </>
          )}

          {activeTab === "preferences" && (
            <div>
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
          )}

        </div>
      )}
    </>
  );
}
