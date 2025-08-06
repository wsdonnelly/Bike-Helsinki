import React, { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents
} from 'react-leaflet'
import L from 'leaflet'

// Fix default Leaflet marker icons (required when not using Webpack config for Leaflet)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

// Component to handle map clicks
const ClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng)
      console.log('Map clicked at:', event.latlng)
    }
  })
  return null
}

// ✅ Render graph segments within current map bounds
const VisibleGraphLines = ({ graphLines }) => {
  const map = useMap()
  const [visibleSegments, setVisibleSegments] = useState([])

  useEffect(() => {
    if (!map || !graphLines?.length) return

    const updateVisibleSegments = () => {
      const bounds = map.getBounds()

      const isInBounds = ([lat, lon]) => bounds.contains(L.latLng(lat, lon))

      const filtered = graphLines.filter(segment => {
        let p1, p2

        if (Array.isArray(segment[0])) {
          // Already nested: [[lat1, lon1], [lat2, lon2]]
          [p1, p2] = segment
        } else if (segment.length === 4) {
          // Flat: [lat1, lon1, lat2, lon2]
          p1 = [segment[0], segment[1]]
          p2 = [segment[2], segment[3]]
        } else {
          return false
        }

        return isInBounds(p1) || isInBounds(p2)
      })

      console.log(`Rendering ${filtered.length} visible segments`)
      setVisibleSegments(filtered)
    }

    // Initial check
    updateVisibleSegments()

    // Re-run on zoom or pan
    map.on('moveend zoomend', updateVisibleSegments)

    return () => {
      map.off('moveend zoomend', updateVisibleSegments)
    }
  }, [map, graphLines])

  return (
    <>
      {visibleSegments.map((segment, idx) => {
        const coords = Array.isArray(segment[0])
          ? segment
          : [[segment[0], segment[1]], [segment[2], segment[3]]]

        return (
          <Polyline
            key={`graph-segment-${idx}`}
            positions={coords}
            color="orange"
            weight={4}
            opacity={0.5}
          />
        )
      })}
    </>
  )
}

// 🔷 Main exported MapView component
export function MapView({
  onMapClick,
  snappedStart,
  snappedEnd,
  routeCoords,
  graphLines
}) {
  return (
    <MapContainer
      center={[60.1699, 24.9384]}
      // zoom={13}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      maxBounds={[
        [59.0, 19.0],
        [62.5, 31.5]
      ]}
      minZoom={11}
      maxZoom={18}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OSM contributors"
      />

      <ClickHandler onMapClick={onMapClick} />

      {snappedStart && (
        <Marker position={[snappedStart.lat, snappedStart.lon]} />
      )}
      {snappedEnd && (
        <Marker position={[snappedEnd.lat, snappedEnd.lon]} />
      )}

      {routeCoords.length > 0 && (
        <Polyline positions={routeCoords} color="#007AFF" weight={4} />
      )}

      {graphLines?.length > 0 && (
        <VisibleGraphLines graphLines={graphLines} />
      )}
    </MapContainer>
  )
}
