import React, { useMemo } from "react";
import { Source, Layer, Marker } from "react-map-gl/maplibre";
import { useGeolocation } from "@/features/geolocation/context/GeolocationContext";

function makeCirclePolygon(lat, lon, radiusMeters, steps = 64) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusMeters / 111320) * Math.cos(angle);
    const dLon =
      (radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))) *
      Math.sin(angle);
    coords.push([lon + dLon, lat + dLat]);
  }
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

export function LocationMarker() {
  const { isLocating, position } = useGeolocation();

  const circleGeoJSON = useMemo(() => {
    if (!position) return null;
    return makeCirclePolygon(position.lat, position.lon, position.accuracy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lon, position?.accuracy]);

  if (!isLocating || !position) return null;

  return (
    <>
      <Source id="location-accuracy" type="geojson" data={circleGeoJSON}>
        <Layer
          id="location-accuracy-fill"
          type="fill"
          paint={{
            "fill-color": "#2196f3",
            "fill-opacity": 0.15,
          }}
        />
        <Layer
          id="location-accuracy-stroke"
          type="line"
          paint={{
            "line-color": "#2196f3",
            "line-width": 1,
            "line-opacity": 0.6,
          }}
        />
      </Source>

      <Marker longitude={position.lon} latitude={position.lat} anchor="center">
        <div
          style={{
            width: 16,
            height: 16,
            background: "#2196f3",
            border: "2px solid #fff",
            borderRadius: "50%",
            boxShadow: "0 0 4px rgba(0,0,0,0.4)",
          }}
        />
      </Marker>
    </>
  );
}
