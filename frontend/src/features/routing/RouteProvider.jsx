import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { backend, nominatim } from "@/api";
import { clamp } from "@/shared";

const Ctx = createContext(null);
export const useRoute = () => useContext(Ctx);

export function RouteProvider({ children }) {
  // Config
  const [cfg, setCfg] = useState(null); // { bbox, viewbox, viewboxString }
  useEffect(() => {
    backend.getHelsinkiConfig().then(setCfg).catch(console.error);
  }, []);

  // Points { idx, lat, lon }
  const [snappedStart, setSnappedStart] = useState(null);
  const [snappedEnd, setSnappedEnd] = useState(null);

  // Route
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeModes, setRouteModes] = useState([]);

  // Masks / penalties
  const [appliedMask, setAppliedMask] = useState(0xffff);
  const [appliedPenalty, setAppliedPenalty] = useState(0);

  // Stats
  const [totalDistanceM, setTotalDistanceM] = useState(0);
  const [totalDurationS, setTotalDurationS] = useState(0);
  const [distanceBikePreferred, setDistanceBikePreferred] = useState(0);
  const [distanceBikeNonPreferred, setDistanceBikeNonPreferred] = useState(0);
  const [totalDistanceWalk, setDistanceWalk] = useState(0);

  const resetStats = () => {
    setTotalDistanceM(0);
    setTotalDurationS(0);
    setDistanceBikePreferred(0);
    setDistanceBikeNonPreferred(0);
    setDistanceWalk(0);
  };
  //debug logger
  useEffect(() => {
    const fmt = (p) =>
      p
        ? { idx: p.idx, lat: +p.lat, lon: +p.lon, address: p.address || "" }
        : null;

    console.log("[Route] points changed:", {
      start: fmt(snappedStart),
      end: fmt(snappedEnd),
    });
  }, [snappedStart, snappedEnd]);

  useEffect(() => {
    if (!snappedStart || !snappedEnd) {
      setRouteCoords([]);
      setRouteModes([]);
      resetStats();
    }
  }, [snappedStart, snappedEnd]);

  // ---- Routing ----
  const fetchRoute = useCallback(
    async (maskOverride, penaltyOverride) => {
      if (!snappedStart || !snappedEnd) return;

      const mask = (maskOverride ?? appliedMask) & 0xffff;
      const penalty = clamp(penaltyOverride ?? appliedPenalty, 0, 1000);

      const payload = {
        startIdx: snappedStart.idx,
        endIdx: snappedEnd.idx,
        options: { bikeSurfaceMask: mask, surfacePenaltySPerKm: penalty },
      };

      try {
        const result = await backend.getRoute(payload);
        const coords = result?.coords ?? [];
        setRouteCoords(coords);
        setRouteModes(result?.modes ?? []);
        setTotalDistanceM(result?.distanceM ?? 0);
        setTotalDurationS(result?.durationS ?? 0);
        setDistanceBikePreferred(result?.distanceBikePreferred ?? 0);
        setDistanceBikeNonPreferred(result?.distanceBikeNonPreferred ?? 0);
        setDistanceWalk(result?.distanceWalk ?? 0);
        if (coords.length < 2) resetStats();
      } catch (e) {
        console.error("Route error:", e);
        setRouteCoords([]);
        setRouteModes([]);
        resetStats();
      }
    },
    [snappedStart, snappedEnd, appliedMask, appliedPenalty]
  );

  // Re-fetch on endpoints change
  useEffect(() => {
    if (snappedStart && snappedEnd) fetchRoute();
  }, [snappedStart, snappedEnd, fetchRoute]);

  const reverseCtrlRef = useRef({ start: null, end: null });
  const resolveAddress = useCallback(
    async (endpoint, snapped, { debounceMs = 0 } = {}) => {
      if (!snapped) return;

      // Abort any previous reverse for this endpoint
      const prev = reverseCtrlRef.current[endpoint];
      if (prev) prev.abort?.();

      const ctrl = new AbortController();
      reverseCtrlRef.current[endpoint] = ctrl;

      // Optional small debounce after drag/drop
      if (debounceMs) {
        await new Promise((r) => setTimeout(r, debounceMs));
        if (ctrl.signal.aborted) return;
      }

      try {
        const rev = await nominatim.reverseNominatim({
          lat: snapped.lat,
          lon: snapped.lon,
          signal: ctrl.signal, // make sure your helper forwards this to fetch
        });
        const address = rev?.display_name || null;

        if (endpoint === "start") {
          // only update if we're still pointing at the same snapped node
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
    []
  );
  // ---- Map interaction ----
  const handleMapClick = async ({ lat, lon }) => {
    try {
      const snapped = await backend.snapToGraph(lat, lon);
      const snappedNoAddr = { ...snapped, address: null };

      if (!snappedStart) {
        setSnappedStart(snappedNoAddr); // render immediately
        resolveAddress("start", snappedNoAddr); // fill address later
      } else if (!snappedEnd) {
        setSnappedEnd(snappedNoAddr);
        resolveAddress("end", snappedNoAddr);
      } else {
        setSnappedStart(snappedNoAddr);
        setSnappedEnd(null);
        setRouteCoords([]);
        setRouteModes([]);
        resetStats();
        resolveAddress("start", snappedNoAddr);
      }
    } catch (e) {
      console.error("Snap error:", e);
    }
  };

  const handleMarkerDragEnd = useCallback(
    async (endpoint, { lat, lon }) => {
      try {
        // Clear the endpoint first to avoid flash of the old route (optional)
        if (endpoint === "start") setSnappedStart(null);
        else setSnappedEnd(null);

        const snapped = await backend.snapToGraph(lat, lon);
        const snappedNoAddr = { ...snapped, address: null };

        if (endpoint === "start") setSnappedStart(snappedNoAddr);
        else setSnappedEnd(snappedNoAddr);

        // Small debounce helps if user drops, re-drags quickly
        resolveAddress(endpoint, snappedNoAddr, { debounceMs: 150 });
      } catch (e) {
        console.error("Drag snap error:", e);
      }
    },
    [resolveAddress]
  );

  // ---- Settings apply ----
  const applySettings = async ({ mask, surfacePenaltySPerKm }) => {
    const nextMask = (mask ?? appliedMask) & 0xffff;
    const nextPenalty = clamp(surfacePenaltySPerKm ?? appliedPenalty, 0, 1000);
    const changed = nextMask !== appliedMask || nextPenalty !== appliedPenalty;
    setAppliedMask(nextMask);
    setAppliedPenalty(nextPenalty);
    if (changed) await fetchRoute(nextMask, nextPenalty);
  };

  // ---- Geocode helpers ----
  const searchAddress = useCallback(
    async (q, { limit = 5, lang = "fi" } = {}) => {
      if (!cfg?.viewboxString || !q?.trim()) return [];
      try {
        return await nominatim.searchNominatim({
          q: q.trim(),
          viewbox: cfg.viewboxString,
          bounded: true,
          lang,
          limit,
        });
      } catch (e) {
        console.error("Nominatim failed:", e);
        return [];
      }
    },
    [cfg?.viewboxString]
  );

  const setPointFromHit = useCallback(
    async (hit, endpoint /* 'start'|'end' */) => {
      if (!hit) return null;
      try {
        const snapped = await backend.snapToGraph(
          Number(hit.lat),
          Number(hit.lon)
        );
        const snappedWithAddress = {
          ...snapped,
          address: hit.display_name, // Save the address
        };
        if (endpoint === "start") setSnappedStart(snappedWithAddress);
        else setSnappedEnd(snappedWithAddress);
        return { hit, snapped: snappedWithAddress };
      } catch (e) {
        console.error("Snap from hit failed:", e);
        return null;
      }
    },
    []
  );

  // return query top match
  const setPointFromAddress = useCallback(
    async (q, endpoint) => {
      const hits = await searchAddress(q);
      if (!hits.length) return null;
      return setPointFromHit(hits[0], endpoint);
    },
    [searchAddress, setPointFromHit]
  );

  const value = {
    cfg,
    snappedStart,
    setSnappedStart,
    snappedEnd,
    setSnappedEnd,
    routeCoords,
    routeModes,
    totals: {
      totalDistanceM,
      totalDurationS,
      distanceBikePreferred,
      distanceBikeNonPreferred,
      totalDistanceWalk,
    },
    settings: { appliedMask, appliedPenalty, applySettings },
    actions: {
      handleMapClick,
      handleMarkerDragEnd,
      fetchRoute,
      searchAddress,
      setPointFromHit,
      setPointFromAddress,
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
