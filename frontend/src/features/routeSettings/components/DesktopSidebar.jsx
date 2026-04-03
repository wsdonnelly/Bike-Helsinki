import React from "react";
import { useRoute } from "@/features/routing";
import { useRouteSettingsContext } from "../context/RouteSettingsContext";
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

  const { isLocating, isTripActive, error: geoError, startLocating, stopLocating, startTrip, stopTrip } = useGeolocation();

  const { totals, routeLoading, snappedStart, snappedEnd, routeCoords, setSnappedStart, setSnappedEnd } = useRoute();
  const hasSelection = Boolean(snappedStart && snappedEnd);
  const hasRoute = routeCoords.length > 1;

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

  return (
    <div style={styles.containerStyle}>
      {!panelOpen && (
        <button
          type="button"
          aria-label="Open route planner"
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
          aria-label="Route Planner"
          style={styles.panel}
        >
          <PanelToolbar
            title="Route Planner"
            headerStyle={styles.hdr}
            canClear={Boolean(snappedStart || snappedEnd)}
            onClear={handleClear}
            onClose={closePanel}
            isSatView={isSatView}
            onToggleSatView={toggleSatView}
            isTripActive={isTripActive}
            isLocating={isLocating}
            hasSelection={hasSelection}
            geoError={geoError}
            startLocating={startLocating}
            startTrip={startTrip}
            stopTrip={stopTrip}
            stopLocating={stopLocating}
            onAfterTripStart={closePanel}
          />

          <div style={{ marginBottom: 12 }}>
            <AddressSearch />
          </div>

          <BulkActions
            onSelectAll={selectAll}
            onSelectNone={selectNone}
            onSelectPaved={selectPaved}
            onSelectUnpaved={selectUnpaved}
            onApply={commitApply}
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
              routeLoading={routeLoading}
              totalDistanceM={totals.totalDistanceM}
              totalDurationS={totals.totalDurationS}
              distanceBikePreferred={totals.distanceBikePreferred}
              distanceBikeNonPreferred={totals.distanceBikeNonPreferred}
              distanceWalk={totals.totalDistanceWalk}
            />
            <MapAttribution />
          </div>
        </div>
      )}
    </div>
  );
}
