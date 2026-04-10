# Frontend CLAUDE.md

This file provides coding guidance for working on the React frontend of Bike-Helsinki.

## Scope
Only work within frontend/. Do not read or modify ingest/ or backend/
unless explicitly asked.

## Reference Docs

The following docs are the single source of truth for architecture overviews and behavior contracts. Read them before making structural changes.

- [`docs/frontend/frontend-architecture.md`](/Users/willdonnelly/Documents/code/bikeMap/docs/frontend/frontend-architecture.md) — component hierarchy, state ownership, feature boundaries, data flow
- [`docs/frontend/camera-behavior.md`](/Users/willdonnelly/Documents/code/bikeMap/docs/frontend/camera-behavior.md) — camera mode contract, planning/navigation transitions, acceptance criteria

## Directory Structure

```
src/
├── api/
│   ├── http.js             # Axios instance (VITE_API_URL, 15s timeout, error interceptor)
│   ├── backend.js          # Typed wrappers: snapToGraph, getRoute, getHelsinkiConfig, getMeta, ping
│   ├── digitransit.js      # Geocoding: searchAddresses, reverseGeocode (own Axios instance)
│   └── index.js            # Re-exports
├── context/
│   ├── RouteContext.jsx    # Central routing context provider (moved from features/routing/)
│   └── hooks/
│       └── useReverseGeocoding.js  # AbortController + debounce for reverse geocoding both endpoints
├── features/
│   ├── routing/
│   │   ├── RouteProvider.jsx       # Re-export shim → @/context/RouteContext
│   │   ├── components/
│   │   │   ├── AddressSearch.jsx   # Dual address inputs; consumes useGeolocation to expose GPS-to-start
│   │   │   └── SearchField.jsx     # Reusable input + dropdown; renders locate button when onLocate prop provided
│   │   ├── hooks/
│   │   │   └── useGeocoding.js         # Debounced search with AbortController
│   │   ├── utils/
│   │   │   └── formatAddress.js    # Parse Digitransit-normalised address object → readable string
│   │   └── index.js
│   ├── map/
│   │   ├── components/
│   │   │   ├── MapView.jsx         # MapLibre map (via react-map-gl), markers, tile styles
│   │   │   └── RoutePolylines.jsx  # Route GeoJSON Source/Layer sets (3 mode types + fallback)
│   │   ├── hooks/
│   │   │   └── useMapCamera.js     # Unified camera controller: planning fit + navigation follow + locate fly-to
│   │   ├── utils/
│   │   │   └── cameraGeometry.js   # Pure helpers: computePadding, fitRouteBounds, fitPolylineBounds, fitCurrentRoute
│   │   └── index.js
│   ├── routeSettings/
│   │   ├── components/
│   │   │   ├── ControlPanel.jsx            # Thin: renders DesktopSidebar or MobileSheet
│   │   │   ├── DesktopSidebar.jsx          # Fixed left sidebar layout (desktop)
│   │   │   ├── MobileSheet.jsx             # Draggable bottom sheet layout (mobile)
│   │   │   ├── PanelToolbar.jsx            # Shared header row + trip button (used by both layouts)
│   │   │   ├── GlobeIcon.jsx               # Shared SVG icon (sat view toggle)
│   │   │   ├── ControlPanel.styles.js      # Includes satBtn(active) style function
│   │   │   ├── SurfaceCheckboxGroup.jsx
│   │   │   ├── SurfacePenaltyControl.jsx   # Range slider + number input (0–300 s/km)
│   │   │   ├── RideStats.jsx               # Duration, distance, stacked bar chart
│   │   │   ├── RideStats.styles.js
│   │   │   ├── DistanceBar.jsx
│   │   │   └── BulkActions.jsx
│   │   ├── constants/
│   │   │   └── surfaceTypes.js             # 16-bit surface flag definitions
│   │   ├── context/
│   │   │   └── RouteSettingsContext.jsx    # Panel state context: draftMask, draftPenalty, isSatView
│   │   ├── hooks/
│   │   │   ├── useRouteSettings.js         # Re-export alias → useRouteSettingsContext
│   │   │   ├── useDraggableSheet.js        # Mobile drag-to-dismiss behavior
│   │   │   └── useBulkSurfaceActions.js    # selectAll/None/Paved/Unpaved bulk mask logic
│   │   ├── utils/
│   │   │   └── barChartCalculations.js     # Stacked bar percentages with MIN_BAR_WIDTH_PCT min width
│   │   └── index.js
│   ├── geolocation/
│   │   ├── context/
│   │   │   └── GeolocationContext.jsx      # GPS watch + trip state: position, isLocating, isTripActive, outOfBounds
│   │   └── index.js
│   ├── navigation/
│   │   ├── components/
│   │   │   └── LocationMarker.jsx          # Accuracy circle (GeoJSON Source/Layer) + blue dot Marker
│   │   ├── hooks/
│   │   │   ├── useFollowing.js             # Pan detection + 4-second snap-back timer; returns { isFollowing }
│   │   │   └── useRouteProgress.js         # Point-to-segment projection for route bearing; returns { bearing }
│   │   └── index.js
│   ├── devTools/
│   │   ├── enabled.js                      # DEV_TOOLS_ENABLED = import.meta.env.DEV (tree-shaken in prod)
│   │   ├── context/
│   │   │   └── PreviewTripContext.jsx      # isPreviewActive, progressM, totalM, autoAdvance, actions
│   │   ├── hooks/
│   │   │   └── usePreviewTripEngine.js     # rAF loop: advances progressM, writes setPositionOverride
│   │   ├── components/
│   │   │   ├── PreviewTripButton.jsx       # Renders inside PanelToolbar (gated on DEV_TOOLS_ENABLED)
│   │   │   └── PreviewTripSlider.jsx       # Bottom-of-screen scrub slider (gated)
│   │   ├── utils/
│   │   │   └── routeInterpolation.js       # Cumulative-distance table + positionAt(progressM) → {lat,lon,heading}
│   │   └── index.js
│   └── infoWindow/
│       ├── components/
│       │   ├── InfoWindow.jsx              # Welcome modal with onboarding instructions + legend
│       │   └── InfoWindow.styles.js        # Style objects for InfoWindow
│       ├── hooks/
│       │   └── useInfoWindow.js
│       └── index.js
├── shared/
│   ├── components/
│   │   ├── ErrorBoundary.jsx   # Class component; wraps AppContent to catch runtime throws
│   │   └── Icons/
│   │       └── TripIcon.jsx    # SVG chevron icon; accepts size prop (default 16)
│   ├── constants/
│   │   ├── colors.js           # ROUTE_COLORS: bikePreferred, bikeNonPreferred, walk
│   │   └── config.js           # Named magic numbers: MAX_PENALTY, MOBILE_BREAKPOINT_PX, etc.
│   ├── hooks/
│   │   └── useIsMobile.js      # max-width: 640px breakpoint (uses MOBILE_BREAKPOINT_PX)
│   ├── utils/
│   │   ├── math.js             # clamp(n, lo, hi)
│   │   └── format.js           # formatKm(m), formatDuration(s)
│   └── index.js
├── App.jsx
├── main.jsx
└── index.css
```

