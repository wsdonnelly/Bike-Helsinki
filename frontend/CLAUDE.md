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
│   │   │   └── formatAddress.js    # Parse Nominatim address object → readable string
│   │   └── index.js
│   ├── map/
│   │   ├── components/
│   │   │   └── MapView.jsx         # React-Leaflet map, markers, route polylines, tile layers
│   │   └── index.js
│   ├── routeSettings/
│   │   ├── components/
│   │   │   ├── ControlPanel.jsx            # Thin: renders DesktopSidebar or MobileSheet
│   │   │   ├── DesktopSidebar.jsx          # Fixed left sidebar layout (desktop)
│   │   │   ├── MobileSheet.jsx             # Draggable bottom sheet layout (mobile)
│   │   │   ├── GlobeIcon.jsx               # Shared SVG icon (sat view toggle)
│   │   │   ├── ControlPanel.styles.js
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
│   │   │   └── useDraggableSheet.js        # Mobile drag-to-dismiss behavior
│   │   ├── utils/
│   │   │   └── barChartCalculations.js     # Stacked bar percentages with MIN_BAR_WIDTH_PCT min width
│   │   └── index.js
│   ├── geolocation/
│   │   ├── context/
│   │   │   └── GeolocationContext.jsx      # GPS watch + trip state: position, isLocating, isTripActive
│   │   ├── components/
│   │   │   ├── LocationMarker.jsx          # Circle (accuracy radius) + blue dot marker on map
│   │   │   └── TripController.jsx          # No render; flies to position on location start / trip start
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
│   │   └── ErrorBoundary.jsx   # Class component; wraps AppContent to catch runtime throws
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
  - Derived stats: distance, duration, distance by mode
  - Lives at `src/context/RouteContext.jsx`; `features/routing/RouteProvider.jsx` is a re-export shim

- **`RouteSettingsContext` (`RouteSettingsProvider` / `useRouteSettingsContext()`)** — panel UI state:
  - `panelOpen`, `draftMask`, `draftPenalty`, `isSatView` — local before Apply
  - Handlers: `handleApply`, `handleMaskChange`, `handlePenaltyChange`, `toggleSatView`, etc.
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
The app uses `{lat, lon}` everywhere. Leaflet expects `{lat, lng}`. MapView has helpers to convert at the boundary:
```js
lngToLon({ lat, lng })          // Leaflet → app
lonToLeafletTuple({ lat, lon }) // app → Leaflet [lat, lng]
```
Never mix `lon`/`lng` outside of MapView.

### Surface Bit Masking
Surface types are 16-bit flags defined in `surfaceTypes.js`. The active set of allowed surfaces is stored as a bitmask (`appliedMask`). Route segment modes use 3-bit flags:
- `0x1` — bike preferred (blue)
- `0x2` — bike non-preferred (orange)
- `0x4` — foot/walk (dotted purple)

### Async Route Fetching
`RouteContext` uses `AbortController` to cancel stale requests. Route recalculates automatically via `useEffect` when endpoints or settings change. Reverse geocoding on marker drag uses a 150ms debounce (`DRAG_DEBOUNCE_MS`).

### Geocoding HTTP Client
`digitransit.js` uses its **own** dedicated Axios instance (not `http.js`), because Digitransit is an external service with a different base URL. Both `searchAddresses` and `reverseGeocode` accept a `signal` parameter for AbortController support.

### GPS-to-Start in AddressSearch
When `isLocating` is true, `AddressSearch` passes an `onLocate` handler to the **start** `SearchField` only. Clicking the locate button calls `actions.setPointFromCoords(position.lat, position.lon, "start")`, snapping the current GPS position as the route start point. The end field never receives `onLocate`.

### Geolocation & Trip Tracking
`TripController` is a renderless component that lives inside the Leaflet map and uses `useMap()` to imperatively control the viewport:
- On `isLocating` start: fly to position at zoom 15
- On `isTripActive` start: zoom to 18 and continuously track position (1s debounce)

`LocationMarker` renders a `Circle` (accuracy radius) and a `Marker` (blue dot) from the `geolocation` feature when position is available.

### Responsive Layout
`useIsMobile()` (breakpoint: 640px / `MOBILE_BREAKPOINT_PX`) switches the ControlPanel between:
- **Desktop**: `DesktopSidebar` — fixed left sidebar
- **Mobile**: `MobileSheet` — fixed bottom sheet with drag handle and tab nav ("Filters" / "Stats")

Both layout components consume `useRouteSettingsContext()` and `useRoute()` directly — zero props from ControlPanel.

### Shared Constants
Magic numbers live in `src/shared/constants/config.js`:
- `MAX_PENALTY` — maximum surface penalty (1000)
- `MOBILE_BREAKPOINT_PX` — responsive breakpoint (640)
- `SEARCH_DEBOUNCE_MS` — geocoding search debounce (300)
- `DRAG_DEBOUNCE_MS` — reverse geocode on drag debounce (150)
- `DEFAULT_MASK` — default surface bitmask (0xffff)
- `MIN_BAR_WIDTH_PCT` — minimum bar width in stacked chart (1.5)

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
- Canvas renderer on Leaflet for polylines (`renderer={canvasRenderer}`)
