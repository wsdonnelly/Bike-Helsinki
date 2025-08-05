import React, { useState, useEffect, useRef } from 'react'
import { MapView, GraphOverlay } from './components/MapView'
import ControlPanel from './components/ControlPanel'
import { snapToGraph, getRoute, setSurfaceFilter } from './utils/api'

const App = () => {
  // Holds the snapped start/end points { nodeIdx, lat, lon }
  const [snappedStart, setSnappedStart] = useState(null)
  const [snappedEnd,   setSnappedEnd]   = useState(null)

  // Holds the array of [lat, lon] for the route polyline
  const [routeCoords,  setRouteCoords]  = useState([])

  const [surfaceMask, setSurfaceMask] = useState(0xFFFF)
  const [lastSubmittedMask, setLastSubmittedMask] = useState(0xFFFF)
  const [panelOpen, setPanelOpen] = useState(false)

  // Whenever both endpoints are set, fetch the route
  useEffect(() => {
    if (snappedStart && snappedEnd) {
      getRoute(snappedStart.nodeIdx, snappedEnd.nodeIdx)
        .then(path => {
          // Convert to [lat, lon] pairs
          const coords = path.map(p => [p.lat, p.lon]);
          setRouteCoords(coords);
        })
        .catch(err => {
          console.error('Error fetching route:', err);
          alert('Failed to load route');
        });
    }
  }, [snappedStart, snappedEnd]);

  // Log whenever snappedStart changes
  useEffect(() => {
    console.log('snappedStart updated:', snappedStart);
  }, [snappedStart]);

  // Log whenever snappedEnd changes
  useEffect(() => {
    console.log('snappedEnd updated:', snappedEnd);
  }, [snappedEnd]);

  const handleMapClick = async ({ lat, lng }) => {
    try {
      const snapped = await snapToGraph(lat, lng)
      console.log('snapped:', snapped)
      if (!snappedStart)
        setSnappedStart(snapped)
      else if (!snappedEnd)
        setSnappedEnd(snapped)
      else {
        // Both already set: start a new route
        setSnappedStart(snapped)
        setSnappedEnd(null)
        setRouteCoords([])
      }
    } catch (err) {
      console.error('Snap error:', err)
      alert('Failed to snap to graph')
    }
  }

  // Clear everything
  const handleClear = () => {
    setSnappedStart(null);
    setSnappedEnd(null);
    setRouteCoords([]);
  }

  const handlePanelClose = () => {
    setPanelOpen(false)
    if (surfaceMask !== lastSubmittedMask) {
      setSurfaceFilter(surfaceMask)
      setLastSubmittedMask(surfaceMask)
    }
  }

  const handleSurfaceToggle = (bit) => {
    setSurfaceMask(prev => (prev & bit) ? (prev & ~bit) : (prev | bit))
  }

    return (
    <>
      <MapView
        snappedStart={snappedStart}
        snappedEnd={snappedEnd}
        routeCoords={routeCoords}
        onMapClick={handleMapClick}
      />
      <ControlPanel
        surfaceMask={surfaceMask}
        onToggleSurface={handleSurfaceToggle}
        onClear={handleClear}
        onClose={handlePanelClose}
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
      />
    </>
  )
}

export default App