import { useEffect, useRef } from "react";
import { useGeolocation } from "../context/GeolocationContext";
import { useRouteSettingsContext } from "@/features/routeSettings/context/RouteSettingsContext";
import { LOCATE_FLY_ZOOM, TRIP_FLY_ZOOM } from "@/shared/constants/config";

export function TripController({ mapRef }) {
  const { position, isLocating, isTripActive } = useGeolocation();
  const { panelOpen } = useRouteSettingsContext();
  const lastFlyRef = useRef(0);
  const hasCenteredRef = useRef(false);
  const hasCenteredOnLocateRef = useRef(false);
  const prevPanelOpenRef = useRef(panelOpen);

  useEffect(() => {
    if (!isLocating || !position || hasCenteredOnLocateRef.current) return;
    mapRef.current?.flyTo({ center: [position.lon, position.lat], zoom: LOCATE_FLY_ZOOM, duration: 800 });
    hasCenteredOnLocateRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, isLocating]);

  useEffect(() => {
    if (!isLocating) hasCenteredOnLocateRef.current = false;
  }, [isLocating]);

  useEffect(() => {
    if (!isTripActive || !position || panelOpen) return;
    const map = mapRef.current;
    if (!map) return;
    const now = Date.now();
    if (!hasCenteredRef.current) {
      map.flyTo({ center: [position.lon, position.lat], zoom: TRIP_FLY_ZOOM, duration: 500 });
      hasCenteredRef.current = true;
      lastFlyRef.current = now;
      return;
    }
    if (now - lastFlyRef.current < 1000) return;
    map.flyTo({ center: [position.lon, position.lat], zoom: map.getZoom(), duration: 300 });
    if (position.heading != null) {
      map.rotateTo(position.heading, { duration: 300 });
    }
    lastFlyRef.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, isTripActive, panelOpen]);

  useEffect(() => {
    if (!isTripActive) hasCenteredRef.current = false;
  }, [isTripActive]);

  useEffect(() => {
    const wasOpen = prevPanelOpenRef.current;
    prevPanelOpenRef.current = panelOpen;
    if (wasOpen && !panelOpen && isTripActive && position) {
      mapRef.current?.flyTo({ center: [position.lon, position.lat], zoom: TRIP_FLY_ZOOM, duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  return null;
}