## State Management

**Pattern: Context API only** — no Redux or Zustand.

- **`RouteContext` (`RouteProvider` / `useRoute()`)** — routing state:
  - `snappedStart`, `snappedEnd` — snapped graph node + resolved address
  - `routeCoords`, `routeModes` — path coordinates + per-segment mode bits
  - `appliedMask`, `appliedPenalty` — active surface filter and penalty
  - `cfg` — Helsinki bbox from backend (`{ bbox: { minLon, minLat, maxLon, maxLat }, viewbox, viewboxString }`)
  - `totals` — `{ totalDistanceM, totalDurationS, distanceBikePreferred, distanceBikeNonPreferred, totalDistanceWalk }`
  - `routeLoading` — true while `backend.getRoute()` is in flight
  - Lives at `src/context/RouteContext.jsx`; `features/routing/RouteProvider.jsx` is a re-export shim

- **`RouteSettingsContext` (`RouteSettingsProvider` / `useRouteSettingsContext()`)** — panel UI state:
  - `panelOpen`, `draftMask`, `draftPenalty`, `isSatView`
  - `cameraRefitTick` / `triggerCameraRefit()` — signals `useMapCamera` to refit (mobile sheet interactions)
  - `setSheetHeight(h)`, `setSheetOffset(offset)`, `getSheetVisibleHeight()` — ref-based, no re-render
  - `useRouteSettings()` is an alias for `useRouteSettingsContext()`

