import React, { useState } from "react";
import { useRouteSettingsContext } from "../context/RouteSettingsContext";

const STREET_ATTRIBUTION = "© OpenMapTiles © OpenStreetMap contributors";
const SAT_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

export default function MapAttribution() {
  const [open, setOpen] = useState(false);
  const { isSatView } = useRouteSettingsContext();
  const text = isSatView ? SAT_ATTRIBUTION : STREET_ATTRIBUTION;

  return (
    <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Map attribution"
          aria-expanded={open}
          style={{
            border: "1px solid #ccc",
            borderRadius: "50%",
            width: 20,
            height: 20,
            fontSize: 11,
            cursor: "pointer",
            background: open ? "#e3f2fd" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            padding: 0,
          }}
        >
          i
        </button>
        {open && (
          <p style={{ fontSize: 10, color: "#666", margin: 0, lineHeight: 1.4 }}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
