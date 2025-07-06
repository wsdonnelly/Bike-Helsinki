import React from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents
} from 'react-leaflet'
import L from 'leaflet'

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:   'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

// Simple polyline overlay
export const GraphOverlay = ({ segments }) => {
  console.log("segments in GraphOverlay (type)", typeof(segments))
  return(
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg}
          color="rgba(0,0,255,0.3)"
          weight={1}
        />
      ))}
    </>
  )
}

// Hook for map clicks
const ClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng)
      console.log('event.latlng in ClickHandler', event.latlng)
    }
  })
  return null
}

// Main map view – now renders children
export function MapView({
  onMapClick,
  snappedStart,
  snappedEnd,
  routeCoords,
  // children
}) {
  // console.log('MapView children:', children)
  return (
    <MapContainer
      center={[60.1699, 24.9384]}
      zoom={13}
      // zoom={7}
      style={{ height: '100%', width: '100%' }}
      // maxBounds={[
      //   [59.9, 24.5],
      //   [60.5, 25.5]
      // ]}
      maxBounds={[
        [59.0, 19.0],
        [62.5, 31.5]
      ]}
      // minZoom={12}
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

      {/* {children} */}
    </MapContainer>
  )
}
