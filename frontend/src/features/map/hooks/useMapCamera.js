import { useEffect, useRef, useCallback } from "react";
import { MOBILE_SHEET_HEIGHT_PX, LOCATE_FLY_ZOOM, TRIP_FLY_ZOOM } from "@/shared/constants/config";
import { computePadding, fitRouteBounds, fitCurrentRoute } from "@/features/map/utils/cameraGeometry";

export function useMapCamera({
  mapRef,
  snappedStart,
  snappedEnd,
  routeCoords,
  isMobile,
  panelOpen,
  cameraRefitTick,
  getSheetVisibleHeight,
  isTripActive,
  isLocating,
  position,
  bearing,
}) {
  const cameraMode = isTripActive && !panelOpen ? "navigation" : "planning";

  const prevStartIdx = useRef(null);
  const prevEndIdx = useRef(null);
  const hasCenteredOnLocateRef = useRef(false);
  const hasCenteredRef = useRef(false);
  const lastFlyRef = useRef(0);
  const prevPanelOpenRef = useRef(panelOpen);

  // --- Planning effects ---

  // Fit when either endpoint changes (skips if both indices are unchanged)
  useEffect(() => {
    if (!snappedStart || !snappedEnd) return;
    if (snappedStart.idx === prevStartIdx.current && snappedEnd.idx === prevEndIdx.current) return;
    prevStartIdx.current = snappedStart.idx;
    prevEndIdx.current = snappedEnd.idx;
    const map = mapRef.current;
    if (!map) return;
    if (isMobile) {
      if (panelOpen) return;
      fitRouteBounds(map, snappedStart, snappedEnd, computePadding(true, false));
      return;
    }
    const bounds = map.getBounds();
    if (bounds.contains([snappedStart.lon, snappedStart.lat]) &&
        bounds.contains([snappedEnd.lon, snappedEnd.lat])) return;
    fitRouteBounds(map, snappedStart, snappedEnd, computePadding(false, panelOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snappedStart?.idx, snappedEnd?.idx]);

  useEffect(() => {
    if (routeCoords.length < 2) return;
    const map = mapRef.current;
    if (!map) return;

    if (isMobile) {
      if (panelOpen) {
        if (!isTripActive) return;
        setTimeout(() => {
          const currentMap = mapRef.current;
          if (!currentMap) return;
          fitCurrentRoute(
            currentMap,
            routeCoords,
            snappedStart,
            snappedEnd,
            computePadding(true, false, getSheetVisibleHeight() || MOBILE_SHEET_HEIGHT_PX)
          );
        }, 0);
        return;
      }
      if (isTripActive) return;
      fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd, computePadding(true, false));
      return;
    }

    if (isTripActive && !panelOpen) return;
    fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd, computePadding(false, panelOpen));
  }, [routeCoords, panelOpen, isMobile, isTripActive, mapRef, snappedStart, snappedEnd, getSheetVisibleHeight]);

  // Refit on panel toggle, with navigation-aware branching
  useEffect(() => {
    const wasOpen = prevPanelOpenRef.current;
    prevPanelOpenRef.current = panelOpen;

    const map = mapRef.current;
    if (!map) return;

    // Panel closed during active trip: reset hasCenteredRef so the navigation
    // follow effect fires its "first entry" branch and flies to TRIP_FLY_ZOOM.
    // Doing the flyTo here would be overridden by the follow effect (same render,
    // runs after this one) using map.getZoom() instead of TRIP_FLY_ZOOM.
    if (wasOpen && !panelOpen && isTripActive) {
      hasCenteredRef.current = false;
      return;
    }

    // Planning: refit route on panel open/close
    if (!snappedStart || !snappedEnd) return;
    if (isMobile) {
      if (panelOpen) {
        if (!isTripActive) return;
        const savedStart = snappedStart;
        const savedEnd = snappedEnd;
        const savedRouteCoords = routeCoords;
        setTimeout(() => {
          const currentMap = mapRef.current;
          if (!currentMap) return;
          fitCurrentRoute(
            currentMap,
            savedRouteCoords,
            savedStart,
            savedEnd,
            computePadding(true, false, getSheetVisibleHeight() || MOBILE_SHEET_HEIGHT_PX)
          );
        }, 0);
        return;
      }
      if (isTripActive) return;
      fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd, computePadding(true, false));
      return;
    }
    if (!panelOpen && isTripActive) return;
    fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd, computePadding(false, panelOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Mobile explicit refit tick
  useEffect(() => {
    if (cameraRefitTick === 0 || !snappedStart || !snappedEnd) return;
    const map = mapRef.current;
    if (!map) return;
    fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd,
      computePadding(true, false, getSheetVisibleHeight() || MOBILE_SHEET_HEIGHT_PX));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRefitTick]);

  // --- Navigation effects ---

  // Effect A: One-shot locate fly-to
  useEffect(() => {
    if (!isLocating || !position || hasCenteredOnLocateRef.current) return;
    mapRef.current?.flyTo({ center: [position.lon, position.lat], zoom: LOCATE_FLY_ZOOM, duration: 800 });
    hasCenteredOnLocateRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, isLocating]);

  useEffect(() => {
    if (!isLocating) hasCenteredOnLocateRef.current = false;
  }, [isLocating]);

  // Effect B: Navigation follow camera
  useEffect(() => {
    if (cameraMode !== "navigation" || !position) return;
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
    if (bearing != null) map.rotateTo(bearing, { duration: 300 });
    lastFlyRef.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, cameraMode]);

  useEffect(() => {
    if (!isTripActive) hasCenteredRef.current = false;
  }, [isTripActive]);

  // --- Drag helper ---

  const fitBoundsOnDrag = useCallback((a, b) => {
    const map = mapRef.current;
    if (!map) return;
    if (isMobile) {
      fitRouteBounds(map, a, b, computePadding(true, false, getSheetVisibleHeight() || MOBILE_SHEET_HEIGHT_PX));
    } else {
      fitRouteBounds(map, a, b, computePadding(false, panelOpen));
    }
  }, [mapRef, isMobile, panelOpen, getSheetVisibleHeight]);

  return { fitBoundsOnDrag };
}
