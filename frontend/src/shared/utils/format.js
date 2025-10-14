export const formatKm = (m) => {
  const km = (m || 0) / 1000;
  if (km === 0) return "0.0 km";
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
};

export const formatDuration = (t) => {
  const total = Math.max(0, Math.floor(t ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(
      2,
      "0"
    )}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
};
