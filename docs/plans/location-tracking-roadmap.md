# Navigation Feature Roadmap

## Context

The app has two fundamental modes: planning a route (selecting endpoints, choosing surfaces, viewing stats) and navigating the route (GPS following, camera tracking, real-time bearing). Today these are interleaved across features — trip camera logic lived in `geolocation/`, fit-bounds awareness of trip state lives in `map/`, and trip controls live in `routeSettings/`. Phase 1 (pin locking, GPS state gating, trip-aware fit-to-bounds) is complete. Phase 2a (extracting `features/navigation/`) is complete. This roadmap introduces navigation as a distinct feature and builds toward a full route-following experience.

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

**Status:** Complete (commit `1ec88f7`).

`TripController` and `LocationMarker` were moved from `features/geolocation/components/` to `features/navigation/components/`. `GeolocationContext` (and trip state) stayed in `geolocation/` because it is a pure GPS data provider consumed by both planning (`AddressSearch` GPS-to-start) and navigation (`TripController` camera). The trip start/stop button stays in `PanelToolbar` — it is a trigger within the planner UI, not a navigation component.

---

## Phase 2b — Preview Trip (Dev Tool)

**Problem:** Route-oriented navigation (Phase 3) and out-of-bounds guardrails (Phase 4) are nearly impossible to validate from a desk without a way to drive a fake GPS position along a planned route. We also want a tool that other future map features can lean on for design and debugging.

**Goal:** A dev-only "Preview Trip" mode that mirrors the production trip flow as closely as possible, drives a fake GPS dot along the computed route, and exposes a scrub slider so the developer can move the dot anywhere along the route at any time.

### Behavioral requirements

- Mirrors the production start flow: button enabled only when a route is computed (`snappedStart && snappedEnd && routeCoords.length >= 2`).
- Once started, the preview trip behaves like a production trip:
  - Closing the control panel does **not** stop it — only pressing "Stop Trip" does.
  - Opening the control panel pauses camera following (existing behavior) and pauses slider auto-advance.
  - On reaching the end pin (T), auto-advance halts but the trip remains active until "Stop Trip" is pressed.
- A slider appears at the bottom of the viewport whenever the trip is active and the panel is closed:
  - Range = `[0, totalDistanceM]`.
  - Auto-advances left → right at a constant configurable speed (default `PREVIEW_TRIP_SPEED_KMH = 20`).
  - User can drag the slider thumb to scrub the dot to any point on the route. Releasing the thumb resumes auto-advance unless the dot is already at the end.

### Deployment / sharing strategy

**Chosen approach (for now):** **local-only**. Gate everything on `import.meta.env.DEV`. Vite statically replaces this with `false` in production builds, so Rollup tree-shakes the entire `features/devTools/` subtree out of `dist/`. Zero production footprint, no extra deploy infrastructure required. To use Preview Trip on any branch: check it out, `npm run dev`, done.

Gate constant `frontend/src/features/devTools/enabled.js`:
```js
export const DEV_TOOLS_ENABLED = import.meta.env.DEV;
```

**Future-work options to revisit:**
1. **Render preview service + build flag.** Extend the gate to also honor an env var (`import.meta.env.VITE_ENABLE_DEV_TOOLS === "true"`). Add a third static-site service in `render.yaml` (`bikeHelsinki-preview`) that builds a chosen branch with the flag set, giving a stable shareable URL for stakeholders without polluting the production bundle.
2. **Promote to a real production feature.** Preview Trip is genuinely useful for end users — letting someone "fly through" a planned route before riding it could be a cool UX. Would mean renaming the directory out of `devTools/`, dropping the gate, polishing the slider styling, and surfacing the button alongside "Start Trip" in the regular planner UI.

### Architecture

```
features/devTools/
├── enabled.js                           # DEV_TOOLS_ENABLED constant
├── context/
│   └── PreviewTripContext.jsx           # isPreviewActive, progressM, totalM, autoAdvance, actions
├── hooks/
│   └── usePreviewTripEngine.js          # rAF loop: advances progressM, interpolates position, writes override
├── components/
│   ├── PreviewTripButton.jsx            # Renders inside PanelToolbar (gated)
│   └── PreviewTripSlider.jsx            # Bottom-of-screen scrub slider (gated)
├── utils/
│   └── routeInterpolation.js            # cumulative-distance table + positionAt(progressM) → {lat, lon, heading}
└── index.js
```

**GeolocationContext extension** (`frontend/src/features/geolocation/context/GeolocationContext.jsx`): add an optional position-override mechanism. When `setPositionOverride(pos)` is called, the context emits the override as `position` and skips `watchPosition`. This keeps `TripController`, `LocationMarker`, and `AddressSearch` 100% unchanged — they consume `position` and don't care where it came from.

**Engine** (`usePreviewTripEngine`): builds a cumulative-distance table from `routeCoords` on start, runs a `requestAnimationFrame` loop, advances `progressM` when `autoAdvance && !panelOpen`, computes `{lat, lon, heading}` at the current progress via `positionAt()`, and writes the result to `geolocation.setPositionOverride()`. Auto-advance halts at `totalM`; the trip stays active.

**Start flow** (`PreviewTripButton`, gated, lives next to "Start Trip" in `PanelToolbar`):
1. `geolocation.setPositionOverride({ lat: routeCoords[0][0], lon: routeCoords[0][1], accuracy: 10, heading: null, speed: 0 })`
2. `geolocation.startLocating()` (no-op effect, just flips `isLocating`)
3. `previewTrip.startPreview()`
4. `geolocation.startTrip()`
5. Existing `onAfterTripStart` runs (closes panel — same as production)

