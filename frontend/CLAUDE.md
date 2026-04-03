# Frontend CLAUDE.md

This file provides guidance for working on the React frontend of Bike-Helsinki.

## Scope
Only work within frontend/. Do not read or modify ingest/ or backend/
unless explicitly asked.

## Directory Structure

```
src/
├── api/
│   ├── http.js             # Axios instance (VITE_API_URL, 15s timeout, error interceptor)
│   ├── backend.js          # Typed wrappers: snapToGraph, getRoute, getHelsinkiConfig, getMeta, ping
│   ├── digitransit.js      # Geocoding: searchAddresses, reverseGeocode (own Axios instance)
│   └── index.js            # Re-exports
├── context/
│   └── RouteContext.jsx    # Central routing context provider (moved from features/routing/)
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
│   │   │   └── MapView.jsx         # MapLibre map (via react-map-gl), markers, route GeoJSON layers, tile styles
│   │   ├── hooks/
│   │   │   └── useFitBounds.js     # All fit-bounds effects + fitBoundsOnDrag callback
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
│   │   │   └── GeolocationContext.jsx      # GPS watch + trip state: position, isLocating, isTripActive
│   │   ├── components/
│   │   │   ├── LocationMarker.jsx          # Accuracy circle (GeoJSON Source/Layer) + blue dot Marker
│   │   │   └── TripController.jsx          # No render; flies to position on location start / trip start via mapRef
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

## Component Hierarchy

```
main.jsx
└── App.jsx
    └── RouteProvider                     ← all routing state lives here
        └── ErrorBoundary                 ← catches runtime throws, shows fallback
            └── RouteSettingsProvider     ← panel/settings state (consumes useRoute internally)
                └── GeolocationProvider  ← GPS position watch and trip active state
                    └── AppContent (useRoute, useRouteSettingsContext, useInfoWindow)
                        ├── AddressSearch
                        ├── MapView       ← consumes useRouteSettingsContext for isSatView;
                        │                    renders LocationMarker + TripController
                        ├── ControlPanel  ← zero props; consumes context internally
                        └── InfoWindow
