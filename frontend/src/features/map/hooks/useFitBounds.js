import { useEffect, useRef, useCallback } from "react";
import { SIDEBAR_WIDTH_PX, MOBILE_SHEET_HEIGHT_PX } from "@/shared/constants/config";

function computePadding(isMobile, panelOpen, sheetHeight = 0) {
  if (isMobile) {
    if (sheetHeight > 0) {
      return { top: 40, bottom: sheetHeight + 10, left: 60, right: 60 };
    }
    return { top: 80, bottom: 80, left: 80, right: 80 };
  }
  const leftPad = panelOpen ? SIDEBAR_WIDTH_PX + 80 : 80;
  return { top: 80, bottom: 80, left: leftPad, right: 80 };
}

function fitRouteBounds(map, start, end, padding) {
  map.fitBounds(
    [[Math.min(start.lon, end.lon), Math.min(start.lat, end.lat)],
     [Math.max(start.lon, end.lon), Math.max(start.lat, end.lat)]],
    { padding, duration: 800 }
  );
}

export function useFitBounds({ mapRef, snappedStart, snappedEnd, isMobile, panelOpen, routeFitTick, getSheetVisibleHeight }) {
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

  // Refit when panel open state changes:
  // - Desktop panel opens: refit with sidebar padding to reclaim viewport space
  // - Mobile panel closes: refit with full-screen symmetric padding
  useEffect(() => {
    if (!snappedStart || !snappedEnd) return;
    const map = mapRef.current;
    if (!map) return;
    if (isMobile) {
      if (panelOpen) return;
      fitRouteBounds(map, snappedStart, snappedEnd, computePadding(true, false));
      return;
    }
    fitRouteBounds(map, snappedStart, snappedEnd, computePadding(false, panelOpen));
    // Intentional: reads snappedStart/snappedEnd as stale closure — they don't change
    // between the panel toggle and this effect running, and listing them would cause
    // spurious refits on every endpoint update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Mobile explicit refit: triggered by Preferences tab, Apply, and Stop Trip
  useEffect(() => {
    if (routeFitTick === 0 || !snappedStart || !snappedEnd) return;
    const map = mapRef.current;
    if (!map) return;
    fitRouteBounds(map, snappedStart, snappedEnd,
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
      fitRouteBounds(map, a, b,
        computePadding(true, false, getSheetVisibleHeight() || MOBILE_SHEET_HEIGHT_PX));
    } else {
      fitRouteBounds(map, a, b, computePadding(false, panelOpen));
    }
  }, [mapRef, isMobile, panelOpen, getSheetVisibleHeight]);

  return { fitBoundsOnDrag };
}