- **`GeolocationContext` (`GeolocationProvider` / `useGeolocation()`)** — GPS state:
  - `position` — `{ lat, lon, accuracy, heading, speed }` or null (positionOverride takes precedence)
  - `isLocating`, `isTripActive`, `error`
  - `outOfBounds` — true when position is outside `cfg.bbox`; clears on `stopLocating`
  - `setPositionOverride(pos)` — Preview Trip injects fake position; overrides real GPS while set

- **`useInfoWindow()`** — modal open/closed
- **`useGeocoding()`** — search query, results, debounce + AbortController
- **`useDraggableSheet()`** — touch drag for mobile bottom sheet

## Key Patterns

### Coordinate Conventions
The app uses `{lat, lon}` everywhere. MapLibre's map click events emit `lngLat: { lat, lng }`. The conversion happens at the boundary in `MapView.jsx`:
```js
const fromLngLat = ({ lat, lng }) => ({ lat, lon: lng });
```
`react-map-gl` `Marker` components receive separate `longitude` and `latitude` props.

Never mix `lon`/`lng` outside of MapView.

### Surface Bit Masking
Surface types are 16-bit flags defined in `surfaceTypes.js`. The active set of allowed surfaces is stored as a bitmask (`appliedMask`). Route segment modes use 3-bit flags:
- `0x1` — bike preferred (blue)
- `0x2` — bike non-preferred (orange)
- `0x4` — foot/walk (dotted purple)

### Route Rendering
Routes are rendered by `RoutePolylines` as three MapLibre GeoJSON `Source`/`Layer` pairs — one per mode type (`route-bike-pref`, `route-bike-nonpref`, `route-foot`). A fallback single-color polyline layer is used when `routeModes` is absent.

### Async Route Fetching
`RouteContext` recalculates automatically via `useEffect` when endpoint identities or applied settings change. Reverse geocoding uses `AbortController`, but route fetching itself does not currently cancel stale requests. Reverse geocoding on marker drag uses a 150ms debounce (`DRAG_DEBOUNCE_MS`).

### Geocoding HTTP Client
`digitransit.js` uses its own dedicated Axios instance (not `http.js`). Both `searchAddresses` and `reverseGeocode` accept a `signal` parameter for AbortController support and normalise responses to `{ place_id, display_name, lat, lon, address }`.

### Map Camera Control
All camera decisions live in `useMapCamera.js`. See [`docs/frontend/camera-behavior.md`](/Users/willdonnelly/Documents/code/bikeMap/docs/frontend/camera-behavior.md) for the full contract.

Key implementation facts:
- Camera mode: `isTripActive && !panelOpen ? "navigation" : "planning"`
- Navigation bearing is merged into `flyTo` (not a separate `rotateTo`) — calling `rotateTo` after `flyTo` cancels the center animation
- `map.getContainer().clientHeight` for viewport height — react-map-gl's `MapRef` does not expose `map.transform`

### GPS-to-Start in AddressSearch
When `isLocating` is true, `AddressSearch` passes an `onLocate` handler to the **start** `SearchField` only. Clicking it calls `actions.setPointFromCoords(position.lat, position.lon, "start")`. The end field never receives `onLocate`.

### Responsive Layout
`useIsMobile()` (breakpoint: 640px / `MOBILE_BREAKPOINT_PX`) switches the ControlPanel between:
- **Desktop**: `DesktopSidebar` — fixed left sidebar (`SIDEBAR_WIDTH_PX = 320`)
- **Mobile**: `MobileSheet` — scrollable bottom sheet (max-height 85vh) with tab nav

Sheet height is measured via `ResizeObserver` in `MobileSheet`. `MOBILE_SHEET_HEIGHT_PX` is the fallback before first measurement.

