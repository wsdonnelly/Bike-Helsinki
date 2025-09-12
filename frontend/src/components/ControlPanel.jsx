import React from "react";

// Bit flags must match injest/surfaceTypes.hpp
export const SurfaceBits = {
  SURF_PAVED: 1 << 0,
  SURF_ASPHALT: 1 << 1,
  SURF_CONCRETE: 1 << 2,
  SURF_PAVING_STONES: 1 << 3,
  SURF_SETT: 1 << 4,
  SURF_UNHEWN_COBBLESTONES: 1 << 5,
  SURF_COBBLESTONES: 1 << 6,
  SURF_BRICKS: 1 << 7,

  SURF_UNPAVED: 1 << 8,
  SURF_COMPACTED: 1 << 9,
  SURF_FINE_GRAVEL: 1 << 10,
  SURF_GRAVEL: 1 << 11,
  SURF_GROUND: 1 << 12,
  SURF_DIRT: 1 << 13,
  SURF_EARTH: 1 << 14,
  SURF_UNKNOWN: 1 << 15,
};

const GROUPS = [
  {
    title: "Paved surfaces",
    items: [
      ["PAVED", SurfaceBits.SURF_PAVED, "Generic paved"],
      ["ASPHALT", SurfaceBits.SURF_ASPHALT, "Asphalt"],
      ["CONCRETE", SurfaceBits.SURF_CONCRETE, "Concrete"],
      ["PAVING_STONES", SurfaceBits.SURF_PAVING_STONES, "Paving stones"],
      ["SETT", SurfaceBits.SURF_SETT, "Sett"],
      [
        "UNHEWN_COBBLESTONES",
        SurfaceBits.SURF_UNHEWN_COBBLESTONES,
        "Unhewn cobblestones",
      ],
      ["COBBLESTONES", SurfaceBits.SURF_COBBLESTONES, "Cobblestones"],
      ["BRICKS", SurfaceBits.SURF_BRICKS, "Bricks"],
    ],
  },
  {
    title: "Unpaved surfaces",
    items: [
      ["UNPAVED", SurfaceBits.SURF_UNPAVED, "Generic unpaved"],
      ["COMPACTED", SurfaceBits.SURF_COMPACTED, "Compacted"],
      ["FINE_GRAVEL", SurfaceBits.SURF_FINE_GRAVEL, "Fine gravel"],
      ["GRAVEL", SurfaceBits.SURF_GRAVEL, "Gravel"],
      ["GROUND", SurfaceBits.SURF_GROUND, "Ground"],
      ["DIRT", SurfaceBits.SURF_DIRT, "Dirt"],
      ["EARTH", SurfaceBits.SURF_EARTH, "Earth"],
    ],
  },
];

const groupMask = (title) =>
  (GROUPS.find((g) => g.title === title)?.items ?? []).reduce(
    (m, [, bit]) => m | bit,
    0
  );

const PAVED_BITS_MASK = groupMask("Paved surfaces");
const UNPAVED_BITS_MASK = groupMask("Unpaved surfaces");
const ALL_BITS_MASK = GROUPS.reduce(
  (acc, g) => acc | g.items.reduce((m, [, bit]) => m | bit, 0),
  0
);

