import React from "react";
import { usePreviewTrip } from "../context/PreviewTripContext";
import { useGeolocation } from "@/features/geolocation/context/GeolocationContext";
import { useRouteSettingsContext } from "@/features/routeSettings/context/RouteSettingsContext";
import { formatKm } from "@/shared/utils/format";

export function PreviewTripSlider() {
  const { isPreviewActive, progressM, totalM, setProgressM, pauseAutoAdvance, resumeAutoAdvance } = usePreviewTrip();
  const { isTripActive } = useGeolocation();
  const { panelOpen } = useRouteSettingsContext();

  if (!isPreviewActive || !isTripActive || panelOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 36,
        left: 12,
        right: 12,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(255,255,255,0.92)",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
        pointerEvents: "auto",
      }}
    >
      <input
        type="range"
        min={0}
        max={totalM || 1}
        step={1}
        value={progressM}
        style={{ flex: 1, cursor: "pointer" }}
        onPointerDown={pauseAutoAdvance}
        onPointerUp={() => { if (progressM < totalM) resumeAutoAdvance(); }}
        onChange={(e) => setProgressM(Number(e.target.value))}
      />
      <span style={{ fontSize: 12, color: "#444", whiteSpace: "nowrap", minWidth: 90, textAlign: "right" }}>
        {formatKm(progressM)} / {formatKm(totalM)}
      </span>
    </div>
  );
}
