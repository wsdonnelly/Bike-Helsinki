# Map Library Migration: Leaflet → MapLibre GL JS

## Context

The app currently uses React-Leaflet 5 + Leaflet 1.9.4 for rendering. Two limitations are driving a migration:
1. **No native rotation** — Leaflet has no built-in map rotation; the community plugin is unmaintained and CSS-hack-based. Trip mode needs smooth compass/heading rotation.
2. **Ceiling on future features** — Leaflet is raster-tile-only, no vector styling, no GPU acceleration, no 3D pitch. Future features (navigation arrows, custom layer styling, animated elements) hit this ceiling fast.

---

## Library Comparison

### MapLibre GL JS ✅ (recommended)
- Open-source MIT fork of Mapbox GL JS (Mapbox went proprietary in 2021)
- WebGL-based: native rotation, pitch (3D tilt), smooth 60fps animations
- Vector tile support → full style control over map appearance
- `react-map-gl` (Visgl) provides React bindings that support MapLibre
- Large, active ecosystem; used by major projects (Meta, AWS, etc.)
- **Tiles:** [OpenFreeMap.org](https://openfreemap.org) — completely free, no API key, OpenMapTiles schema, excellent Finland coverage, self-hostable

### OpenLayers
- Very mature, fully open-source, supports rotation
- Much more verbose API (GIS-oriented, not app-oriented)
- Heavier bundle (~300KB vs ~200KB for MapLibre)
- React integration is third-party and less ergonomic
- Raster-first; vector tile support exists but is secondary
- Not a good fit unless you need complex GIS operations

### Mapbox GL JS v3
- Best-in-class polish and documentation
- **Requires paid Mapbox API key** — conflicts with minimal-cost goal
- Skip.

### deck.gl
- Excellent for data visualization layers (heatmaps, 3D bars, etc.)
- Not a full map library — needs MapLibre or Mapbox underneath
- Overkill for routing; relevant only if you add analytics visualizations later

---

## Tile Source for MapLibre

**OpenFreeMap.org** is the right choice:
- Completely free, no API key or account needed
- Vector tiles in OpenMapTiles schema (compatible with MapLibre styles)
- Covers Finland/Helsinki with full detail
- CDN-hosted; can self-host later if needed
- Style URL: `https://tiles.openfreemap.org/styles/liberty` (or `bright`, `positron`)

For satellite view (replacing the Esri raster layer), Esri's tile URL still works in MapLibre as a raster source — no change needed there.

---

## React Bindings: `react-map-gl`

`react-map-gl` (from Visgl/Urban Computing Foundation) is the standard React wrapper. It:
- Supports MapLibre as the map engine (pass `mapLib={maplibregl}`)
- Provides `<Map>`, `<Marker>`, `<Source>`, `<Layer>`, `useMap()`, `NavigationControl`
- API is familiar but meaningfully different from react-leaflet

---

## Migration Scope

4 files to rewrite, no other files change:

| File | Current | After |
|------|---------|-------|
| `frontend/src/features/map/components/MapView.jsx` | React-Leaflet components + L.* APIs | react-map-gl + MapLibre |
| `frontend/src/features/geolocation/components/LocationMarker.jsx` | `<Circle>` + `<Marker>` + `L.divIcon` | `<Marker>` from react-map-gl + CSS dot |
| `frontend/src/features/geolocation/components/TripController.jsx` | `useMap()` from react-leaflet | `useMap()` from react-map-gl |
| `frontend/src/main.jsx` | `import 'leaflet/dist/leaflet.css'` | remove / replace |

---

## Key API Translations

| Leaflet / React-Leaflet | MapLibre / react-map-gl |
|------------------------|------------------------|
| `<MapContainer>` | `<Map>` with `mapLib={maplibregl}` |
| `<TileLayer url=...>` | `<Source type="raster">` + `<Layer type="raster">` or `mapStyle` prop |
| `<Polyline>` | `<Source type="geojson">` + `<Layer type="line">` |
| `<Marker draggable>` | `<Marker draggable>` (similar API) |
| `<Circle>` | `<Source type="geojson">` + `<Layer type="circle">` with radius in meters |
| `useMap()` + `map.flyTo()` | `mapRef.current.flyTo()` via `useRef` on `<Map>` |
| `useMapEvents({ click })` | `onClick` prop on `<Map>` |
| `map.flyToBounds(bounds)` | `map.fitBounds([[minLng,minLat],[maxLng,maxLat]], { padding })` |
| `L.LatLngBounds` | `[[minLng, minLat], [maxLng, maxLat]]` array |
| `L.icon()` with SVG data URI | HTML `<div>` inside `<Marker>` |
| `maxBounds` on container | `maxBounds` prop on `<Map>` |
| `preferCanvas` | not needed (WebGL renders everything) |

**Coordinate order:** MapLibre GeoJSON uses `[lng, lat]` (GeoJSON standard). The internal app convention stays `{lat, lon}` — the conversion helpers in MapView flip to `[lon, lat]` for MapLibre instead of `[lat, lng]` for Leaflet.

**Map rotation for trip mode:** Call `map.rotateTo(heading, { duration: 300 })`. Add `<NavigationControl showCompass>` to show compass needle. MapLibre exposes `map.getBearing()` and `map.setBearing()` natively.

---

## Implementation Steps

1. **Install packages**
   ```bash
   npm install maplibre-gl react-map-gl
   npm uninstall leaflet react-leaflet
   ```

2. **Rewrite `MapView.jsx`**
   - Replace `<MapContainer>` with `<Map mapLib={maplibregl} mapStyle={...}>`
   - Street view: use OpenFreeMap style URL (vector); satellite: Esri raster URL wrapped in `<Source>/<Layer>`
   - Replace `<Polyline>` with GeoJSON source + line layer per mode
   - Replace `<Marker>` with react-map-gl `<Marker>` using HTML children (same SVG pins)
   - Replace `<ZoomControl>` with `<NavigationControl>` (includes compass for rotation)
   - Replace `useMapEvents({ click })` with `onClick` on `<Map>`
   - Replace `BoundsController` with `map.fitBounds()` via ref
   - Add `bearing` tied to `position.heading` when trip is active

3. **Rewrite `LocationMarker.jsx`**
   - Replace `<Circle>` with GeoJSON source + circle layer
   - Replace `<Marker L.divIcon>` with react-map-gl `<Marker>` + inline `<div>` styled as blue dot

4. **Rewrite `TripController.jsx`**
   - Same follow/zoom logic; use map ref instead of `useMap()`
   - Add `map.rotateTo(heading)` when trip is active and heading is available

5. **Update `main.jsx`**
   - Remove `import 'leaflet/dist/leaflet.css'`
   - Add `import 'maplibre-gl/dist/maplibre-gl.css'`

---

## Verification Checklist

- [ ] Street view tiles load (OpenFreeMap vector style)
- [ ] Satellite toggle switches to Esri raster
- [ ] Map click sets start/end points correctly
- [ ] Route polylines render with correct colors for all 3 modes (bike preferred, bike non-preferred, walk)
- [ ] Dragging start/end pins works, triggers re-route
- [ ] Map auto-fits to route endpoints after snap
- [ ] Location dot + accuracy circle renders when `isLocating`
- [ ] Trip mode: map follows GPS position
- [ ] Trip mode: map rotates to match `position.heading` when heading is available
- [ ] Zoom/pan within Finland bounds works
- [ ] Mobile and desktop layouts unaffected
