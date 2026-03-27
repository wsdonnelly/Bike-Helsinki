# Plan: Add Basic Testing Suite to Frontend

## Context

The frontend has no tests at all. The goal is to add a lightweight but useful suite covering the pure utility functions and the two most complex custom hooks. This gives regression coverage for the logic most likely to break silently during refactors.

---

## Framework Choice: Vitest

Vitest is the right choice because it integrates natively with the existing Vite config, automatically honours the `@/` path alias, uses the same transform pipeline (no separate Babel setup), and is significantly faster than Jest for Vite projects.

---

## Packages to Install (dev)

```
vitest jsdom @testing-library/react @testing-library/jest-dom
```

---

## Files to Create or Modify

| File | Action | Purpose |
|---|---|---|
| `frontend/package.json` | edit | Add `"test": "vitest"` and `"test:ui": "vitest --ui"` scripts |
| `frontend/vite.config.js` | edit | Add `test` block: `{ environment: 'jsdom', setupFiles: ['./src/test/setup.js'], globals: true }` |
| `frontend/src/test/setup.js` | create | Import `@testing-library/jest-dom` to extend `expect` |
| `frontend/src/shared/utils/math.test.js` | create | Unit tests for `clamp` |
| `frontend/src/shared/utils/format.test.js` | create | Unit tests for `formatKm` and `formatDuration` |
| `frontend/src/features/routing/utils/formatAddress.test.js` | create | Unit tests for `formatAddress` |
| `frontend/src/features/routeSettings/utils/barChartCalculations.test.js` | create | Unit tests for `calculateSegmentWidths` |
| `frontend/src/features/routing/hooks/useNominatimSearch.test.js` | create | Hook tests for debounce, AbortController, empty query |

---

## vite.config.js addition

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
```

---

## Test Coverage Plan

### `math.test.js`
- `clamp(5, 0, 10)` → 5
- `clamp(-1, 0, 10)` → 0
- `clamp(15, 0, 10)` → 10
- boundaries: `clamp(0, 0, 10)`, `clamp(10, 0, 10)`

### `format.test.js`
- `formatKm(0)` / `formatKm(null)` → `"0.0 km"`
- `formatKm(500)` → `"0.50 km"`
- `formatKm(1000)` → `"1.00 km"`
- `formatKm(10000)` → `"10.0 km"`
- `formatDuration(0)` → `"0s"`
- `formatDuration(90)` → `"1m 30s"`
- `formatDuration(3661)` → `"1h 01m 01s"`
- `formatDuration(null)` → `"0s"`

### `formatAddress.test.js`
- null input → `"Unknown location"`
- full address object (street + city) → `"Mannerheimintie 1, Helsinki"`
- no address, has display_name → first 3 comma-parts joined
- deduplication: city same as suburb → appears once
- no address, no display_name → `"Unnamed place"`

### `barChartCalculations.test.js`
- all zeros → all widths 0
- single segment only → 100%
- three equal segments → ~33.3% each
- segment below MIN_BAR_WIDTH_PCT (1.5%) gets boosted to minimum
- total always normalises to 100 when segments > 0

### `useNominatimSearch.test.js`
- empty query → results stay `[]`, searchFn not called
- query set → searchFn called after debounce delay (fake timers)
- stale request aborted when query changes before delay fires
- results populated from searchFn return value

---

## Verification

```bash
cd frontend
npm test          # all tests pass
npm run lint      # no new warnings
```
