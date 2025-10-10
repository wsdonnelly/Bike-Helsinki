// Returns [minLon, minLat, maxLon, maxLat] for any valid GeoJSON.

function computeBBox(geojson) {
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;

  function pushCoords(coords) {
    // coords may be nested arrays or a single [lon, lat]
    if (Array.isArray(coords[0])) {
      for (const c of coords) pushCoords(c);
    } else if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lon, lat] = coords;
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }

  function walk(g) {
    if (!g) return;
    switch (g.type) {
      case "FeatureCollection":
        g.features.forEach(walk);
        break;
      case "Feature":
        walk(g.geometry);
        break;
      case "GeometryCollection":
        g.geometries.forEach(walk);
        break;
      case "Point":
      case "MultiPoint":
      case "LineString":
      case "MultiLineString":
      case "Polygon":
      case "MultiPolygon":
        pushCoords(g.coordinates);
        break;
      default:
        throw new Error(`Unsupported GeoJSON type: ${g.type}`);
    }
  }

  walk(geojson);
  if (!isFinite(minLon)) throw new Error("No coordinates found in GeoJSON");
  return [minLon, minLat, maxLon, maxLat];
}

module.exports = { computeBBox };
