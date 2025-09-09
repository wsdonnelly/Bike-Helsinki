#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────── Config ──────────────────────────────
# Resolve paths relative to this script (assumes script lives in ingest/)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
INGEST_DIR="${SCRIPT_DIR}"
ROOT_DIR="$(cd -- "${INGEST_DIR}/.." && pwd -P)"

BUILD_DIR="${INGEST_DIR}/build"
RAW_DIR="${ROOT_DIR}/raw_data"

# New layout: write outputs to backend/data
BACKEND_DIR="${ROOT_DIR}/backend"
DATA_DIR="${DATA_DIR_OVERRIDE:-${BACKEND_DIR}/data}"

# Ensure dirs exist
mkdir -p "${BUILD_DIR}" "${RAW_DIR}" "${DATA_DIR}"

# AOI polygon/geojson (default expects a helsinki.geojson next to this script)
AOI_POLY="${AOI_POLY:-${INGEST_DIR}/helsinki.geojson}"

# Source + outputs
OSM_URL="${OSM_URL:-https://download.geofabrik.de/europe/finland-latest.osm.pbf}"
OSM_PBF="${RAW_DIR}/finland-latest.osm.pbf"
CLIP_PBF="${RAW_DIR}/helsinki_region.osm.pbf"

# Optional: filtered walk/bike-only file (smaller, faster for your build step)
FILTER_PBF="${RAW_DIR}/helsinki-walkbike.osm.pbf"
USE_FILTER="${USE_FILTER:-1}"  # set to 0 to skip tag-filtering

# ────────────────────────────── Helpers ─────────────────────────────
need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing dependency: $1" >&2; exit 1; }; }

echo "▶ Checking dependencies..."
need curl
need cmake
need make
need osmium
echo "✔ deps ok"

mkdir -p "${RAW_DIR}" "${DATA_DIR}"

# ────────────────────────────── CLEAN ───────────────────────────────
echo "▶ Cleaning previous build and blobs..."
rm -rf "${BUILD_DIR}"
rm -f "${DATA_DIR}/graph_nodes.bin" "${DATA_DIR}/graph_edges.bin"
echo "✔ Clean complete."

# ────────────────────────────── BUILD ───────────────────────────────
echo "▶ Configuring CMake in ${BUILD_DIR}..."
mkdir -p "${BUILD_DIR}"
pushd "${BUILD_DIR}" >/dev/null
cmake ..
echo "▶ Building..."
# Parallel build (best effort across platforms)
JOBS="${JOBS:-$( (command -v sysctl >/dev/null && sysctl -n hw.ncpu) || (command -v getconf >/dev/null && getconf _NPROCESSORS_ONLN) || echo 4 )}"
make -j"${JOBS}"
popd >/dev/null
echo "✔ Build complete."

# ───────────────────── GET LATEST OSM DATA ──────────────────────────
echo "▶ Downloading PBF: ${OSM_URL}"
curl -fL --progress-bar -o "${OSM_PBF}" "${OSM_URL}"
echo "✔ Downloaded to ${OSM_PBF}"

# ────────────────────────── EXTRACT AOI ─────────────────────────────
if [[ -f "${AOI_POLY}" ]]; then
  echo "▶ Clipping with polygon: ${AOI_POLY}"
  osmium extract \
    -p "${AOI_POLY}" \
    "${OSM_PBF}" \
    -o "${CLIP_PBF}" --overwrite
else
  echo "⚠ AOI polygon not found at ${AOI_POLY}. Falling back to bbox."
  # Default bbox for central Helsinki (lon,lat,lon,lat) – override with BBOX="..."
  BBOX="${BBOX:-24.7,60.10,25.20,60.35}"
  echo "▶ Clipping with bbox: ${BBOX}"
  osmium extract \
    -b "${BBOX}" \
    "${OSM_PBF}" \
    -o "${CLIP_PBF}" --overwrite
fi
echo "✔ AOI extract at ${CLIP_PBF}"

echo "▶ Removing source PBF to save space"
rm -f "${OSM_PBF}"

# ─────────────────────── RUN buildGraph ─────────────────────────────
echo "▶ Running buildGraph on ${CLIP_PBF}"
pushd "${BUILD_DIR}" >/dev/null
./buildGraph "${CLIP_PBF}"
popd >/dev/null
echo "✔ Graph built to ${DATA_DIR}"

# ─────────────────────────── SUMMARY ────────────────────────────────
echo "▶ Output sizes:"
du -h "${DATA_DIR}/graph_"* | sort -h || true
echo "✅ All steps complete."
