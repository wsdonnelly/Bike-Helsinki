import React from "react";
import { RouteProvider, useRoute, AddressSearch } from "@/features/routing";
import { MapView } from "@/features/map";
import { ControlPanel, useRouteSettings } from "@/features/routeSettings";
import { InfoWindow } from "@/features/infoWindow";

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
  } = useRouteSettings();

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
      />

      <InfoWindow isVisible={false} onClose={() => {}} />
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
