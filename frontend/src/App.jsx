import React from "react";
import { RouteProvider, useRoute, AddressSearch } from "@/features/routing";
import { MapView } from "@/features/map";
import { ControlPanel, RouteSettingsProvider } from "@/features/routeSettings";
import { InfoWindow, useInfoWindow } from "@/features/infoWindow";
import { ErrorBoundary } from "@/shared";

function AppContent() {
  const { snappedStart, snappedEnd, routeCoords, routeModes, actions } =
    useRoute();

  const { visible: infoVisible, close: closeInfo } = useInfoWindow();

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
      />

      <ControlPanel />

      <InfoWindow isVisible={infoVisible} onClose={closeInfo} />
    </>
  );
}

export default function App() {
  return (
    <RouteProvider>
      <ErrorBoundary>
        <RouteSettingsProvider>
          <AppContent />
        </RouteSettingsProvider>
      </ErrorBoundary>
    </RouteProvider>
  );
}
