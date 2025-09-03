import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
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

// Turn coords+modes into contiguous runs for a given mode bit
function splitRuns(coords, modes, modeBit) {
  const out = [];
  if (
    !coords ||
    coords.length < 2 ||
    !modes ||
    modes.length !== coords.length - 1
  ) {
    return out;
  }
  let run = [];
  for (let i = 0; i < modes.length; i++) {
    const belongs = (modes[i] & modeBit) !== 0;
    if (belongs) {
      if (run.length === 0) run.push(coords[i]); // start run at segment start
      run.push(coords[i + 1]); // extend to segment end
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

const ClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });
  return null;
};

export function MapView({
  onMapClick,
  snappedStart,
  snappedEnd,
  routeCoords,
  routeModes,
}) {
  const bikeRuns = splitRuns(routeCoords, routeModes, MODE_BIKE);
  const footRuns = splitRuns(routeCoords, routeModes, MODE_FOOT);

  const color = "#007AFF";

  return (
    <MapContainer
      center={[60.1699, 24.9384]}
      zoom={15}
      /* ensure container has height */
      style={{ height: "100vh", width: "100vw" }}
      zoomControl={false}
      maxBounds={[
        [59.0, 19.0],
        [62.5, 31.5],
      ]}
      // maxBounds={[
      //   [59.0, 19.0],
      //   [62.5, 31.5]
      // ]}
      maxBoundsViscosity={0.3}
      // minZoom={11}
      minZoom={11}
      maxZoom={18}
    >
      {/* <ZoomControl position="bottomright" /> */}
      <ZoomControl position="topleft" />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OSM contributors"
      />

      <ClickHandler onMapClick={onMapClick} />

      {snappedStart && (
        <Marker position={[snappedStart.lat, snappedStart.lon]} />
      )}
      {snappedEnd && <Marker position={[snappedEnd.lat, snappedEnd.lon]} />}

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
