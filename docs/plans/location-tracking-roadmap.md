# Navigation Feature Roadmap

## Context

The app has two fundamental modes: planning a route (selecting endpoints, choosing surfaces, viewing stats) and navigating the route (GPS following, camera tracking, real-time bearing). Today these are interleaved across features — trip camera logic lives in `geolocation/`, fit-bounds awareness of trip state lives in `map/`, and trip controls live in `routeSettings/`. Phase 1 (pin locking, GPS state gating, trip-aware fit-to-bounds) is complete. This roadmap introduces navigation as a distinct feature and builds toward a full route-following experience.

## Two-mode mental model

| Mode | What the user does | What the app does |
|---|---|---|
| Planning | Click endpoints, search addresses, choose surfaces, view stats | Fit-to-bounds, show route polylines, allow pin dragging |
| Navigation | Press "Start Trip", follow the route, optionally pan away | Camera follows GPS, bearing derived from route, snap-back after pan |

The transition points:
- **Planning → Navigation:** "Start Trip" (requires GPS active)
- **Navigation → Planning (paused):** open control panel (camera reverts to fit-to-bounds, route is editable, start pin stays locked)
- **Navigation (paused) → Navigation:** close panel (camera resumes following GPS)
- **Navigation → Planning:** "Stop Trip" (full reset to planning mode)

---

## Phase 2a — Extract `features/navigation/`

**Goal:** Move navigation-related components out of `geolocation/` into their own feature, so the code structure matches the two-mode mental model. Pure refactoring — no behavior changes.

### What moves

| File | From | To |
|---|---|---|
| `TripController.jsx` | `geolocation/components/` | `navigation/components/` |
| `LocationMarker.jsx` | `geolocation/components/` | `navigation/components/` |

### What stays

- `GeolocationContext.jsx` stays in `geolocation/` — it is a pure GPS data provider (`position`, `isLocating`, `isTripActive`, `startLocating`, `stopLocating`, `startTrip`, `stopTrip`). Consumed by both planning (`AddressSearch` GPS-to-start) and navigation (`TripController` camera).
- Trip state (`isTripActive`, `startTrip`, `stopTrip`) stays in `GeolocationContext` — tightly coupled with GPS watch lifecycle.
- Trip start/stop button stays in `PanelToolbar` — it is a trigger within the planner UI, not a navigation component.

### New directory structure

```
features/navigation/
├── components/
│   ├── TripController.jsx      # Renderless; camera following during navigation
│   └── LocationMarker.jsx      # Blue dot + accuracy circle
└── index.js                    # exports: TripController, LocationMarker
```

### Import updates

- `MapView.jsx`: change import from `@/features/geolocation` to `@/features/navigation`
- `geolocation/index.js`: remove `TripController` and `LocationMarker` exports

### Files to modify

- `frontend/src/features/geolocation/index.js`
- `frontend/src/features/map/components/MapView.jsx`
- New: `frontend/src/features/navigation/index.js`
- Move: `frontend/src/features/navigation/components/TripController.jsx`
- Move: `frontend/src/features/navigation/components/LocationMarker.jsx`
- `docs/frontend/frontend-architecture.md` — update the geolocation feature boundaries section (remove `TripController` and `LocationMarker`), add a `navigation/` feature section, and update the camera logic distribution note with the new `TripController` path

### Verification

- `npm run lint` passes
- `npm run build` succeeds
- App loads, locate + trip start/stop works identically to before

---

## Phase 2b — GPS Simulator (Dev Tool)

**Problem:** Route-oriented navigation (Phase 3) is impossible to test without physical movement.

**Goal:** Dev-only tool that drives a fake GPS position along a computed route at configurable speed. Same data shape as real GPS (`{ lat, lon, accuracy, heading, speed }`), drop-in substitute for `watchPosition`.

### Design

The simulator lives in `geolocation/` because it replaces the browser's `watchPosition` — it produces GPS data, not navigation behavior. `GeolocationContext` conditionally uses it in dev mode.

### Approach

- New hook: `features/geolocation/hooks/useGpsSimulator.js`
  - Accepts `routeCoords` (the computed route polyline) and `speedKmh`
  - Interpolates position along the polyline at the given speed using `requestAnimationFrame` or `setInterval`
  - Computes heading from consecutive interpolated points
  - Returns `{ position, start, stop, isRunning }`
- `GeolocationContext.jsx`: when simulator is active, feed its position into state instead of `watchPosition`
- Dev UI: small floating panel (dev-only, `import.meta.env.DEV` guard) with start/stop and speed slider
- Constraint: zero production footprint — all simulator code behind `import.meta.env.DEV` checks or dynamic import

### New files

