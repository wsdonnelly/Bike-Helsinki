const TO_RAD = Math.PI / 180;

function haversineM(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * TO_RAD;
  const dLon = (lon2 - lon1) * TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * TO_RAD;
  const y = Math.sin(dLon) * Math.cos(lat2 * TO_RAD);
  const x =
    Math.cos(lat1 * TO_RAD) * Math.sin(lat2 * TO_RAD) -
    Math.sin(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) * Math.cos(dLon);
  return ((Math.atan2(y, x) / TO_RAD) + 360) % 360;
}

export function buildCumulativeTable(routeCoords) {
  const n = routeCoords.length;
  const segmentLengths = new Float64Array(Math.max(0, n - 1));
  const cumulative = new Float64Array(n);
  cumulative[0] = 0;
  for (let i = 1; i < n; i++) {
    const [lat1, lon1] = routeCoords[i - 1];
    const [lat2, lon2] = routeCoords[i];
    segmentLengths[i - 1] = haversineM(lat1, lon1, lat2, lon2);
    cumulative[i] = cumulative[i - 1] + segmentLengths[i - 1];
  }
  return { segmentLengths, cumulative, total: cumulative[n - 1] ?? 0 };
}

export function positionAt(table, routeCoords, progressM) {
  const { cumulative, total } = table;
  const n = routeCoords.length;
  if (n === 0) return { lat: 0, lon: 0, heading: 0 };
  if (n === 1) return { lat: routeCoords[0][0], lon: routeCoords[0][1], heading: 0 };

  const clamped = Math.max(0, Math.min(progressM, total));

  let lo = 0;
  let hi = n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= clamped) lo = mid;
    else hi = mid;
  }

  const [lat1, lon1] = routeCoords[lo];
  const [lat2, lon2] = routeCoords[hi];
  const segLen = cumulative[hi] - cumulative[lo];
  const t = segLen > 0 ? (clamped - cumulative[lo]) / segLen : 0;

  return {
    lat: lat1 + (lat2 - lat1) * t,
    lon: lon1 + (lon2 - lon1) * t,
    heading: bearingDeg(lat1, lon1, lat2, lon2),
  };
}
