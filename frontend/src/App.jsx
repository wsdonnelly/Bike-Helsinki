import React, { useState, useEffect, useCallback } from "react";
import { MapView } from "./components/MapView";
import ControlPanel from "./components/ControlPanel";
import InfoWindow from "./components/InfoWindow";
import { snapToGraph, getRoute } from "./utils/api";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const App = () => {
  // Points
  const [snappedStart, setSnappedStart] = useState(null); // { idx, lat, lon }
  const [snappedEnd, setSnappedEnd] = useState(null); // { idx, lat, lon }

  // Route
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeModes, setRouteModes] = useState([]);

  // Panel + masks
  const [panelOpen, setPanelOpen] = useState(false);
  const [appliedMask, setAppliedMask] = useState(0xffff); // effective
  const [draftMask, setDraftMask] = useState(0xffff); // edits

  // Surface penalty (seconds per km)
  const [appliedPenalty, setAppliedPenalty] = useState(0); // effective
  const [draftPenalty, setDraftPenalty] = useState(0); // UI edits

  // Info window state
  const [showInfoWindow, setShowInfoWindow] = useState(true);

  // Stats (meters / seconds)
  const [totalDistanceM, setTotalDistanceM] = useState(0);
  const [totalDurationS, setTotalDurationS] = useState(0);
  const [distanceBikePreferred, setDistanceBikePreferred] = useState(0);
  const [distanceBikeNonPreferred, setDistanceBikeNonPreferred] = useState(0);
  const [totalDistanceWalk, setDistanceWalk] = useState(0); // (name mismatch ok)

  const resetStats = () => {
    setTotalDistanceM(0);
    setTotalDurationS(0);
    setDistanceBikePreferred(0);
    setDistanceBikeNonPreferred(0);
    setDistanceWalk(0);
  };

  // Colors
  const colorBikePreferred = "#007AFF"; // blue solid
  const colorBikeNonPreferred = "#FF7F0E"; // orange solid
  const colorWalk = "#7C3AED"; // black dotted

  // ---- Info window handlers ----
  const closeInfoWindow = () => {
    setShowInfoWindow(false);
  };

  // ---- Routing ----
  const fetchRoute = useCallback(
    async (maskOverride, penaltyOverride) => {
      if (!snappedStart || !snappedEnd) return;

      // use current applied values unless overridden
      const mask = (maskOverride ?? appliedMask) & 0xffff;
      const penalty = clamp(penaltyOverride ?? appliedPenalty, 0, 1000);

      try {
        // build payload once so logs match exactly what we send
        const payload = {
          startIdx: snappedStart.idx,
          endIdx: snappedEnd.idx,
          options: {
            bikeSurfaceMask: mask,
            surfacePenaltySPerKm: penalty,
          },
        };

        // helpful, compact param log
        console.log("[fetchRoute] → getRoute payload", {
          startIdx: payload.startIdx,
          endIdx: payload.endIdx,
          bikeSurfaceMask: payload.options.bikeSurfaceMask,
          bikeSurfaceMask_hex:
            "0x" + mask.toString(16).toUpperCase().padStart(4, "0"),
          surfacePenaltySPerKm: payload.options.surfacePenaltySPerKm,
        });

        const result = await getRoute(payload);

        const coords = result?.coords ?? [];
        const modes = result?.modes ?? [];
        setRouteCoords(coords);
        setRouteModes(modes);

        setTotalDistanceM(result?.distanceM ?? 0);
        setTotalDurationS(result?.durationS ?? 0);
        setDistanceBikePreferred(result?.distanceBikePreferred ?? 0);
        setDistanceBikeNonPreferred(result?.distanceBikeNonPreferred ?? 0);
        setDistanceWalk(result?.distanceWalk ?? 0);

        if (coords.length < 2) resetStats();
      } catch (err) {
        console.error("Error fetching route:", err);
        setRouteCoords([]);
        setRouteModes([]);
        resetStats();
      }
    },
    [snappedStart, snappedEnd]
  );

  // Re-fetch when endpoints change
  useEffect(() => {
    if (snappedStart && snappedEnd) {
      fetchRoute(appliedMask, appliedPenalty);
    }
  }, [snappedStart, snappedEnd]); // ← endpoints only

  // ---- Map interactions ----
  const handleMapClick = async ({ lat, lng }) => {
    // Close info window on first map interaction
    if (showInfoWindow) {
      setShowInfoWindow(false);
    }

    try {
      const snapped = await snapToGraph(lat, lng);
      if (!snappedStart) {
        setSnappedStart(snapped);
      } else if (!snappedEnd) {
        setSnappedEnd(snapped);
      } else {
        setSnappedStart(snapped);
        setSnappedEnd(null);
        setRouteCoords([]);
        setRouteModes([]);
        resetStats();
      }
    } catch (err) {
      console.error("Snap error:", err);
    }
  };

  // ---- Panel + mask flow ----
  const openPanel = () => {
    // Close info window when opening control panel
    if (showInfoWindow) {
      setShowInfoWindow(false);
    }

    setDraftMask(appliedMask);
    setDraftPenalty(appliedPenalty);
    setPanelOpen(true);
  };

  const closePanel = () => setPanelOpen(false);

  const toggleDraftBit = (bit) => {
    setDraftMask((prev) => (prev & bit ? prev & ~bit : prev | bit));
  };

  // APPLY both settings at once
  const applySettings = async ({ mask, surfacePenaltySPerKm }) => {
    const nextMask = (mask ?? appliedMask) & 0xffff;
    const nextPenalty = clamp(surfacePenaltySPerKm ?? appliedPenalty, 0, 1000);

    const changed = nextMask !== appliedMask || nextPenalty !== appliedPenalty;
    setAppliedMask(nextMask);
    setAppliedPenalty(nextPenalty);

    if (changed) {
      await fetchRoute(nextMask, nextPenalty);
      console.log("✔ Applied", {
        bikeSurfaceMask: nextMask,
        surfacePenaltySPerKm: nextPenalty,
      });
    }
  };

  return (
    <>
      <MapView
        snappedStart={snappedStart}
        snappedEnd={snappedEnd}
        routeCoords={routeCoords}
        routeModes={routeModes}
        onMapClick={handleMapClick}
        colorBikePreferred={colorBikePreferred}
        colorBikeNonPreferred={colorBikeNonPreferred}
        colorWalk={colorWalk}
      />

      <ControlPanel
        panelOpen={panelOpen}
        onOpen={openPanel}
        onClose={closePanel}
        surfaceMask={draftMask}
        onToggleSurface={toggleDraftBit}
        onSetSurfaceMask={setDraftMask}
        surfacePenaltyDraft={draftPenalty}
        onSetSurfacePenalty={setDraftPenalty}
        onApply={applySettings}
        totalDistanceM={totalDistanceM}
        totalDurationS={totalDurationS}
        distanceBikePreferred={distanceBikePreferred}
        distanceBikeNonPreferred={distanceBikeNonPreferred}
        distanceWalk={totalDistanceWalk}
        hasSelection={Boolean(snappedStart && snappedEnd)}
        hasRoute={routeCoords.length > 1}
        colorBikePreferred={colorBikePreferred}
        colorBikeNonPreferred={colorBikeNonPreferred}
        colorWalk={colorWalk}
      />

      <InfoWindow
        isVisible={showInfoWindow}
        onClose={closeInfoWindow}
      />
    </>
  );
};

export default App;