### Shared Constants
Magic numbers live in `src/shared/constants/config.js`:
- `MAX_PENALTY` — maximum surface penalty (1000)
- `PENALTY_SLIDER_MAX` — UI slider max (300)
- `MOBILE_BREAKPOINT_PX` — responsive breakpoint (640)
- `SEARCH_DEBOUNCE_MS` — geocoding search debounce (300)
- `DRAG_DEBOUNCE_MS` — reverse geocode on drag debounce (150)
- `DEFAULT_MASK` — default surface bitmask (0xffff)
- `MIN_BAR_WIDTH_PCT` — minimum bar width in stacked chart (1.5)
- `MOBILE_SHEET_HEIGHT_PX` — fallback bottom padding before sheet mounts
- `API_TIMEOUT_MS` — Axios timeout (15000)
- `LOCATE_FLY_ZOOM` — zoom on locate start (15)
- `TRIP_FLY_ZOOM` — zoom on trip start or snap-back (18)
- `NAVIGATION_BOTTOM_PADDING_RATIO` — bottom padding for navigation follow-camera (0.4)
- `SNAP_BACK_DELAY_MS` — snap-back delay after user pan (4000)

### Shared UI Colors
`src/shared/constants/colors.js` exports:
- `ROUTE_COLORS` — `bikePreferred`, `bikeNonPreferred`, `walk`
- `UI_COLORS` — `startMarker`, `endMarker`, `primary`, `error`, `satActive`, `satActiveBg`

### Route Mode Bits
`src/features/routeSettings/constants/surfaceTypes.js` also exports:
- `MODE_BIKE_PREFERRED` (0x1), `MODE_BIKE_NON_PREFERRED` (0x2), `MODE_FOOT` (0x4) — must match backend `route.cpp`

### Accessibility
`SearchField` applies semantic ARIA attributes:
- `aria-label` on the `<input>` — `"Start address"` or `"End address"` based on `pointType`
- `role="listbox"` on the dropdown container
- `role="option"` + `aria-selected={false}` on each result item

### Error Handling
`ErrorBoundary` (`src/shared/components/ErrorBoundary.jsx`) implements both lifecycle methods:
- `getDerivedStateFromError` — switches to fallback UI on any render throw
- `componentDidCatch` — logs the error and React component stack via `console.error`

## Styling Conventions

- **Inline style objects** — the primary styling method throughout
- **`ComponentName.styles.js`** — exports reusable style objects for larger components (ControlPanel, RideStats, InfoWindow)
- **No CSS-in-JS library**, no CSS modules
- Global styles only in `index.css` (font, margin reset, 100% height)

## File & Import Conventions

- Components: `PascalCase.jsx`
- Hooks: `camelCase.js` with `use` prefix
- Utils/constants: `camelCase.js`
- Styles modules: `ComponentName.styles.js`
- Path alias `@/` resolves to `src/` — use this for all non-relative imports
- Exception: files exported from `shared/index.js` must use relative imports within `shared/` to avoid circular dependencies
- Feature `index.js` files re-export public surface: `export { Foo } from "./components/Foo"`

## API Integration

All API calls go through `src/api/`. Do not call Axios directly from components.

```js
import { backend, geocoding } from "@/api"

backend.snapToGraph(lat, lon)
backend.getRoute({ startIdx, endIdx, options })
geocoding.searchAddresses({ q, viewbox })
geocoding.reverseGeocode({ lat, lon })
```

The HTTP client reads `VITE_API_URL` at build time (dev default: `http://localhost:3000`). The geocoding client reads `VITE_DIGITRANSIT_KEY` for the `digitransit-subscription-key` header.

## Performance Notes

- `useMemo` for expensive derived values: SVG pin icons, polyline segment runs
- `useCallback` for stable function refs passed as props
- Route polylines rendered as MapLibre GeoJSON `Source`/`Layer` sets (one per mode type)

### RouteContext memoization strategy
All context consumers are protected from spurious re-renders by three layers:
1. **`useCallback`** on every function exposed in context — stable refs across renders
2. **Batched `totals` state** — five stats update in one `setTotals` call
3. **`useMemo`** on the `settings` sub-object, `actions` sub-object, and top-level `value`
