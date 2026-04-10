import { useMemo } from "react";

export function useRouteProgress({ routeCoords, position }) {
  return useMemo(() => {
    if (!position || routeCoords.length < 2) return { bearing: null };

    let minDist = Infinity;
    let bestT = 0;
    let bestSegIdx = 0;

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const [lat1, lon1] = routeCoords[i];
      const [lat2, lon2] = routeCoords[i + 1];
      const dx = lon2 - lon1;
      const dy = lat2 - lat1;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
        ((position.lon - lon1) * dx + (position.lat - lat1) * dy) / lenSq
      ));
      const px = lon1 + t * dx;
      const py = lat1 + t * dy;
      const dist = Math.hypot(position.lon - px, position.lat - py);
      if (dist < minDist) {
        minDist = dist;
        bestT = t;
        bestSegIdx = i;
      }
    }

    const [lat1seg, lon1seg] = routeCoords[bestSegIdx];
    const [lat2seg, lon2seg] = routeCoords[bestSegIdx + 1];
    const nearestLat = lat1seg + bestT * (lat2seg - lat1seg);
    const nearestLon = lon1seg + bestT * (lon2seg - lon1seg);

    const dLon = (lon2seg - nearestLon) * (Math.PI / 180);
    const φ1 = nearestLat * (Math.PI / 180);
    const φ2 = lat2seg * (Math.PI / 180);
    const bearing = (Math.atan2(
      Math.sin(dLon) * Math.cos(φ2),
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon)
    ) * 180 / Math.PI + 360) % 360;

    return { bearing };
  }, [position?.lat, position?.lon, routeCoords]);
}
