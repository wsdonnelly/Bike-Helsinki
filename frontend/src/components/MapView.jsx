import React, { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  ZoomControl,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default marker icons (CDN assets)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MODE_BIKE = 0x1;
const MODE_FOOT = 0x2;

function splitRuns(coords, modes, modeBit) {
  const out = [];
  if (
    !coords ||
    coords.length < 2 ||
    !modes ||
    modes.length !== coords.length - 1
  )
    return out;
  let run = [];
  for (let i = 0; i < modes.length; i++) {
    const belongs = (modes[i] & modeBit) !== 0;
    if (belongs) {
      if (run.length === 0) run.push(coords[i]);
      run.push(coords[i + 1]);
    } else if (run.length > 1) {
      out.push(run);
      run = [];
    } else {
      run = [];
    }
  }
  if (run.length > 1) out.push(run);
  return out;
}

// Keeps click handler in sync with the latest prop, and auto-cleans
function MapClick({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick?.(e.latlng),
  });
  return null;
}

function makePinIcon({ color = "#2ecc71", label = "S", anchorY = 42 }) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".35"/>
      </filter>
    </defs>
    <!-- Teardrop pin -->
    <path d="M16 1c-7.18 0-13 5.82-13 13 0 9.7 13 23 13 23s13-13.3 13-23C29 6.82 23.18 1 16 1z"
          fill="${color}" stroke="white" stroke-width="2" filter="url(#shadow)"/>
    <!-- Label -->
    <text x="16" y="14" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-weight="700" font-size="11" fill="#fff">${label}</text>
  </svg>`.trim();

  return L.icon({
    iconUrl: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize: [32, 48], // visual size
    iconAnchor: [16, anchorY], // <-- tip of the pin (bottom center)
    popupAnchor: [0, -40],
    className: "leaflet-marker-icon",
  });
}

export function MapView({
  onMapClick,
  snappedStart,
  snappedEnd,
  routeCoords,
  routeModes,
}) {
  const startIcon = useMemo(
    () => makePinIcon({ color: "#2ecc71", label: "S", anchorY: 42 }),
    []
  );
  const endIcon = useMemo(
    () => makePinIcon({ color: "#e74c3c", label: "T", anchorY: 42 }),
    []
  );

  const bikeRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_BIKE),
    [routeCoords, routeModes]
  );
  const footRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_FOOT),
    [routeCoords, routeModes]
  );

  const color = "#007AFF";

  return (
    <MapContainer
      center={[60.1699, 24.9384]}
      zoom={15}
      style={{ height: "100vh", width: "100vw" }}
      zoomControl={false}
      preferCanvas
      maxBounds={[
        [59.0, 19.0],
        [62.5, 31.5],
      ]}
      maxBoundsViscosity={0.3}
      minZoom={11}
      maxZoom={18}
      doubleClickZoom={false}
      wheelPxPerZoomLevel={120}
    >
      <ZoomControl position="topleft" />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OSM contributors"
      />

      {/* click handling that stays fresh */}
      <MapClick onMapClick={onMapClick} />

      {snappedStart && (
        <Marker
          position={[snappedStart.lat, snappedStart.lon]}
          icon={startIcon}
          title="Start"
          zIndexOffset={1000}
        />
      )}
      {snappedEnd && (
        <Marker
          position={[snappedEnd.lat, snappedEnd.lon]}
          icon={endIcon}
          title="End"
          zIndexOffset={1000}
        />
      )}

      {/* Solid bike runs */}
      {bikeRuns.map((pts, i) => (
        <Polyline
          key={`b${i}`}
          positions={pts}
          pathOptions={{ color, weight: 4 }}
        />
      ))}

      {/* Dotted foot runs */}
      {footRuns.map((pts, i) => (
        <Polyline
          key={`f${i}`}
          positions={pts}
          pathOptions={{ color, weight: 4, dashArray: "6 6" }}
        />
      ))}

      {/* Fallback: if no modes provided, draw a single solid line */}
      {(!routeModes || routeModes.length === 0) && routeCoords?.length > 1 && (
        <Polyline positions={routeCoords} pathOptions={{ color, weight: 4 }} />
      )}
    </MapContainer>
  );
}
