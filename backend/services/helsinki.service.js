const fs = require("fs/promises");
const path = require("path");
const { computeBBox } = require("../lib/computeBBox");

const HELSINKI_GJ_PATH = path.resolve(
  __dirname,
  "../../injest/helsinki.geojson"
);

let cached = null;

async function loadHelsinkiConfig() {
  if (cached) return cached;

  const raw = await fs.readFile(HELSINKI_GJ_PATH, "utf8");
  const gj = JSON.parse(raw);

  const [minLon, minLat, maxLon, maxLat] = computeBBox(gj);

  // Nominatim viewbox order: left,top,right,bottom (lon/lat)
  const viewbox = [minLon, maxLat, maxLon, minLat];

  cached = {
    bbox: { minLon, minLat, maxLon, maxLat },
    viewbox, // [left, top, right, bottom]
    viewboxString: viewbox.join(","),
    // If you want to expose polygon later, uncomment:
    // polygon: gj
  };
  return cached;
}

// Optional helper to reset cache if file changes (not used yet)
function invalidateHelsinkiCache() {
  cached = null;
}

module.exports = { loadHelsinkiConfig, invalidateHelsinkiCache };
