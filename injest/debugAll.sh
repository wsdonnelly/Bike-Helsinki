#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────── Config ──────────────────────────────
# Resolve paths relative to this script (assumes script lives in ingest/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INGEST_DIR="${SCRIPT_DIR}"
ROOT_DIR="$(cd "${INGEST_DIR}/.." && pwd)"
BUILD_DIR="${INGEST_DIR}/build"
RAW_DIR="${ROOT_DIR}/raw_data"
DATA_DIR="${ROOT_DIR}/data"
BINDINGS_DIR="$ROOT_DIR/backend/bindings"
BACKEND_DIR="$ROOT_DIR/backend/"
FRONTEND_DIR="$ROOT_DIR/frontend"

# AOI polygon/geojson (default expects a helsinki.geojson next to this script)
AOI_POLY="${AOI_POLY:-${INGEST_DIR}/helsinki.geojson}"



CLIP_PBF="${RAW_DIR}/helsinki_region.osm.pbf"

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

# ─────────────────────────── BUILD BINDINGS ─────────────────────────
echo "==> Rebuilding native bindings (Release) via node-gyp"
pushd "$BINDINGS_DIR" >/dev/null
npx node-gyp rebuild --release
popd >/dev/null

echo "✅ Done."
