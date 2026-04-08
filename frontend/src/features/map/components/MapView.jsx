import React, { useMemo, useState, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Map, Marker } from "react-map-gl/maplibre";
import { UI_COLORS } from "@/shared/constants/colors";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useRouteSettingsContext } from "@/features/routeSettings/context/RouteSettingsContext";
import { useGeolocation } from "@/features/geolocation/context/GeolocationContext";
import { useRoute } from "@/context/RouteContext";
import { LocationMarker, TripController } from "@/features/navigation";
import { useFitBounds } from "@/features/map/hooks/useFitBounds";
import { RoutePolylines } from "./RoutePolylines";

const STREET_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const SAT_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    },
  },
  layers: [{ id: "esri-sat", type: "raster", source: "esri" }],
};

const FINLAND_BOUNDS = [
  [19.0, 59.0],
  [31.5, 62.5],
];

const fromLngLat = ({ lat, lng }) => ({ lat, lon: lng });

function makePinSvg({ color = "#2ecc71", label = "S" }) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="37" viewBox="0 0 32 37">
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
}

export function MapView({
  onMapClick,
  snappedStart,
  snappedEnd,
  routeCoords,
  routeModes,
  onMarkerDragEnd,
}) {
  const { isSatView, panelOpen, routeFitTick, getSheetVisibleHeight } = useRouteSettingsContext();
  const { position, isTripActive, isLocating } = useGeolocation();
  const { snappedStartSource } = useRoute();
  const gpsLockedStart = isLocating && snappedStartSource === "gps";
  const isMobile = useIsMobile();
  const mapRef = useRef(null);

  const startSvg = useMemo(() => makePinSvg({ color: UI_COLORS.startMarker, label: "S" }), []);
  const endSvg = useMemo(() => makePinSvg({ color: UI_COLORS.endMarker, label: "T" }), []);

  const [dragging, setDragging] = useState(null);

  const { fitBoundsOnDrag } = useFitBounds({
    mapRef, snappedStart, snappedEnd, isMobile, panelOpen, isTripActive, routeFitTick, getSheetVisibleHeight,
  });

  const bearing = isTripActive && position?.heading != null ? position.heading : 0;

  return (
    <Map
      ref={mapRef}
      mapLib={maplibregl}
      mapStyle={isSatView ? SAT_STYLE : STREET_STYLE_URL}
      initialViewState={{
        longitude: 24.9384,
        latitude: 60.1699,
        zoom: 15,
      }}
      bearing={bearing}
      style={{ height: "100dvh", width: "100vw" }}
      minZoom={8}
      maxZoom={18}
      maxBounds={FINLAND_BOUNDS}
      attributionControl={false}
      doubleClickZoom={false}
      onClick={(e) => onMapClick && onMapClick(fromLngLat(e.lngLat))}
    >

      {snappedStart && (
        <Marker
          longitude={snappedStart.lon}
          latitude={snappedStart.lat}
          anchor="bottom"
          draggable={!gpsLockedStart}
          style={{ zIndex: 1000 }}
          onDragStart={() => setDragging("start")}
          onDragEnd={(e) => {
            setDragging(null);
            const newPos = { lat: e.lngLat.lat, lon: e.lngLat.lng };
            onMarkerDragEnd && onMarkerDragEnd("start", newPos);
            if (snappedEnd) fitBoundsOnDrag(newPos, snappedEnd);
          }}
        >
          <img
            src={"data:image/svg+xml;charset=UTF-8," + encodeURIComponent(startSvg)}
            width={32}
            height={37}
            style={{ display: "block", cursor: gpsLockedStart ? "default" : "grab" }}
            alt="Start"
          />
        </Marker>
      )}

      {snappedEnd && (
        <Marker
          longitude={snappedEnd.lon}
          latitude={snappedEnd.lat}
          anchor="bottom"
          draggable
          style={{ zIndex: 1000 }}
          onDragStart={() => setDragging("end")}
          onDragEnd={(e) => {
            setDragging(null);
            const newPos = { lat: e.lngLat.lat, lon: e.lngLat.lng };
            onMarkerDragEnd && onMarkerDragEnd("end", newPos);
            if (snappedStart) fitBoundsOnDrag(newPos, snappedStart);
          }}
        >
          <img
            src={"data:image/svg+xml;charset=UTF-8," + encodeURIComponent(endSvg)}
            width={32}
            height={37}
            style={{ display: "block", cursor: "grab" }}
            alt="End"
          />
        </Marker>
      )}

      <RoutePolylines routeCoords={routeCoords} routeModes={routeModes} dragging={dragging} />

      <LocationMarker />
      <TripController mapRef={mapRef} />
    </Map>
  );
}
