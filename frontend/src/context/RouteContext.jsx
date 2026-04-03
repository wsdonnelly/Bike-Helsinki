import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { backend, geocoding } from "@/api";
import { clamp, MAX_PENALTY, DRAG_DEBOUNCE_MS, DEFAULT_MASK } from "@/shared";
import { useReverseGeocoding } from "./hooks/useReverseGeocoding";

const Ctx = createContext(null);
export const useRoute = () => useContext(Ctx);

export function RouteProvider({ children }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    backend.getHelsinkiConfig().then(setCfg).catch(console.error);
  }, []);

  const [snappedStart, setSnappedStart] = useState(null);
  const [snappedEnd, setSnappedEnd] = useState(null);

  const [routeCoords, setRouteCoords] = useState([]);
  const [routeModes, setRouteModes] = useState([]);

  const [appliedMask, setAppliedMask] = useState(DEFAULT_MASK);
  const [appliedPenalty, setAppliedPenalty] = useState(0);

  const defaultTotals = { totalDistanceM: 0, totalDurationS: 0, distanceBikePreferred: 0, distanceBikeNonPreferred: 0, totalDistanceWalk: 0 };
  const [totals, setTotals] = useState(defaultTotals);
  const [routeLoading, setRouteLoading] = useState(false);

  const resetStats = useCallback(() => setTotals(defaultTotals), []);

  useEffect(() => {
    if (!snappedStart || !snappedEnd) {
      setRouteCoords([]);
      setRouteModes([]);
      resetStats();
    }
  }, [snappedStart, snappedEnd]);

  const fetchRoute = useCallback(
    async (maskOverride, penaltyOverride) => {
      if (!snappedStart || !snappedEnd) return;

      const mask = (maskOverride ?? appliedMask) & 0xffff;
      const penalty = clamp(penaltyOverride ?? appliedPenalty, 0, MAX_PENALTY);

      const payload = {
        startIdx: snappedStart.idx,
        endIdx: snappedEnd.idx,
        options: { bikeSurfaceMask: mask, surfacePenaltySPerKm: penalty },
      };

      try {
        setRouteLoading(true);
        const result = await backend.getRoute(payload);
        const coords = result?.coords ?? [];
        setRouteCoords(coords);
        setRouteModes(result?.modes ?? []);
        setTotals({
          totalDistanceM: result?.distanceM ?? 0,
          totalDurationS: result?.durationS ?? 0,
          distanceBikePreferred: result?.distanceBikePreferred ?? 0,
          distanceBikeNonPreferred: result?.distanceBikeNonPreferred ?? 0,
          totalDistanceWalk: result?.distanceWalk ?? 0,
        });
        if (coords.length < 2) resetStats();
      } catch (e) {
        console.error("Route error:", e);
        setRouteCoords([]);
        setRouteModes([]);
        resetStats();
      } finally {
        setRouteLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snappedStart?.idx, snappedEnd?.idx, appliedMask, appliedPenalty]
  );

  useEffect(() => {
    if (snappedStart && snappedEnd) fetchRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snappedStart?.idx, snappedEnd?.idx, fetchRoute]);

  const { resolveAddress } = useReverseGeocoding(setSnappedStart, setSnappedEnd);

  const handleMapClick = useCallback(
    async ({ lat, lon }) => {
      try {
        const snapped = await backend.snapToGraph(lat, lon);
        const snappedNoAddr = { ...snapped, address: null };

        if (!snappedStart) {
          setSnappedStart(snappedNoAddr);
          resolveAddress("start", snappedNoAddr);
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
    },
    [snappedStart, snappedEnd, resolveAddress, resetStats]
  );

  const handleMarkerDragEnd = useCallback(
    async (endpoint, { lat, lon }) => {
      try {
        if (endpoint === "start") setSnappedStart(null);
        else setSnappedEnd(null);

        const snapped = await backend.snapToGraph(lat, lon);
        const snappedNoAddr = { ...snapped, address: null };

        if (endpoint === "start") setSnappedStart(snappedNoAddr);
        else setSnappedEnd(snappedNoAddr);

        resolveAddress(endpoint, snappedNoAddr, { debounceMs: DRAG_DEBOUNCE_MS });
      } catch (e) {
        console.error("Drag snap error:", e);
      }
    },
    [resolveAddress]
  );

  const applySettings = useCallback(
    ({ mask, surfacePenaltySPerKm }) => {
      const nextMask = (mask ?? appliedMask) & 0xffff;
      const nextPenalty = clamp(surfacePenaltySPerKm ?? appliedPenalty, 0, MAX_PENALTY);
      setAppliedMask(nextMask);
      setAppliedPenalty(nextPenalty);
    },
    [appliedMask, appliedPenalty]
  );

  const searchAddress = useCallback(
    async (q, { limit = 5, lang = "fi", signal } = {}) => {
      if (!cfg?.viewboxString || !q?.trim()) return [];
      try {
        return await geocoding.searchAddresses({
          q: q.trim(),
          viewbox: cfg.viewboxString,
          bounded: true,
          lang,
          limit,
          signal,
        });
      } catch (e) {
        if (e?.code === "ERR_CANCELED") return [];
        console.error("Nominatim failed:", e);
        return [];
      }
    },
    [cfg?.viewboxString]
  );

  const setPointFromHit = useCallback(
    async (hit, endpoint) => {
      if (!hit) return null;
      try {
        const snapped = await backend.snapToGraph(Number(hit.lat), Number(hit.lon));
        const snappedWithAddress = { ...snapped, address: hit.display_name };
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

  const setPointFromAddress = useCallback(
    async (q, endpoint) => {
      const hits = await searchAddress(q);
      if (!hits.length) return null;
      return setPointFromHit(hits[0], endpoint);
    },
    [searchAddress, setPointFromHit]
  );

  const setPointFromCoords = useCallback(async (lat, lon, which) => {
    try {
      const snapped = await backend.snapToGraph(lat, lon);
      if (!snapped) return;
      const point = { ...snapped, address: "Current location" };
      if (which === "start") setSnappedStart(point);
      else setSnappedEnd(point);
    } catch (e) {
      console.error("Snap from coords failed:", e);
    }
  }, []);

  const settings = useMemo(
    () => ({ appliedMask, appliedPenalty, applySettings }),
    [appliedMask, appliedPenalty, applySettings]
  );

  const actions = useMemo(
    () => ({
      handleMapClick,
      handleMarkerDragEnd,
      fetchRoute,
      searchAddress,
      setPointFromHit,
      setPointFromAddress,
      setPointFromCoords,
    }),
    [handleMapClick, handleMarkerDragEnd, fetchRoute, searchAddress, setPointFromHit, setPointFromAddress, setPointFromCoords]
  );

  const value = useMemo(
    () => ({
      cfg,
      snappedStart,
      setSnappedStart,
      snappedEnd,
      setSnappedEnd,
      routeCoords,
      routeModes,
      totals,
      routeLoading,
      settings,
      actions,
    }),
    [cfg, snappedStart, snappedEnd, routeCoords, routeModes, totals, routeLoading, settings, actions]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
