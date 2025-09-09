import React, { useState, useEffect, useCallback } from 'react';
import { MapView } from './components/MapView';
import ControlPanel from './components/ControlPanel';
import { snapToGraph, getRoute } from './utils/api';

const App = () => {
  // Points
  const [snappedStart, setSnappedStart] = useState(null); // { idx, lat, lon }
  const [snappedEnd,   setSnappedEnd]   = useState(null); // { idx, lat, lon }

  // Route
  const [routeCoords,  setRouteCoords]  = useState([]);
  const [routeModes,   setRouteModes]   = useState([]);

  // Panel + masks
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [appliedMask,  setAppliedMask]  = useState(0xFFFF); // effective
  const [draftMask,    setDraftMask]    = useState(0xFFFF); // edits

  // ---- Routing ----
  const fetchRoute = useCallback(
    async (maskOverride) => {
      if (!snappedStart || !snappedEnd) return;
      const mask = maskOverride ?? appliedMask;
      try {
        const result = await getRoute({
          startIdx: snappedStart.idx,
          endIdx:   snappedEnd.idx,
          options:  { bikeSurfaceMask: mask }
        });
        console.log('ROUTE RESULT', result);
        console.log('ROUTE TIME', (result?.durationS ?? 0) / 60, 'mins');
        console.log('ROUTE LENGTH', (result?.distanceM ?? 0) / 1000, 'KM');
        console.log('ROUTE distanceBike', (result?.distanceBike ?? 0) / 1000, 'KM');
        console.log('ROUTE distanceWalk', (result?.distanceWalk ?? 0) / 1000, 'KM');

        setRouteCoords(result?.coords ?? []);
        setRouteModes(result?.modes  ?? []);
      } catch (err) {
        console.error('Error fetching route:', err);
        setRouteCoords([]);
        setRouteModes([]);
      }
    },
    [snappedStart, snappedEnd, appliedMask]
  );

  // Re-fetch when endpoints change
  useEffect(() => { fetchRoute(); }, [snappedStart, snappedEnd, fetchRoute]);

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
      }
    } catch (err) {
      console.error('Snap error:', err);
    }
  };

  // ---- Panel + mask flow ----
  const openPanel  = () => { setDraftMask(appliedMask); setPanelOpen(true); };
  const closePanel = () => setPanelOpen(false);

  const toggleDraftBit = (bit) => {
    setDraftMask(prev => (prev & bit) ? (prev & ~bit) : (prev | bit));
  };

  const applyMask = async (newMask) => {
    setPanelOpen(false);
    if (newMask === appliedMask) return;
    setAppliedMask(newMask);
    // fetch immediately with the chosen mask (don’t rely on state timing)
    await fetchRoute(newMask);
    console.log('✔ Applied new surface mask', newMask);
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
        onSetSurfaceMask={setDraftMask}   // bulk setter (whole mask)

        onApply={applyMask}
      />
    </>
  );
};

export default App;
