import React from "react";
import { RouteProvider, useRoute } from "@/features/routing";
import { MapView } from "@/features/map";
import { ControlPanel, RouteSettingsProvider } from "@/features/routeSettings";
import { InfoWindow, useInfoWindow } from "@/features/infoWindow";
import { ErrorBoundary } from "@/shared";
import { GeolocationProvider } from "@/features/geolocation";
import { DEV_TOOLS_ENABLED, PreviewTripProvider, PreviewTripSlider } from "@/features/devTools";

function AppContent() {
  const { snappedStart, snappedEnd, routeCoords, routeModes, actions } =
    useRoute();

  const { visible: infoVisible, close: closeInfo } = useInfoWindow();

  return (
    <>
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

      {DEV_TOOLS_ENABLED && <PreviewTripSlider />}
    </>
  );
}

export default function App() {
  return (
    <RouteProvider>
      <ErrorBoundary>
        <RouteSettingsProvider>
          <GeolocationProvider>
            {DEV_TOOLS_ENABLED ? (
              <PreviewTripProvider>
                <AppContent />
              </PreviewTripProvider>
            ) : (
              <AppContent />
            )}
          </GeolocationProvider>
        </RouteSettingsProvider>
      </ErrorBoundary>
    </RouteProvider>
  );
}
