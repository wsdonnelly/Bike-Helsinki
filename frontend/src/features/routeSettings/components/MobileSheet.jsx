import React, { useState, useRef, useLayoutEffect } from "react";
import { useRoute } from "@/features/routing";
import { useRouteSettingsContext } from "../context/RouteSettingsContext";
import { useDraggableSheet } from "../hooks/useDraggableSheet";
import { SURFACE_GROUPS } from "../constants/surfaceTypes";
import { useBulkSurfaceActions } from "../hooks/useBulkSurfaceActions";
import BulkActions from "./BulkActions";
import SurfaceCheckboxGroup from "./SurfaceCheckboxGroup";
import SurfacePenaltyControl from "./SurfacePenaltyControl";
import RideStats from "./RideStats";
import MapAttribution from "./MapAttribution";
import PanelToolbar from "./PanelToolbar";
import * as styles from "./ControlPanel.styles";
import { useGeolocation } from "@/features/geolocation";
import AddressSearch from "@/features/routing/components/AddressSearch";
import { DEFAULT_MASK } from "@/shared";

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
    triggerCameraRefit,
    setSheetHeight,
    setSheetOffset,
  } = useRouteSettingsContext();

  const { isLocating, isTripActive, error: geoError, outOfBounds, startLocating, stopLocating, startTrip, stopTrip } = useGeolocation();

  const { totals, routeLoading, snappedStart, snappedStartSource, snappedEnd, routeCoords, setSnappedStart, setSnappedEnd } = useRoute();
  const hasSelection = Boolean(snappedStart && snappedEnd);
  const hasRoute = routeCoords.length > 1;
  const canStartTrip = snappedStartSource === "gps" && !!snappedEnd && hasRoute;

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
  }, [panelOpen, setSheetHeight]);

  const { selectAll, selectNone, selectPaved, selectUnpaved } = useBulkSurfaceActions(setDraftMask);

  const commitApply = () =>
    applySettings?.({ mask: draftMask, surfacePenaltySPerKm: Number(draftPenalty) });

  const handleClear = () => {
    setSnappedStart(null);
    setSnappedEnd(null);
    setDraftMask(DEFAULT_MASK);
    setDraftPenalty(0);
    applySettings({ mask: DEFAULT_MASK, surfacePenaltySPerKm: 0 });
    stopTrip();
    stopLocating();
  };

  const dragHandlers = { onPointerDown: startDrag, onTouchStart: startDrag };

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
          onPointerUp={() => endDrag(closePanel, (offset) => { setSheetOffset(offset); if (hasSelection) triggerCameraRefit(); })}
          onPointerCancel={() => endDrag(closePanel, setSheetOffset)}
          onTouchMove={onDragMove}
          onTouchEnd={() => endDrag(closePanel, (offset) => { setSheetOffset(offset); if (hasSelection) triggerCameraRefit(); })}
          onTouchCancel={() => endDrag(closePanel, setSheetOffset)}
        >
          <div
            style={styles.handleArea}
            onPointerDown={startDrag}
            onTouchStart={startDrag}
          >
            <div style={styles.handleBar} />
          </div>

          <PanelToolbar
            title={activeTab === "preferences" ? "Route Preferences" : "Route Planner"}
            headerStyle={styles.mobileHdr}
            headerDragHandlers={dragHandlers}
            canClear={Boolean(snappedStart || snappedEnd)}
            onClear={handleClear}
            isSatView={isSatView}
            onToggleSatView={toggleSatView}
            isTripActive={isTripActive}
            isLocating={isLocating}
            canStartTrip={canStartTrip}
            geoError={geoError}
            outOfBounds={outOfBounds}
            startLocating={startLocating}
            startTrip={startTrip}
            stopTrip={stopTrip}
            stopLocating={stopLocating}
            onAfterTripStop={() => { if (hasSelection) triggerCameraRefit(); }}
            onAfterTripStart={closePanel}
            tripContainerStyle={{ paddingBottom: 8, borderBottom: "1px solid #eee", marginBottom: 8 }}
          />

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
              onClick={() => { setActiveTab("preferences"); if (hasSelection) setTimeout(triggerCameraRefit, 0); }}
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
                onApply={() => { commitApply(); setActiveTab("preferences"); if (hasSelection) setTimeout(triggerCameraRefit, 0); }}
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
                onApply={() => { commitApply(); if (hasSelection) triggerCameraRefit(); }}
              />
              <RideStats
                sticky={false}
                hasSelection={hasSelection}
                hasRoute={hasRoute}
                routeLoading={routeLoading}
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
