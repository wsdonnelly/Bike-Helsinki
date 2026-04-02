import { useEffect, useRef, useCallback } from "react";
import { SIDEBAR_WIDTH_PX, MOBILE_SHEET_HEIGHT_PX } from "@/shared/constants/config";

function fitRouteBounds(map, start, end, padding) {
  map.fitBounds(
    [[Math.min(start.lon, end.lon), Math.min(start.lat, end.lat)],
     [Math.max(start.lon, end.lon), Math.max(start.lat, end.lat)]],
    { padding, duration: 800 }
  );
}

export function useFitBounds({ mapRef, snappedStart, snappedEnd, isMobile, panelOpen, routeFitTick, getSheetHeight }) {
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
      fitRouteBounds(map, snappedStart, snappedEnd,
        { top: 80, bottom: 80, left: 80, right: 80 });
      return;
    }
    const bounds = map.getBounds();
    if (bounds.contains([snappedStart.lon, snappedStart.lat]) &&
        bounds.contains([snappedEnd.lon, snappedEnd.lat])) return;
    const leftPad = panelOpen ? SIDEBAR_WIDTH_PX + 80 : 80;
    fitRouteBounds(map, snappedStart, snappedEnd,
      { top: 80, bottom: 80, left: leftPad, right: 80 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snappedStart?.idx, snappedEnd?.idx]);

  // Desktop only: refit when sidebar opens to reclaim viewport space
  useEffect(() => {
    if (!snappedStart || !snappedEnd) return;
    const map = mapRef.current;
    if (!map) return;
    if (isMobile || !panelOpen) return;
    fitRouteBounds(map, snappedStart, snappedEnd,
      { top: 80, bottom: 80, left: SIDEBAR_WIDTH_PX + 80, right: 80 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Mobile explicit refit: triggered by Preferences tab, Apply, and Stop Trip
  useEffect(() => {
    if (routeFitTick === 0 || !snappedStart || !snappedEnd) return;
    const map = mapRef.current;
    if (!map) return;
    fitRouteBounds(map, snappedStart, snappedEnd,
      { top: 60, bottom: getSheetHeight() || MOBILE_SHEET_HEIGHT_PX, left: 60, right: 60 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFitTick]);

  const fitBoundsOnDrag = useCallback((a, b) => {
    const map = mapRef.current;
    if (!map) return;
    fitRouteBounds(map, a, b,
      { top: 60, bottom: getSheetHeight() || MOBILE_SHEET_HEIGHT_PX, left: 60, right: 60 });
  }, [mapRef, getSheetHeight]);

  return { fitBoundsOnDrag };
}
