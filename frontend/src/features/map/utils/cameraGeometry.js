import { SIDEBAR_WIDTH_PX } from "@/shared/constants/config";

export function computePadding(isMobile, panelOpen, sheetHeight = 0) {
  if (isMobile) {
    if (sheetHeight > 0) {
      return { top: 40, bottom: sheetHeight + 10, left: 60, right: 60 };
    }
    return { top: 80, bottom: 80, left: 80, right: 80 };
  }
  const leftPad = panelOpen ? SIDEBAR_WIDTH_PX + 80 : 80;
  return { top: 80, bottom: 80, left: leftPad, right: 80 };
}

export function fitRouteBounds(map, start, end, padding) {
  map.fitBounds(
    [[Math.min(start.lon, end.lon), Math.min(start.lat, end.lat)],
     [Math.max(start.lon, end.lon), Math.max(start.lat, end.lat)]],
    { padding, duration: 800 }
  );
}

export function fitPolylineBounds(map, routeCoords, padding) {
  if (routeCoords.length < 2) return false;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  routeCoords.forEach(([lat, lon]) => {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });

  map.fitBounds(
    [[minLon, minLat], [maxLon, maxLat]],
    { padding, duration: 800 }
  );
  return true;
}

export function fitCurrentRoute(map, routeCoords, snappedStart, snappedEnd, padding) {
  if (fitPolylineBounds(map, routeCoords, padding)) return;
  if (!snappedStart || !snappedEnd) return;
  fitRouteBounds(map, snappedStart, snappedEnd, padding);
}