**Stop flow:** the existing "Stop Trip" button in `PanelToolbar` is the only way to end preview mode. On stop it also calls `previewTrip.stopPreview()` and `geolocation.setPositionOverride(null)`.

**Slider** (`PreviewTripSlider`): renders only when `DEV_TOOLS_ENABLED && isPreviewActive && !panelOpen && isTripActive`. Range input pinned to the bottom of the viewport above MapLibre controls. On `pointerdown` it calls `pauseAutoAdvance()`; on `pointerup` it calls `resumeAutoAdvance()` unless the dot is at the end. Label on the right shows `formatKm(progressM) / formatKm(totalM)`.

### New files

- `frontend/src/features/devTools/enabled.js`
- `frontend/src/features/devTools/context/PreviewTripContext.jsx`
- `frontend/src/features/devTools/hooks/usePreviewTripEngine.js`
- `frontend/src/features/devTools/components/PreviewTripButton.jsx`
- `frontend/src/features/devTools/components/PreviewTripSlider.jsx`
- `frontend/src/features/devTools/utils/routeInterpolation.js`
- `frontend/src/features/devTools/index.js`

### Files to modify

- `frontend/src/features/geolocation/context/GeolocationContext.jsx` — add `positionOverride`
- `frontend/src/features/routeSettings/components/PanelToolbar.jsx` — gated `PreviewTripButton`; wire `stopPreview` into the stop flow
- `frontend/src/App.jsx` — gated `PreviewTripProvider` + render gated `PreviewTripSlider`
- `frontend/src/shared/constants/config.js` — add `PREVIEW_TRIP_SPEED_KMH = 20`
- `frontend/CLAUDE.md` — brief section on the `devTools` feature + the gate constant

### Limitations to be aware of (feed into Phase 3a)

Preview Trip places the simulated dot **exactly** on the route. This means it cannot exercise the point-to-segment projection that Phase 3a's `useRouteProgress` will introduce. Two follow-up enhancements (not blocking; record for later):
- Add a "drift" slider that perpendicular-offsets the simulated position from the route by N meters (simulates GPS noise).
- Add a "jitter" knob that adds Gaussian noise to lat/lon each frame.

Until those exist, validate Phase 3a with a real-device walk test in addition to desk testing.

### Verification

- `npm run dev` → "Preview Trip" button appears next to "Start Trip" once a route is computed. Clicking it starts a trip, closes the panel, and shows a scrub slider at the bottom of the viewport. Blue dot auto-advances along the route at 20 km/h.
- Drag the slider → dot jumps to that point; release → auto-advance resumes.
- Let it run to T → auto-advance halts at 100%, dot sits on T pin, trip remains active.
- Open the control panel mid-trip → slider hides, fit-bounds shows the whole route, dot freezes, trip still active.
- Close the panel → slider reappears, camera resumes following the dot, auto-advance resumes from where it left off.
- Press "Stop Trip" → everything resets cleanly (override cleared, slider unmounts, camera returns to normal).
- `npm run build` → production bundle does not contain any `devTools` source. Verify with `grep -r PreviewTrip frontend/dist/` (expect no matches).

---

## Phase 3 — Route-Oriented Navigation View

**Problem:** Current trip mode uses raw compass heading (noisy), centers the blue dot on screen (hides road ahead), and has no awareness of the route geometry.

**Goal:** Full navigation experience when "Start Trip" is pressed.

The three sub-tasks below are **independent** and can be tackled in any order. Recommended implementation order: **3b → 3c → 3a** (smallest/lowest-risk first; the projection math in 3a is the largest piece).

### 3a — Route-bearing computation

**What:** Instead of rotating the map to raw `position.heading`, compute bearing from the user's current GPS position toward the next route waypoint.

New hook: `features/navigation/hooks/useRouteProgress.js`
- Accepts `routeCoords` (polyline) and `position` (current GPS)
- Finds the nearest point on the route to the current position (point-to-segment projection)
- Tracks which segment the user is on (index advances as they move forward)
- Returns `{ bearing, nearestPoint, segmentIndex, distanceRemaining }`
- `bearing` is the forward azimuth from `nearestPoint` toward the next waypoint

`TripController` change: use `routeProgress.bearing` instead of `position.heading` for `rotateTo()`.

**Note:** Preview Trip cannot exercise the projection math (its dot sits exactly on the route). Validate this step with a real-device walk test, or extend Preview Trip with a drift knob first (see Phase 2b limitations).

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

### Verification (using Preview Trip)

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

- With Preview Trip, call `setPositionOverride` with a point outside the Helsinki bbox → "Start Trip" disabled, message shown. (Preview Trip's override hook makes this validatable entirely from a desk — no real GPS or VPN tricks required.)
- Override with a point inside the bbox → normal behavior.

---

## Dependency graph

```
Phase 2a (extract navigation/)  ← COMPLETE
    ↓
Phase 2b (Preview Trip dev tool)
    ↓
Phase 3 (parallel sub-tasks):
  ├── 3a route bearing
  ├── 3b camera padding
  └── 3c pan-away snap-back

Phase 4 (out-of-bounds) — independent, easier to test once Preview Trip exists
```

Phase 3 sub-steps are independent — no chain. Recommended sequencing across the whole roadmap: **2a → 2b → 4 → 3b → 3c → 3a**. Phase 4 is small, user-visible, and touches the same `GeolocationContext` that Phase 2b is editing, so doing it adjacent to 2b batches the churn in that file. Within Phase 3, do the smaller pieces first (padding, then snap-back) and save the projection math for last.
