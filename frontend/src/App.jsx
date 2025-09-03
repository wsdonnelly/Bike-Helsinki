import React, { useState, useEffect, useCallback } from 'react';
import { MapView } from './components/MapView';
import ControlPanel from './components/ControlPanel';
import { snapToGraph, getRoute, setBikeSurfaceMask } from './utils/api';

const App = () => {
  const [snappedStart, setSnappedStart] = useState(null); // { idx, lat, lon }
  const [snappedEnd,   setSnappedEnd]   = useState(null); // { idx, lat, lon }
  const [routeCoords,  setRouteCoords]  = useState([]);   // [[lat,lon], ...]
  const [routeModes,   setRouteModes]   = useState([]);   // [1|2 per segment]
  const [panelOpen,    setPanelOpen]    = useState(false);

  const [surfaceMask, setSurfaceMask] = useState(0xFFFF);
  const [lastSubmittedMask, setLastSubmittedMask] = useState(0xFFFF);

  const fetchRoute = useCallback(async () => {
    if (!snappedStart || !snappedEnd) return;
    try {
      const result = await getRoute({
        startIdx: snappedStart.idx,
        endIdx:   snappedEnd.idx,
        // options: { bikeSurfaceMask: surfaceMask }
      });
      console.log('ROUTE RESULT', result);
      console.log('ROUTE TIME', result.durationS / 60, 'mins')
      console.log('ROUTE LENGTH', result.distanceM / 1000, 'KM')
      console.log('ROUTE distanceBike', result.distanceBike / 1000, 'KM')
      console.log('ROUTE distanceWalk', result.distanceWalk / 1000, 'KM')
      setRouteCoords(result.coords ?? []);
      setRouteModes(result.modes  ?? []);
    } catch (err) {
      console.error('Error fetching route:', err);
      setRouteCoords([]);
      setRouteModes([]);
    }
  }, [snappedStart, snappedEnd /*, surfaceMask*/]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  const handleMapClick = async ({ lat, lng }) => {
    try {
      const snapped = await snapToGraph(lat, lng); // { idx, lat, lon }
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

  const handleSurfaceToggle = (bit) => {
    setSurfaceMask(prev => (prev & bit) ? (prev & ~bit) : (prev | bit));
  };

  const handlePanelToggle = async () => {
    const willClose = panelOpen;
    setPanelOpen(!panelOpen);
    if (willClose && surfaceMask !== lastSubmittedMask) {
      try {
        // await setSurfaceMaskBoth(surfaceMask);
        await setBikeSurfaceMask(surfaceMask);
        setLastSubmittedMask(surfaceMask);
        await fetchRoute();
        console.log('✔ Applied new surface mask', surfaceMask);
      } catch (err) {
        console.error('✖ Failed to apply surface mask:', err);
      }
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
      />
      <ControlPanel
        surfaceMask={surfaceMask}
        onToggleSurface={handleSurfaceToggle}
        panelOpen={panelOpen}
        onTogglePanel={handlePanelToggle}
      />
    </>
  );
};

export default App;