- `frontend/src/features/geolocation/hooks/useGpsSimulator.js`
- `frontend/src/features/geolocation/components/SimulatorPanel.jsx` (dev-only)

### Verification

- Start a trip with simulator → blue dot moves along route at configured speed
- `TripController` follows the simulated position identically to real GPS
- Production build excludes all simulator code

---

## Phase 3 — Route-Oriented Navigation View

**Problem:** Current trip mode uses raw compass heading (noisy), centers the blue dot on screen (hides road ahead), and has no awareness of the route geometry.

**Goal:** Full navigation experience when "Start Trip" is pressed.

### 3a — Route-bearing computation

**What:** Instead of rotating the map to raw `position.heading`, compute bearing from the user's current GPS position toward the next route waypoint.

New hook: `features/navigation/hooks/useRouteProgress.js`
- Accepts `routeCoords` (polyline) and `position` (current GPS)
- Finds the nearest point on the route to the current position (point-to-segment projection)
- Tracks which segment the user is on (index advances as they move forward)
- Returns `{ bearing, nearestPoint, segmentIndex, distanceRemaining }`
- `bearing` is the forward azimuth from `nearestPoint` toward the next waypoint

`TripController` change: use `routeProgress.bearing` instead of `position.heading` for `rotateTo()`.

### 3b — Camera padding (30% dot anchor)

**What:** Anchor the blue dot at ~30% from the bottom of the viewport so the road ahead is visible.

**Approach:** Use MapLibre's `padding` camera property. When trip starts, apply `{ bottom: viewportHeight * 0.4 }` (pushes the logical center 40% up from bottom → dot appears at ~30% from bottom). Clear padding on trip end.

`TripController` change: pass `padding` to all `flyTo()` calls during active navigation. Set once on trip start, clear on trip end.

### 3c — Pan-away + snap-back

**What:** User can pan the map manually during navigation. After ~3–5 seconds of no interaction, the camera snaps back to following mode.

New hook: `features/navigation/hooks/useFollowing.js`
- Listens for MapLibre `movestart` events with `originalEvent` (user-initiated pan)
- On user pan: set `isFollowing = false`, start 4-second timeout
- On timeout: set `isFollowing = true`, fly back to current GPS position with padding
- On new user pan while timer running: reset timer
- Returns `{ isFollowing, pauseFollowing, resumeFollowing }`

`TripController` change: skip `flyTo` calls when `!isFollowing`. On `resumeFollowing`, do an immediate fly-to-current-position.

### New files

- `frontend/src/features/navigation/hooks/useRouteProgress.js`
- `frontend/src/features/navigation/hooks/useFollowing.js`

### Files to modify

- `frontend/src/features/navigation/components/TripController.jsx`
- `frontend/src/features/map/components/MapView.jsx` (pass `routeCoords` to `TripController`; wire `movestart` listener for `useFollowing`)

### Verification (using GPS simulator)

- Start trip → map rotates to route bearing, not raw heading
- Blue dot sits at ~30% from bottom
- Pan the map → following pauses, dot drifts off center
- Wait 4 seconds → camera smoothly snaps back to following, dot re-anchors at 30%
- Open panel during trip → fit-to-bounds shows full route
- Close panel → navigation resumes with bearing + padding

---

## Phase 4 — Out-of-Bounds Guardrails

**Problem:** No feedback if GPS position is outside the service area (currently Helsinki bbox, expanding to all Finland).

**Goal:** When GPS position is outside the service boundary, show a clear error and prevent trip start.

### Implementation

- `GeolocationContext`: check position against service bbox on each update; set an `outOfBounds` flag
- `PanelToolbar`: disable "Start Trip" when `outOfBounds`; show explanatory message
- Service bbox comes from `backend.getHelsinkiConfig()` (already fetched in `RouteContext`)

### Files to modify

- `frontend/src/features/geolocation/context/GeolocationContext.jsx`
- `frontend/src/features/routeSettings/components/PanelToolbar.jsx`

### Verification

- Simulate GPS outside Helsinki bbox → "Start Trip" disabled, message shown
- Simulate GPS inside bbox → normal behavior

---

## Dependency graph

```
Phase 2a (extract navigation/)
    ↓
Phase 2b (GPS simulator)  ← needed to test Phase 3 at a desk
    ↓
Phase 3a (route bearing)
    ↓
Phase 3b (camera padding)
    ↓
Phase 3c (pan-away snap-back)
```

Phase 4 (out-of-bounds) — independent, can be done anytime after Phase 1.

Phases 2a and 2b are independent of each other but both should precede Phase 3. Phase 3 sub-steps are sequential (each builds on the previous). Phase 4 is independent.
