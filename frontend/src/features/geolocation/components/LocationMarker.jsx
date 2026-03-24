import React, { useMemo } from "react";
import { Circle, Marker } from "react-leaflet";
import L from "leaflet";
import { useGeolocation } from "../context/GeolocationContext";

const DOT_HTML = `<div style="
  width:16px;height:16px;
  background:#2196f3;
  border:2px solid #fff;
  border-radius:50%;
  box-shadow:0 0 4px rgba(0,0,0,0.4);
"></div>`;

export function LocationMarker() {
  const { isLocating, position } = useGeolocation();

  const dotIcon = useMemo(
    () =>
      L.divIcon({
        html: DOT_HTML,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    []
  );

  if (!isLocating || !position) return null;

  const center = [position.lat, position.lon];

  return (
    <>
      <Circle
        center={center}
        radius={position.accuracy}
        pathOptions={{ color: "#2196f3", fillColor: "#2196f3", fillOpacity: 0.15, weight: 1 }}
      />
      <Marker position={center} icon={dotIcon} interactive={false} />
    </>
  );
}
