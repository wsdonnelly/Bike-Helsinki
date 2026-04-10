# Future Improvement Ideas

## Reactive mobile sheet height for camera fitting

Currently the mobile sheet's visible height is stored in refs and the camera hook is notified of changes via an explicit tick counter (`cameraRefitTick`). This works but requires every call site that changes the sheet geometry to remember to bump the tick.

An alternative approach: convert the sheet height to debounced React state (e.g. 150ms debounce on the ResizeObserver callback). The camera hook would list sheet height as a dependency and automatically refit when it changes, eliminating the manual tick pattern entirely.

Tradeoffs:

- Removes ~4 manual tick-bump call sites in MobileSheet (drag-close, tab switch, apply, stop trip)
- Makes camera dependencies self-documenting — no hidden imperative triggers
- Costs ~3-5 extra re-renders during a drag gesture (after debouncing), which is negligible
- If new sheet interactions are added in the future, camera fitting works automatically without remembering to wire up a tick

Worth revisiting if the sheet interaction surface grows or if the tick pattern causes bugs from missed call sites.
