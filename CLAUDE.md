# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Bike-Helsinki is a full-stack bike routing web app for Helsinki, combining a React/MapLibre frontend, a Node.js/Express backend, and C++ N-API addons for high-performance A* pathfinding on an OpenStreetMap-derived graph.

# do not add comments in the code, except when the code is quite complex

## Git commit style

See `docs/commitMessageStyle.md` for the full commit message format.
Always open the editor — never use `git commit -m`.
When implementing a plan: pause between steps, write a commit message, and wait for review before proceeding.
When the user asks for a commit message: write the message text only — do not run any git commands. The user will commit themselves.

## Commands

### Frontend (`frontend/`)
```bash
npm run dev       # Dev server on :5173
npm run build     # Production build to dist/
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (`backend/`)
```bash
npm install           # Install Node deps
npm run build:native  # Compile C++ addons via node-gyp
npm run dev           # Run with file watch
npm start             # Start server on :3000
npm run clean         # Clean build artifacts
```

The backend requires the native addons to be compiled before starting. Addons are built with `node-gyp` via `binding.gyp`.

### Data Ingestion (`ingest/`)
```bash
./all.sh                                      # Download Finland OSM, extract Helsinki, build graph
cmake -B build && cd build && make            # Manual CMake build
```

Produces `graph_nodes.bin` and `graph_edges.bin` in `backend/data/`, which the C++ addons mmap at startup.

## Architecture

### Data Flow

1. **`ingest/` (C++)** reads OSM PBF files, extracts bike/foot-compatible ways and node coordinates, builds a Compressed Sparse Row (CSR) adjacency graph, and serializes it to binary files.

2. **`backend/` (Node.js + C++ addons)** loads the binary graph via mmap and exposes an Express REST API:
   - `GET /snap?lat,lon` — snaps coordinates to nearest graph node (C++ KD-tree)
   - `POST /route` — computes A* path with bike/foot mode and surface preferences (C++ addon)
   - `GET /config/helsinki` — returns bbox/viewbox for the map

3. **`frontend/` (React + MapLibre)** renders an interactive map. User clicks trigger snap→route calls, and the resulting polyline segments are color-coded by mode (bike vs. foot).

### Key Frontend Files

- `src/api/http.js` — Axios client; uses `VITE_API_URL` env var in prod, `localhost:3000` in dev
- `src/api/backend.js` — typed wrappers for all backend endpoints
- `src/context/RouteContext.jsx` — central routing state (snapped endpoints, route coords, user settings); drives recalculation on setting changes
- `src/features/map/MapView.jsx` — MapLibre map (via react-map-gl); handles map clicks and renders route GeoJSON layers

### Key Backend Files

- `backend/bindings/kd_snap.cpp` — N-API addon: KD-tree nearest-neighbor snap
- `backend/bindings/route.cpp` + `aStar.cpp` — N-API addon: A* routing with mode/penalty config
- `backend/controllers/` — thin Express request handlers that delegate to the C++ addons
- `backend/data/` — binary graph files (`graph_nodes.bin`, `graph_edges.bin`)

### Frontend-Backend Communication

The frontend calls the backend via Axios. In development, set `VITE_API_URL` in `frontend/.env.local` (defaults to `http://localhost:3000`). In production (Render.com), `VITE_API_URL=https://bikehelsinki-api.onrender.com`.

### Deployment

`render.yaml` defines two services:
- `bikeHelsinki-api` — Node backend with native addon build step
- `bikeHelsinki` — static frontend hosted on Render CDN

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite 6, react-map-gl 8 (MapLibre), Axios |
| Backend | Node.js 20, Express 5, node-addon-api |
| Native addons | C++17, node-gyp |
| Data ingestion | C++17, CMake, libosmium |
| Map data | OpenStreetMap via Digitransit/Pelias (address search) |
