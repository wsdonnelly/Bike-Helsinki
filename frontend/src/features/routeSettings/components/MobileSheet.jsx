import React, { useState } from "react";
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
import * as styles from "./ControlPanel.styles";
import { useGeolocation } from "@/features/geolocation";
import AddressSearch from "@/features/routing/components/AddressSearch";

function LocationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

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
  } = useRouteSettingsContext();

  const { isLocating, isTripActive, error: geoError, startLocating, stopLocating, startTrip, stopTrip } = useGeolocation();

  const { totals, snappedStart, snappedEnd, routeCoords } = useRoute();
  const hasSelection = Boolean(snappedStart && snappedEnd);
  const hasRoute = routeCoords.length > 1;

  const [activeTab, setActiveTab] = useState("filters");
  const { sheetOffset, draggingRef, startDrag, onDragMove, endDrag } =
    useDraggableSheet(panelOpen);

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
          aria-label="Open surface filters"
          onClick={openPanel}
          style={styles.mobileToggleBtn}
        >
          ☰
        </button>
      )}

      {!panelOpen && (
        <>
          <button
            type="button"
            aria-label={isLocating ? "Stop showing my location" : "Show my location"}
            onClick={isLocating ? stopLocating : startLocating}
            style={styles.mobileLocationBtn(isLocating)}
          >
            <LocationIcon />
          </button>
          {geoError && (
            <div style={{ position: "fixed", bottom: 115, right: 20, fontSize: 11, color: "#e53935", maxWidth: 140, textAlign: "right", pointerEvents: "none" }}>
              {geoError}
            </div>
          )}
          <button
            type="button"
            aria-label={isTripActive ? "Stop trip" : "Start trip"}
            onClick={isTripActive ? stopTrip : startTrip}
            disabled={!isLocating}
            style={styles.mobileTripBtn(isTripActive, !isLocating)}
          >
            <TripIcon />
          </button>
        </>
      )}

      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Surface filters"
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
            <h2 style={styles.titleStyle}>Route Options</h2>
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
          </div>

          <div style={{ padding: "8px 0", borderBottom: "1px solid #eee", marginBottom: 8 }}>
            <AddressSearch />
          </div>

          <div style={styles.tabsContainer}>
            <button
              onClick={() => setActiveTab("filters")}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === "filters" ? "#f0f0f0" : "#fff",
                fontWeight: activeTab === "filters" ? 600 : 400,
              }}
            >
              Filters
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === "stats" ? "#f0f0f0" : "#fff",
                fontWeight: activeTab === "stats" ? 600 : 400,
              }}
            >
              Stats
            </button>
          </div>

          {activeTab === "filters" && (
            <>
              <BulkActions
                onSelectAll={selectAll}
                onSelectNone={selectNone}
                onSelectPaved={selectPaved}
                onSelectUnpaved={selectUnpaved}
                onApply={() => { commitApply(); setActiveTab("stats"); }}
              />
              {SURFACE_GROUPS.map((group) => (
                <SurfaceCheckboxGroup
                  key={group.title}
                  group={group}
                  surfaceMask={draftMask}
                  onToggleSurface={toggleDraftBit}
                />
              ))}
            </>
          )}

          {activeTab === "stats" && (
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
