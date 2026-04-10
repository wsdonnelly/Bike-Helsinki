# Camera Behavior Contract

## Summary

This document defines the desired map camera behavior for the entire app.

The app has two camera mental models:

- `planning`: the camera frames the route inside the currently available map space
- `navigation`: the camera follows the current real or preview position at navigation zoom while the control panel is closed

The control panel is a camera-mode switch during navigation:

- open panel: suspend follow-camera and return to planning-style route framing
- close panel: resume follow-camera immediately

This document is the product and engineering contract for camera behavior. It is intentionally broader than the current implementation.

## Mental Model

### Planning mode

Planning mode is active whenever a trip is not active.

Planning mode is where route selection and route editing happen. Route framing owns the camera in this mode.

When both `S` and `T` are pinned, the map should fly to fit the selected route into the currently available map space. This applies regardless of whether GPS locating is active.

Planning mode includes both of these UI states:

- control panel open
- control panel closed

The available map space changes between those states, so the fitted camera result must also change.

### Navigation mode

Navigation mode begins when either `Start Trip` or `Preview Trip` is selected.

With the control panel closed, navigation uses a follow-camera:

- center on the current real or preview position
- use navigation zoom
- see @docs/plans/location-tracking-roadmap.md -> Phase 3 — Route-Oriented Navigation View

When the control panel opens during navigation, navigation is paused from a camera perspective. The camera should stop following the current position and should behave exactly like planning mode until the panel is closed again.

## Camera Ownership

Camera ownership should be explicit and singular.

Effective camera states:

- `planning camera`: active when `!isTripActive || panelOpen`
- `navigation follow camera`: active when `isTripActive && !panelOpen`

Priority rules:

1. If navigation is active and the panel is closed, follow-camera owns the camera.
2. If the panel is open, planning camera owns the camera even during an active trip.
3. In planning camera state, route framing wins over locate-centering behavior.
4. Manual pan and zoom do not create a lasting camera lock in planning mode. Any meaningful route or layout change may reclaim the camera and refit.

## Available Map Space

### Desktop

Desktop has two available-space layouts:

- panel closed: full-width map
- panel open: map area to the right of the sidebar

Whenever camera framing happens, the fit must account for the current sidebar state so the route is visible in the actual map viewport rather than behind the sidebar.

### Mobile

Mobile available space is dynamic. It depends on the visible bottom-sheet height, not just whether the sheet is mounted.

Mobile framing must account for:

- panel closed: full-height map
- panel open: map area above the visible sheet
- sheet drag changes: continuously changing visible map height

Camera fitting should prefer measured visible sheet height. A fixed fallback is acceptable only before the real height is available on first measurement.

## Planning Behavior

### Core rule

When both `S` and `T` are pinned, planning mode should fit the route into the currently available map space.

### Fit target

Preferred target:

- full `routeCoords` polyline

Fallback target:

- start and end bounds when both endpoints exist but route geometry is still loading or missing

This fallback exists so the camera behaves sensibly before a route response arrives, but full route geometry should take over as soon as it is available.

### Trigger conditions

Planning-mode fit should run on every meaningful route or layout change:

- start set or changed
- end set or changed
- route geometry redraw, even with unchanged endpoints
- route preference changes that produce a different route
- desktop panel open
- desktop panel close
- mobile sheet open
- mobile sheet drag offset change
- mobile sheet visible-height change
- stop trip returning from navigation to planning
- GPS locate setting or replacing the start point

### GPS locating in planning mode

GPS locating does not own the camera in planning mode once both endpoints are pinned.

Desired behavior:

- GPS may be used to set or update the start point
- once both `S` and `T` exist, route fit wins
- ongoing GPS availability does not keep the map in follow mode during planning

## Navigation Behavior

### Panel closed

With navigation active and panel closed, the camera should:

- snap or fly to the current real or preview position when navigation starts
- use navigation zoom
- continue following the current position while navigation remains active
- rotate to heading when heading is available

Preview trip and real trip share the same camera behavior. Only the position source differs.

### Panel open

Opening the panel during navigation pauses follow-camera ownership.

While the panel is open, the camera should behave exactly like planning mode:

- fit the full current route into the available map space
- continue refitting on route redraws
- continue refitting on available-space changes