// ---- helpers for formatting ----
const formatKm = (m) => {
  const km = (m || 0) / 1000;
  if (km === 0) return "0.0 km";
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
};
const formatDuration = (t) => {
  const total = Math.max(0, Math.floor(t ?? 0)); // clamp & int seconds
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

const clamp = (n, lo = 0, hi = 1000) => Math.min(hi, Math.max(lo, n));

const ControlPanel = ({
  surfaceMask,
  onToggleSurface,
  onSetSurfaceMask,
  onApply,
  onOpen,
  onClose,
  panelOpen,

  // slider props
  surfacePenaltyDraft = 0,
  onSetSurfacePenalty,

  // stats/flags
  totalDistanceM = 0,
  totalDurationS = 0,
  distanceBike = 0,
  distanceWalk = 0,
  hasSelection = false,
  hasRoute = false,
}) => {
  const applyBulk = (newMask) => {
    newMask |= SurfaceBits.SURF_UNKNOWN; // keep UNKNOWN for now
    onSetSurfaceMask?.(newMask);
  };

  const selectAll = () => applyBulk(ALL_BITS_MASK);
  const selectNone = () => applyBulk(0);
  const selectPaved = () => applyBulk(PAVED_BITS_MASK);
  const selectUnpaved = () => applyBulk(UNPAVED_BITS_MASK);

  const handleRange = (e) => {
    const v = clamp(+e.target.value);
    onSetSurfacePenalty?.(v);
  };
  const handleNumber = (e) => {
    const raw = e.target.value;
    // Guard NaN while editing; allow empty -> 0
    const v = clamp(Number.isFinite(+raw) ? +raw : 0);
    onSetSurfacePenalty?.(v);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {!panelOpen && (
        <button
          type="button"
          aria-label="Open surface filters"
          onClick={onOpen}
          style={toggleBtn}
        >
          ☰
        </button>
      )}

      {panelOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Surface filters"
          style={panel}
        >
          <div style={hdr}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>
              Surface Types
            </h2>
            <button type="button" onClick={onClose} style={btnSm}>
              Close
            </button>
            <button
              type="button"
              aria-label="Apply"
              onClick={() =>
                onApply({
                  mask: surfaceMask,
                  surfacePenaltySPerKm: surfacePenaltyDraft,
                })
              }
              style={{ ...btnSm, marginLeft: 6 }}
            >
              Apply
            </button>
          </div>

          {/* bulk buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={selectAll} style={btnSm}>
              All
            </button>
            <button type="button" onClick={selectNone} style={btnSm}>
              None
            </button>
            <button type="button" onClick={selectPaved} style={btnSm}>
              Paved
            </button>
            <button type="button" onClick={selectUnpaved} style={btnSm}>
              Unpaved
            </button>
          </div>

          {/* surface checkboxes */}
          {GROUPS.map((group) => (
            <fieldset key={group.title} style={fs}>
              <legend style={legend}>{group.title}</legend>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {group.items.map(([key, bit, label]) => {
                  const id = `surf-${key.toLowerCase()}`;
                  const checked = (surfaceMask & bit) !== 0;
                  return (
                    <li key={key} style={row}>
                      <label htmlFor={id} style={{ fontSize: 14 }}>
                        {label}
                      </label>
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleSurface(bit)}
                        aria-checked={checked}
                      />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}

          {/* Surface penalty slider (0–1000 s/km) */}
          <div style={section}>
            <label htmlFor="penalty-range" style={sectionLabel}>
              Surface penalty <span style={{ color: "#666" }}>(s/km)</span>
            </label>

            <input
              id="penalty-range"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={surfacePenaltyDraft}
              onChange={handleRange}
              style={{ width: "100%" }}
              aria-valuemin={0}
              aria-valuemax={1000}
              aria-valuenow={surfacePenaltyDraft}
              aria-label="Surface penalty in seconds per kilometer"
              list="penalty-ticks"
            />
            <datalist id="penalty-ticks">
              <option value="0" />
              <option value="250" />
              <option value="500" />
              <option value="750" />
              <option value="1000" />
            </datalist>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 8,
              }}
            >
              <div>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  value={surfacePenaltyDraft}
                  onChange={handleNumber}
                  style={{
                    width: 100,
                    padding: "4px 6px",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                  }}
                  aria-label="Surface penalty numeric input"
                />
              </div>
              <output
                htmlFor="penalty-range"
                style={{
                  fontSize: 12,
                  color: "#333",
                  minWidth: 60,
                  textAlign: "right",
                }}
              >
                {surfacePenaltyDraft} s/km
              </output>
            </div>
          </div>

          {/* ---- sticky bottom stats ---- */}
          <div style={statsBox}>
            {!hasSelection ? (
              <div style={{ fontSize: 12, color: "#666" }}>
                Pick two points on the map to compute a route.
              </div>
            ) : !hasRoute ? (
              <div style={noRouteBox} role="status" aria-live="polite">
                <strong>No route found</strong>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  Try adjusting surface filters or picking closer points.
                </div>
              </div>
            ) : (
              <>
                <div style={statsHeader}>Ride stats</div>
                <div style={statsGrid}>
                  <div>Duration</div>
                  <div style={statVal}>{formatDuration(totalDurationS)}</div>
                  <div>Distance</div>
                  <div style={statVal}>{formatKm(totalDistanceM)}</div>
                  <div>Bike</div>
                  <div style={statVal}>{formatKm(distanceBike)}</div>
                  <div>Walk</div>
                  <div style={statVal}>{formatKm(distanceWalk)}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// tiny style helpers
const toggleBtn = {
  position: "absolute",
  top: 80,
  left: 10,
  padding: "6px 10px",
  zIndex: 10000,
  border: "1px solid #ccc",
  borderRadius: 6,
  backgroundColor: "#fff",
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
  cursor: "pointer",
  pointerEvents: "auto",
};
const btnSm = {
  border: "1px solid #ddd",
  background: "#fff",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};
const panel = {
  position: "absolute",
  top: 0,
  left: 0,
  width: 300,
  height: "100%",
  backgroundColor: "#fff",
  boxShadow: "2px 0 5px rgba(0,0,0,0.2)",
  overflowY: "auto",
  padding: 16,
  pointerEvents: "auto",
};
const hdr = { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 };
const fs = {
  border: "1px solid #eee",
  borderRadius: 6,
  padding: 12,
  marginBottom: 12,
};
const legend = { fontWeight: 600, fontSize: 13, padding: "0 6px" };
const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
  borderBottom: "1px dashed #f1f1f1",
};

/* stats styles */
const statsBox = {
  position: "sticky",
  bottom: 0,
  left: 0,
  right: 0,
  background: "#fff",
  borderTop: "1px solid #eee",
  paddingTop: 10,
  paddingBottom: 12,
};
const statsHeader = { fontWeight: 700, fontSize: 13, marginBottom: 6 };
const statsGrid = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  rowGap: 6,
  columnGap: 12,
  fontSize: 13,
};
const statVal = { fontWeight: 600 };
const noRouteBox = {
  padding: 8,
  borderRadius: 6,
  background: "#fafafa",
  border: "1px solid #eee",
  fontSize: 13,
};

// small section styles
const section = {
  border: "1px solid #eee",
  borderRadius: 6,
  padding: 12,
  marginBottom: 12,
};
const sectionLabel = {
  display: "block",
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 8,
};

export default ControlPanel;
