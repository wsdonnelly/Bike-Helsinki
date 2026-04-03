import { useRef, useCallback } from "react";
import { geocoding } from "@/api";

export function useReverseGeocoding(setSnappedStart, setSnappedEnd) {
  const reverseCtrlRef = useRef({ start: null, end: null });

  const resolveAddress = useCallback(
    async (endpoint, snapped, { debounceMs = 0 } = {}) => {
      if (!snapped) return;

      const prev = reverseCtrlRef.current[endpoint];
      if (prev) prev.abort?.();

      const ctrl = new AbortController();
      reverseCtrlRef.current[endpoint] = ctrl;

      if (debounceMs) {
        await new Promise((r) => setTimeout(r, debounceMs));
        if (ctrl.signal.aborted) return;
      }

      try {
        const rev = await geocoding.reverseGeocode({
          lat: snapped.lat,
          lon: snapped.lon,
          signal: ctrl.signal,
        });
        const address = rev?.display_name || null;

        if (endpoint === "start") {
          setSnappedStart((p) =>
            p && p.idx === snapped.idx ? { ...p, address } : p
          );
        } else {
          setSnappedEnd((p) =>
            p && p.idx === snapped.idx ? { ...p, address } : p
          );
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          console.warn("Reverse geocoding failed:", e);
        }
      } finally {
        if (reverseCtrlRef.current[endpoint] === ctrl) {
          reverseCtrlRef.current[endpoint] = null;
        }
      }
    },
    [setSnappedStart, setSnappedEnd]
  );

  return { resolveAddress };
}
