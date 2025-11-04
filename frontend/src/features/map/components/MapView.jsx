import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  ZoomControl,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { ROUTE_COLORS } from "@/shared/constants/colors";

// Fix Leaflet default marker icons (CDN assets)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// NOTE: keep names as you wrote, but make them real bit flags
const MODE_BIKE_PREFFERED = 0x1; // 0001
const MODE_BIKE_NON_PREFFERED = 0x2; // 0010
const MODE_FOOT = 0x4; // 0100  (not 0x3!)

// Leaflet → app ({lat, lng} → {lat, lon})
const lngToLon = ({ lat, lng }) => ({ lat, lon: lng });

// app → Leaflet ({lat, lon} → [lat, lng])
const lonToLeafletTuple = ({ lat, lon }) => ({ lat, lng: lon });

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
    click: (e) => onMapClick && onMapClick(lngToLon(e.latlng)),
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
    <path d="M16 1c-7.18 0-13 5.82-13 13 0 9.7 13 23 13 23s13-13.3 13-23C29 6.82 23.18 1 16 1z"
          fill="${color}" stroke="white" stroke-width="2" filter="url(#shadow)"/>
    <text x="16" y="14" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          font-weight="700" font-size="11" fill="#fff">${label}</text>
  </svg>`.trim();

  return L.icon({
    iconUrl: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize: [32, 48],
    iconAnchor: [16, anchorY],
    popupAnchor: [0, -40],
    className: "leaflet-marker-icon",
  });
}

function ToggleButton({ onToggle }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);

  return (
    <div
      ref={ref}
      style={{ position: "absolute", top: 35, right: 10, zIndex: 1003 }}
    >
      <button
        type="button"
        onClick={onToggle}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: "white",
          // width: 36,
          // height: 36,
          borderRadius: 10,
          border: "1px solid #e5e5e5",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
        aria-label="Toggle satellite view"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20z" />
        </svg>
      </button>
    </div>
  );
}

export function MapView({
  onMapClick,
  snappedStart,
  snappedEnd,
  routeCoords,
  routeModes,
  onMarkerDragEnd,
}) {
  const startIcon = useMemo(
    () => makePinIcon({ color: "#2ecc71", label: "S", anchorY: 42 }),
    []
  );
  const endIcon = useMemo(
    () => makePinIcon({ color: "#e74c3c", label: "T", anchorY: 42 }),
    []
  );

  // Build runs per mode
  const bikePrefRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_BIKE_PREFFERED),
    [routeCoords, routeModes]
  );
  const bikeNonPrefRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_BIKE_NON_PREFFERED),
    [routeCoords, routeModes]
  );
  const footRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_FOOT),
    [routeCoords, routeModes]
  );

  const [isSatView, setIsSatView] = useState(false);
  const [dragging, setDragging] = useState(null);
  const routeOpacity = dragging ? 0.35 : 0.95;

  return (
    <MapContainer
      center={[60.1699, 24.9384]}
      zoom={15}
      style={{ height: "100dvh", width: "100vw" }}
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
      <ToggleButton onToggle={() => setIsSatView((v) => !v)} />

      {isSatView ? (
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        />
      ) : (
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OSM contributors"
        />
      )}

      <MapClick onMapClick={onMapClick} />

      {snappedStart && (
        <Marker
          position={lonToLeafletTuple(snappedStart)} // [lat, lng]
          icon={startIcon}
          title="Start"
          zIndexOffset={1000}
          draggable
          eventHandlers={{
            dragstart: () => setDragging("start"),
            dragend: (e) => {
              setDragging(null);
              const { lat, lng } = e.target.getLatLng();
              onMarkerDragEnd && onMarkerDragEnd("start", { lat, lon: lng });
            },
          }}
        />
      )}

      {snappedEnd && (
        <Marker
          position={lonToLeafletTuple(snappedEnd)}
          icon={endIcon}
          title="End"
          zIndexOffset={1000}
          draggable
          eventHandlers={{
            dragstart: () => setDragging("end"),
            dragend: (e) => {
              setDragging(null);
              const { lat, lng } = e.target.getLatLng();
              onMarkerDragEnd && onMarkerDragEnd("end", { lat, lon: lng });
            },
          }}
        />
      )}

      {/* Bike preferred — solid blue */}
      {bikePrefRuns.map((pts, i) => (
        <Polyline
          key={`bp${i}`}
          positions={pts}
          pathOptions={{
            color: ROUTE_COLORS.bikePreferred,
            weight: 4,
            opacity: routeOpacity,
          }}
        />
      ))}

      {/* Bike non-preferred — solid orange */}
      {bikeNonPrefRuns.map((pts, i) => (
        <Polyline
          key={`bn${i}`}
          positions={pts}
          pathOptions={{
            color: ROUTE_COLORS.bikeNonPreferred,
            weight: 4,
            opacity: routeOpacity,
          }}
        />
      ))}

      {/* Walk — dotted purple */}
      {footRuns.map((pts, i) => (
        <Polyline
          key={`fw${i}`}
          positions={pts}
          pathOptions={{
            color: ROUTE_COLORS.walk,
            weight: 4,
            dashArray: "6 6",
            lineCap: "round",
            opacity: routeOpacity,
          }}
        />
      ))}

      {/* Fallback: if no modes provided, draw a single solid preferred line */}
      {(!routeModes || routeModes.length === 0) && routeCoords?.length > 1 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{ color: ROUTE_COLORS.bikePreferred, weight: 4 }}
        />
      )}
    </MapContainer>
  );
}
