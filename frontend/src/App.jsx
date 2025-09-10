import React, { useState, useEffect, useCallback } from "react";
import { MapView } from "./components/MapView";
import ControlPanel from "./components/ControlPanel";
import { snapToGraph, getRoute } from "./utils/api";

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

  // Stats (meters / seconds)
  const [totalDistanceM, setTotalDistanceM] = useState(0);
  const [totalDurationS, setTotalDurationS] = useState(0);
  const [distanceBike, setDistanceBike] = useState(0);
  const [totalDistanceWalk, setDistanceWalk] = useState(0); // note: name mismatch is OK but a bit confusing

  const resetStats = () => {
    setTotalDistanceM(0);
    setTotalDurationS(0);
    setDistanceBike(0);
    setDistanceWalk(0);
  };

  // ---- Routing ----
  const fetchRoute = useCallback(
    async (maskOverride) => {
      if (!snappedStart || !snappedEnd) return;
      const mask = maskOverride ?? appliedMask;
      try {
        const result = await getRoute({
          startIdx: snappedStart.idx,
          endIdx: snappedEnd.idx,
          options: { bikeSurfaceMask: mask },
        });

        console.log("ROUTE RESULT", result);
        console.log("ROUTE TIME", (result?.durationS ?? 0) / 60, "mins");
        console.log("ROUTE LENGTH", (result?.distanceM ?? 0) / 1000, "KM");
        console.log(
          "ROUTE distanceBike",
          (result?.distanceBike ?? 0) / 1000,
          "KM"
        );
        console.log(
          "ROUTE distanceWalk",
          (result?.distanceWalk ?? 0) / 1000,
          "KM"
        );

        // Update geometry
        const coords = result?.coords ?? [];
        const modes = result?.modes ?? [];
        setRouteCoords(coords);
        setRouteModes(modes);

        // ✅ Update stats (meters/seconds)
        setTotalDistanceM(result?.distanceM ?? 0);
        setTotalDurationS(result?.durationS ?? 0);
        setDistanceBike(result?.distanceBike ?? 0);
        setDistanceWalk(result?.distanceWalk ?? 0);

        // If no route returned, reset stats as well
        if (coords.length < 2) resetStats();
      } catch (err) {
        console.error("Error fetching route:", err);
        setRouteCoords([]);
        setRouteModes([]);
        resetStats(); // ✅ clear stats on error
      }
    },
    [snappedStart, snappedEnd, appliedMask]
  );

  // Re-fetch when endpoints change
  useEffect(() => {
    fetchRoute();
  }, [snappedStart, snappedEnd, fetchRoute]);

  // ---- Map interactions ----
  const handleMapClick = async ({ lat, lng }) => {
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
        resetStats(); // ✅ clear stats when starting a new selection
      }
    } catch (err) {
      console.error("Snap error:", err);
    }
  };

  // ---- Panel + mask flow ----
  const openPanel = () => {
    setDraftMask(appliedMask);
    setPanelOpen(true);
  };
  const closePanel = () => setPanelOpen(false);

  const toggleDraftBit = (bit) => {
    setDraftMask((prev) => (prev & bit ? prev & ~bit : prev | bit));
  };

  const applyMask = async (newMask) => {
    if (newMask === appliedMask) return;
    setAppliedMask(newMask);
    await fetchRoute(newMask); // ✅ fetch immediately with this mask
    console.log("✔ Applied new surface mask", newMask);
  };

  return (
    <>
      <MapView
        snappedStart={snappedStart}
        snappedEnd={snappedEnd}
        routeCoords={routeCoords}
        routeModes={routeModes}
        onMapClick={handleMapClick}
      />

      <ControlPanel
        panelOpen={panelOpen}
        onOpen={openPanel}
        onClose={closePanel}
        surfaceMask={draftMask}
        onToggleSurface={toggleDraftBit}
        onSetSurfaceMask={setDraftMask}
        onApply={applyMask}
        totalDistanceM={totalDistanceM}
        totalDurationS={totalDurationS}
        distanceBike={distanceBike}
        distanceWalk={totalDistanceWalk}

        hasSelection={Boolean(snappedStart && snappedEnd)}
        hasRoute={routeCoords.length > 0}
      />
    </>
  );
};

export default App;
