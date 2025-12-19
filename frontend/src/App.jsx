import React from "react";
import { RouteProvider, useRoute, AddressSearch } from "@/features/routing";
import { MapView } from "@/features/map";
import { ControlPanel, useRouteSettings } from "@/features/routeSettings";
import { InfoWindow, useInfoWindow } from "@/features/infoWindow";

function AppContent() {
  const { snappedStart, snappedEnd, routeCoords, routeModes, totals, actions } =
    useRoute();

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
  } = useRouteSettings();

  const { visible: infoVisible, close: closeInfo } = useInfoWindow();
  const hasSelection = Boolean(snappedStart && snappedEnd);
  const hasRoute = routeCoords.length > 1;

  return (
    <>
      <AddressSearch />

      <MapView
        snappedStart={snappedStart}
        snappedEnd={snappedEnd}
        routeCoords={routeCoords}
        routeModes={routeModes}
        onMapClick={actions.handleMapClick}
        onMarkerDragEnd={actions.handleMarkerDragEnd}
        isSatView={isSatView}  // Pass satellite view state
      />

      <ControlPanel
        panelOpen={panelOpen}
        onOpen={openPanel}
        onClose={closePanel}
        surfaceMask={draftMask}
        onToggleSurface={toggleDraftBit}
        onSetSurfaceMask={setDraftMask}
        surfacePenaltyDraft={draftPenalty}
        onSetSurfacePenalty={setDraftPenalty}
        onApply={applySettings}
        totalDistanceM={totals.totalDistanceM}
        totalDurationS={totals.totalDurationS}
        distanceBikePreferred={totals.distanceBikePreferred}
        distanceBikeNonPreferred={totals.distanceBikeNonPreferred}
        distanceWalk={totals.totalDistanceWalk}
        hasSelection={hasSelection}
        hasRoute={hasRoute}
        isSatView={isSatView}
        onToggleSatView={toggleSatView}
      />

      <InfoWindow isVisible={infoVisible} onClose={closeInfo} />
    </>
  );
}

export default function App() {
  return (
    <RouteProvider>
      <AppContent />
    </RouteProvider>
  );
}