The panel-open state is therefore a route-editing and route-review state, even during an active trip.

### Panel close

Closing the panel during navigation should immediately resume follow-camera behavior:

- center on the current real or preview position
- restore navigation zoom
- continue heading rotation when available

The desired resume behavior is immediate follow reset rather than preserving the panel-open zoom level.

## Transition Matrix

### Planning transitions

`S` selected, `T` missing:

- no full-route fit yet
- existing selection behavior may continue

`T` selected after `S`:

- fit the route to available map space

Route redraw with same endpoints:

- refit the route to available map space

Desktop panel open or close:

- refit for the new available width

Mobile sheet open, drag, or resize:

- refit for the new available visible height

Manual pan followed by route or layout change:

- planning camera may reclaim the camera and refit

### Navigation transitions

Start Trip:

- enter navigation mode
- snap or fly to current position at navigation zoom
- begin follow-camera

Preview Trip:

- enter navigation mode with preview position source
- use the same follow-camera behavior as a real trip

Open panel during navigation:

- suspend follow-camera
- fit full current route to available map space

Edit route while panel is open:

- keep using planning-style fit behavior

Close panel during navigation:

- immediately resume follow-camera at current position and navigation zoom

Stop Trip:

- leave navigation mode
- return to planning-mode route framing

## Deferred Case: Route Edits That Move The Route Off The Current Position

One important case remains intentionally deferred for a future spec.

If the user opens the panel during navigation, edits the route, and creates a new route that no longer contains the current real or preview position, the product direction is to restart from the current position rather than silently continue on an inconsistent trip.

That recovery flow is not fully specified here. It will be addressed in a future document.

For this camera contract, the important rule is simpler:

- panel-open still uses planning-style route fit
- panel-close should only resume follow-camera once navigation state is valid again under the future trip-restart design

## Implementation

Camera decisions are centralized in `frontend/src/features/map/hooks/useMapCamera.js`.

That hook owns:

- camera mode derivation (`planning` vs `navigation`)
- route-fit padding calculation
- planning-mode fit triggers
- navigation-mode follow behavior
- panel-open and panel-close transitions
- locate fly-to

Pure geometry helpers (`computePadding`, `fitRouteBounds`, `fitPolylineBounds`, `fitCurrentRoute`) live in `frontend/src/features/map/utils/cameraGeometry.js`.

### Phase 3 implementation notes

All three Phase 3 sub-tasks are complete:

**3b — Camera padding:** Navigation `flyTo` calls pass `padding: { bottom: viewportHeight * NAVIGATION_BOTTOM_PADDING_RATIO }` (0.4), anchoring the blue dot at ~30% from the bottom. `map.getContainer().clientHeight` is used (not `map.transform.height`) because react-map-gl's `MapRef` wrapper does not expose internal transform properties.

**3c — Pan-away snap-back:** `useFollowing` (`features/navigation/hooks/useFollowing.js`) listens for `movestart` events with `e.originalEvent` (user-initiated only; programmatic `flyTo`-triggered events have no `originalEvent`). On user pan: `isFollowing = false` + 4-second timer. On snap-back: `isFollowing = true`. `useMapCamera` resets `hasCenteredRef` when `isFollowing` transitions to true, causing Effect B to fire its first-entry branch and restore `TRIP_FLY_ZOOM = 18` (not the user's panned-away zoom).

**3a — Route bearing:** `useRouteProgress` (`features/navigation/hooks/useRouteProgress.js`) projects the GPS position onto the nearest route segment and returns the forward azimuth. `MapView` passes `routeBearing ?? position?.heading ?? null` to `useMapCamera`. Bearing is merged into the `flyTo` call (not a separate `rotateTo`) to avoid MapLibre animation interruption.

## Acceptance Criteria

- In planning mode, any route selection or route redraw with both endpoints pinned fits the route into the actual available map space.
- This is true on desktop and mobile.
- This is true whether GPS locating is active or not.
- In navigation mode with panel closed, the camera follows the current real or preview position at navigation zoom and rotates to heading when available.
- Opening the panel during navigation pauses follow-camera and restores planning-style route framing.
- Closing the panel during navigation resumes follow-camera immediately.
- Desktop sidebar width and mobile visible sheet height are both respected by route fitting.
