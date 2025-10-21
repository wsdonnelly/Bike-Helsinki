import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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

  // ---- Map interaction ----
  const handleMapClick = async ({ lat, lng }) => {
    try {
      const snapped = await backend.snapToGraph(lat, lng);
      let address = null;
      try {
        const reverseResult = await nominatim.reverseNominatim({
          lat: snapped.lat,
          lon: snapped.lon,
        });
        address = reverseResult?.display_name || null;
      } catch (e) {
        console.warn("Reverse geocoding failed:", e);
      }
      const snappedWithAddress = {
        ...snapped,
        address,
      };
      if (!snappedStart) {
        setSnappedStart(snappedWithAddress);
      } else if (!snappedEnd) {
        setSnappedEnd(snappedWithAddress);
      } else {
        setSnappedStart(snappedWithAddress);
        setSnappedEnd(null);
        setRouteCoords([]);
        setRouteModes([]);
        resetStats();
      }
    } catch (e) {
      console.error("Snap error:", e);
    }
  };

  const handleMarkerDragEnd = useCallback(
    async (endpoint, { lat, lng }) => {
      try {
        // snap to graph
        const snapped = await backend.snapToGraph(lat, lng);

        // optional: reverse geocode for display
        let address = null;
        try {
          const rev = await nominatim.reverseNominatim({
            lat: snapped.lat,
            lon: snapped.lon,
          });
          address = rev?.display_name || null;
        } catch (e) {
          console.warn("Reverse geocoding failed:", e);
        }

        const withAddress = { ...snapped, address };

        if (endpoint === "start") setSnappedStart(withAddress);
        else setSnappedEnd(withAddress);

        // No need to call fetchRoute() here; your effect handles it when both are set.
      } catch (e) {
        console.error("Drag snap error:", e);
      }
    },
    [] // uses setSnappedStart/End which are stable; routing happens via the effect
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
