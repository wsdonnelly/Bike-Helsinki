import { useEffect, useRef, useCallback } from "react";
import { MOBILE_SHEET_HEIGHT_PX } from "@/shared/constants/config";
import { computePadding, fitRouteBounds, fitCurrentRoute } from "@/features/map/utils/cameraGeometry";

export function useFitBounds({
  mapRef,
  snappedStart,
  snappedEnd,
  routeCoords,
  isMobile,
  panelOpen,
  isTripActive,
  routeFitTick,
  getSheetVisibleHeight,
}) {
  const prevStartIdx = useRef(null);
  const prevEndIdx = useRef(null);

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
    // Intentional: dep on .idx primitives (not full objects) so the effect only fires
    // when endpoint identity changes, not on every render that touches the objects.
    // panelOpen/isMobile are read as stable-enough closure values — they change rarely
    // and the [panelOpen] effect below handles the panel-toggle case.
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

  // Refit when panel open state changes.
  // Trip mode: TripController owns the camera on panel-close (zoom to GPS), so skip
  // fit-to-route on panel-close when a trip is active. On panel-open during a trip,
  // mobile needs an explicit refit (normally it only refits on panel-close).
  useEffect(() => {
    if (!snappedStart || !snappedEnd) return;
    const map = mapRef.current;
    if (!map) return;
    if (isMobile) {
      if (panelOpen) {
        // Mobile panel opened during trip: show full route so user can edit
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
      // Mobile panel closed: TripController handles the camera when trip is active
      if (isTripActive) return;
      fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd, computePadding(true, false));
      return;
    }
    // Desktop panel closed during trip: TripController zooms back to GPS
    if (!panelOpen && isTripActive) return;
    fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd, computePadding(false, panelOpen));
    // Intentional: reads snappedStart/snappedEnd/isTripActive/getSheetVisibleHeight as stale
    // closures — none of these change between the panel toggle and this effect running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Mobile explicit refit: triggered by Preferences tab, Apply, and Stop Trip
  useEffect(() => {
    if (routeFitTick === 0 || !snappedStart || !snappedEnd) return;
    const map = mapRef.current;
    if (!map) return;
    fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd,
      computePadding(true, false, getSheetVisibleHeight() || MOBILE_SHEET_HEIGHT_PX));
    // Intentional: reads snappedStart/snappedEnd/getSheetVisibleHeight as stable closure —
    // the tick counter is the only meaningful trigger; adding the others would cause
    // spurious refits on every endpoint update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFitTick]);

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
