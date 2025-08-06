import React, { useState, useEffect } from 'react'
import { MapView } from './components/MapView'
import ControlPanel from './components/ControlPanel'
import { snapToGraph, getRoute, setSurfaceFilter, fetchFullGraphLines } from './utils/api'

const App = () => {
  const [snappedStart, setSnappedStart] = useState(null)
  const [snappedEnd, setSnappedEnd] = useState(null)
  const [routeCoords, setRouteCoords] = useState([])

  const [surfaceMask, setSurfaceMask] = useState(0xFFFF)
  const [lastSubmittedMask, setLastSubmittedMask] = useState(0xFFFF)
  const [panelOpen, setPanelOpen] = useState(false)

  const [graphLines, setGraphLines] = useState([])

  // Function to load filtered graph
  const loadGraph = async (mask = surfaceMask) => {
    try {
      const lines = await fetchFullGraphLines()
      if (Array.isArray(lines)) {
        setGraphLines(lines)
        console.log(`✔ Loaded ${lines.length} graph segments`)
      }
    } catch (err) {
      console.error('✖ Failed to load full graph:', err)
    }
  }

  useEffect(() => {
    loadGraph()
  }, [])

  useEffect(() => {
    if (snappedStart && snappedEnd) {
      getRoute(snappedStart.nodeIdx, snappedEnd.nodeIdx)
        .then(path => {
          const coords = path.map(p => [p.lat, p.lon])
          setRouteCoords(coords)
        })
        .catch(err => {
          console.error('Error fetching route:', err)
          alert('Failed to load route')
        })
    }
  }, [snappedStart, snappedEnd])

  const handleMapClick = async ({ lat, lng }) => {
    try {
      const snapped = await snapToGraph(lat, lng)
      if (!snappedStart)
        setSnappedStart(snapped)
      else if (!snappedEnd)
        setSnappedEnd(snapped)
      else {
        setSnappedStart(snapped)
        setSnappedEnd(null)
        setRouteCoords([])
      }
    } catch (err) {
      console.error('Snap error:', err)
      alert('Failed to snap to graph')
    }
  }

  const handleSurfaceToggle = (bit) => {
    setSurfaceMask(prev => (prev & bit) ? (prev & ~bit) : (prev | bit))
  }

  // Called when user closes the control panel via ☰ button
  const handlePanelToggle = async () => {
    const willClose = panelOpen
    setPanelOpen(!panelOpen)

    if (willClose && surfaceMask !== lastSubmittedMask) {
      try {
        await setSurfaceFilter(surfaceMask)
        setLastSubmittedMask(surfaceMask)
        await loadGraph()
        console.log('✔ Applied new surface mask and reloaded graph')
      } catch (err) {
        console.error('✖ Failed to apply filter or reload graph:', err)
      }
    }
  }

  return (
    <>
      <MapView
        snappedStart={snappedStart}
        snappedEnd={snappedEnd}
        routeCoords={routeCoords}
        onMapClick={handleMapClick}
        graphLines={graphLines}
      />
      <ControlPanel
        surfaceMask={surfaceMask}
        onToggleSurface={handleSurfaceToggle}
        panelOpen={panelOpen}
        onTogglePanel={handlePanelToggle}
      />
    </>
  )
}

export default App
