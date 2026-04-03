import React, { useMemo } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import { ROUTE_COLORS } from "@/shared/constants/colors";
import { MODE_BIKE_PREFERRED, MODE_BIKE_NON_PREFERRED, MODE_FOOT } from "@/features/routeSettings/constants/surfaceTypes";

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

function runsToGeoJSON(runs) {
  return {
    type: "FeatureCollection",
    features: runs.map((pts) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pts.map(([lat, lon]) => [lon, lat]),
      },
    })),
  };
}

export function RoutePolylines({ routeCoords, routeModes, dragging }) {
  const routeOpacity = dragging ? 0.35 : 0.95;

  const bikePrefRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_BIKE_PREFERRED),
    [routeCoords, routeModes]
  );
  const bikeNonPrefRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_BIKE_NON_PREFERRED),
    [routeCoords, routeModes]
  );
  const footRuns = useMemo(
    () => splitRuns(routeCoords, routeModes, MODE_FOOT),
    [routeCoords, routeModes]
  );

  const bikePrefGeoJSON = useMemo(() => runsToGeoJSON(bikePrefRuns), [bikePrefRuns]);
  const bikeNonPrefGeoJSON = useMemo(() => runsToGeoJSON(bikeNonPrefRuns), [bikeNonPrefRuns]);
  const footGeoJSON = useMemo(() => runsToGeoJSON(footRuns), [footRuns]);

  const fallbackGeoJSON = useMemo(() => {
    if (routeModes?.length > 0 || !routeCoords || routeCoords.length < 2) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: routeCoords.map(([lat, lon]) => [lon, lat]),
      },
    };
  }, [routeCoords, routeModes]);

  return (
    <>
      <Source id="route-bike-pref" type="geojson" data={bikePrefGeoJSON}>
        <Layer
          id="route-bike-pref-line"
          type="line"
          paint={{
            "line-color": ROUTE_COLORS.bikePreferred,
            "line-width": 4,
            "line-opacity": routeOpacity,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      <Source id="route-bike-nonpref" type="geojson" data={bikeNonPrefGeoJSON}>
        <Layer
          id="route-bike-nonpref-line"
          type="line"
          paint={{
            "line-color": ROUTE_COLORS.bikeNonPreferred,
            "line-width": 4,
            "line-opacity": routeOpacity,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      <Source id="route-foot" type="geojson" data={footGeoJSON}>
        <Layer
          id="route-foot-line"
          type="line"
          paint={{
            "line-color": ROUTE_COLORS.walk,
            "line-width": 4,
            "line-opacity": routeOpacity,
            "line-dasharray": [2, 2],
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      {fallbackGeoJSON && (
        <Source id="route-fallback" type="geojson" data={fallbackGeoJSON}>
          <Layer
            id="route-fallback-line"
            type="line"
            paint={{
              "line-color": ROUTE_COLORS.bikePreferred,
              "line-width": 4,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>
      )}
    </>
  );
}