```

## State Management

**Pattern: Context API only** — no Redux or Zustand.

- **`RouteContext` (`RouteProvider` / `useRoute()`)** — single source of truth for routing state:
  - `snappedStart`, `snappedEnd` — snapped graph node + resolved address
  - `routeCoords`, `routeModes` — path coordinates + per-segment mode bits
  - `appliedMask`, `appliedPenalty` — active surface filter and penalty
  - `cfg` — Helsinki bbox from backend
  - `totals` — batched stats object: `{ totalDistanceM, totalDurationS, distanceBikePreferred, distanceBikeNonPreferred, totalDistanceWalk }`. All five values update in a single `setTotals` call to avoid cascading re-renders.
  - Lives at `src/context/RouteContext.jsx`; `features/routing/RouteProvider.jsx` is a re-export shim

- **`RouteSettingsContext` (`RouteSettingsProvider` / `useRouteSettingsContext()`)** — panel UI state:
  - `panelOpen`, `draftMask`, `draftPenalty`, `isSatView` — local before Apply
  - `routeFitTick` / `triggerRouteFit()` — counter incremented to signal `useFitBounds` to refit
  - `setSheetHeight(h)` — called by MobileSheet's ResizeObserver; updates internal ref only (no state re-render)
  - `getSheetHeight()` — stable accessor for the current measured sheet height; consumed by `useFitBounds`
  - Handlers: `applySettings`, `toggleDraftBit`, `toggleSatView`, etc.
  - Lives at `src/features/routeSettings/context/RouteSettingsContext.jsx`
  - `useRouteSettings()` is an alias for `useRouteSettingsContext()` (backwards compat)

- **`GeolocationContext` (`GeolocationProvider` / `useGeolocation()`)** — GPS state:
  - `position` — `{ lat, lon, accuracy, heading, speed }` or null
  - `isLocating` — whether GPS watch is active
  - `isTripActive` — whether trip-tracking mode is active
  - `error` — geolocation error if any

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
Routes are rendered as three separate MapLibre GeoJSON `Source`/`Layer` pairs — one per mode type (`route-bike-pref`, `route-bike-nonpref`, `route-foot`). Layer paint props encode color and dash patterns. A fallback single-color polyline layer is used when `routeModes` is absent.

### Async Route Fetching
`RouteContext` uses `AbortController` to cancel stale requests. Route recalculates automatically via `useEffect` when endpoints or settings change. Reverse geocoding on marker drag uses a 150ms debounce (`DRAG_DEBOUNCE_MS`).

### Geocoding HTTP Client
`digitransit.js` uses its **own** dedicated Axios instance (not `http.js`), because Digitransit is an external service with a different base URL. Both `searchAddresses` and `reverseGeocode` accept a `signal` parameter for AbortController support. Both functions normalise Digitransit GeoJSON responses to a consistent internal format: `{ place_id, display_name, lat, lon, address }`.

### Map Bounds Fitting
`MapView` uses two `useEffect` hooks to manage the viewport:
1. When both endpoints are set: calls `map.fitBounds()` with padding that accounts for the sidebar (desktop) or bottom sheet (mobile).
2. When the panel opens: re-fits bounds so the panel does not obscure the route.

Padding constants (`SIDEBAR_WIDTH_PX` etc.) come from `src/shared/constants/config.js`.

### Imperative Map Control
`TripController` receives `mapRef` as a prop (passed from `MapView`). All viewport changes are made imperatively:
- On `isLocating` start: `mapRef.current.flyTo({ center, zoom: 15 })`
- On `isTripActive` start: zoom to 18 and continuously track position (1s debounce)
- Uses `mapRef.current.rotateTo()` for heading alignment during trip

### GPS-to-Start in AddressSearch
When `isLocating` is true, `AddressSearch` passes an `onLocate` handler to the **start** `SearchField` only. Clicking the locate button calls `actions.setPointFromCoords(position.lat, position.lon, "start")`, snapping the current GPS position as the route start point. The end field never receives `onLocate`.

### Geolocation & Trip Tracking
`TripController` is a renderless component inside the map that uses `mapRef` to imperatively control the viewport (see above).

`LocationMarker` renders the accuracy radius as a GeoJSON polygon via `Source`/`Layer` and the blue dot position as a `Marker` from `react-map-gl/maplibre`.

### Responsive Layout
`useIsMobile()` (breakpoint: 640px / `MOBILE_BREAKPOINT_PX`) switches the ControlPanel between:
- **Desktop**: `DesktopSidebar` — fixed left sidebar (`SIDEBAR_WIDTH_PX = 320`)
- **Mobile**: `MobileSheet` — scrollable bottom sheet (max-height 85vh) with tab nav ("Planner" / "Preferences")

Both layout components consume `useRouteSettingsContext()` and `useRoute()` directly — zero props from ControlPanel.

### Map Viewport / Fit-Bounds Behavior
All fit-bounds logic lives in `src/features/map/hooks/useFitBounds.js`. `MapView` calls `useFitBounds(...)` and receives a `fitBoundsOnDrag` callback for marker drag handlers.

The hook contains three `useEffect` triggers:

**1. Endpoint change** (fires on `snappedStart?.idx` / `snappedEnd?.idx`):
- Skips if both indices are unchanged (guards against re-renders).
- Desktop: fits only when at least one endpoint is outside the current viewport. Left pad = `SIDEBAR_WIDTH_PX + 80` when panel open, `80` otherwise.
- Mobile: fits only when panel is **closed**. Symmetric `80px` padding — full screen available.

**2. Panel open/close** (fires on `panelOpen`):
- Desktop panel **opens**: refit with sidebar padding so the route uses the new available space.
- Mobile panel **closes** (drag-down dismiss): refit with symmetric `80px` padding — full screen is now available.

**3. `routeFitTick`** (mobile explicit refit):
- Triggered by: switching to the Preferences tab, pressing Apply (both tabs), stopping a trip.
- Uses `getSheetHeight() || MOBILE_SHEET_HEIGHT_PX` + 10px as bottom padding, keeping the lower marker clear of the sheet edge.
- Callers that switch tabs (Preferences tab click, Planner Apply) defer via `setTimeout(0)` so the ResizeObserver can update the sheet height before the effect reads it.

**`fitBoundsOnDrag`** — returned from the hook; used by both marker drag handlers on mobile. Same sheet-height bottom padding as `routeFitTick`.

Sheet height is measured dynamically via `ResizeObserver` in `MobileSheet` and stored as a ref in `RouteSettingsContext` (`setSheetHeight` / `getSheetHeight()`). No state is involved — the ref updates synchronously on resize without triggering re-renders. `MOBILE_SHEET_HEIGHT_PX` is the fallback used before the sheet has mounted.

### Shared Constants
Magic numbers live in `src/shared/constants/config.js`:
- `MAX_PENALTY` — maximum surface penalty (1000)
- `MOBILE_BREAKPOINT_PX` — responsive breakpoint (640)
- `SEARCH_DEBOUNCE_MS` — geocoding search debounce (300)
- `DRAG_DEBOUNCE_MS` — reverse geocode on drag debounce (150)
- `DEFAULT_MASK` — default surface bitmask (0xffff)
- `MIN_BAR_WIDTH_PCT` — minimum bar width in stacked chart (1.5)
- `MOBILE_SHEET_HEIGHT_PX` — fallback bottom padding for mobile fit-bounds when `getSheetHeight()` returns 0 (sheet not yet mounted)

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
1. **`useCallback`** on every function exposed in context (`handleMapClick`, `applySettings`, `resetStats`, `handleMarkerDragEnd`, `fetchRoute`, `resolveAddress`, and the `setPoint*` helpers) — stable refs across renders
2. **Batched `totals` state** — five stats update in one `setTotals` call instead of five separate `setState` calls
3. **`useMemo`** on the `settings` sub-object, the `actions` sub-object, and the top-level `value` — the provider only propagates a new context value when a genuine dep changes

## Known Inconsistencies & Refactoring Candidates

These are places where the code deviates from its own established patterns, or where files have grown large enough to warrant splitting. They are not bugs — just documented technical debt.

### ~~a. Icon duplication~~ (resolved)
`TripIcon` has been extracted to `src/shared/components/Icons/TripIcon.jsx` with a `size` prop. The remaining inline icon is in `AddressSearch.jsx` (clear/home icon) — low priority.

### ~~b. DesktopSidebar / MobileSheet duplication~~ (resolved)
- Bulk-action logic extracted to `useBulkSurfaceActions` hook
- Shared header + trip button extracted to `PanelToolbar` component
- Remaining difference is intentional: outer layout structure (fixed sidebar vs draggable sheet)

### ~~c. Inconsistent button styling~~ (resolved)
`satBtn(active)` added to `ControlPanel.styles.js`, consistent with `locationBtn(active)` and `tripBtn(active)` pattern.

### d. MapView size (277 lines)
`MapView.jsx` handles: map initialisation, start/end marker rendering, route GeoJSON layers (×3 mode types + fallback), tile-style switching, and geolocation subcomponent integration. Fit-bounds logic has been extracted to `useFitBounds`.

Remaining refactoring candidate:
- `<RoutePolylines routeCoords routeModes dragging />` — extract the three `Source`/`Layer` sets and fallback layer into a child component

### e. RouteContext size (278 lines)
`RouteContext.jsx` has 9+ distinct concerns. The most self-contained extraction candidate is the 45-line reverse-geocoding block (lines ~92–136), which handles AbortController, debounce, coordinate snapping, and address reconciliation.

Refactoring candidate: `useReverseGeocoding()` hook that accepts a snap callback and returns a debounced `resolveAddress(lat, lon, field)` function.
