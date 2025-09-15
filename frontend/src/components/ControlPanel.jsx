import React from "react";
import SurfacePenaltyControl from "./SurfacePenaltyControl";
import RideStats from "./RideStats";

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

const ControlPanel = ({
  surfaceMask,
  onToggleSurface,
  onSetSurfaceMask,

  // Apply captured by this component (calls App.applySettings)
  onApply,

  // open/close
  onOpen,
  onClose,
  panelOpen,

  // slider (draft stored in App)
  surfacePenaltyDraft = 0,
  onSetSurfacePenalty,

  // stats/flags
  totalDistanceM = 0,
  totalDurationS = 0,
  distanceBikePreferred = 0,
  distanceBikeNonPreferred = 0,
  distanceWalk = 0,
  hasSelection = false,
  hasRoute = false,

  // colors (match map)
  colorBikePreferred,
  colorBikeNonPreferred,
  colorWalk,
}) => {
  const applyBulk = (newMask) => {
    newMask |= SurfaceBits.SURF_UNKNOWN;
    onSetSurfaceMask?.(newMask);
  };

  const selectAll = () => applyBulk(ALL_BITS_MASK);
  const selectNone = () => applyBulk(0);
  const selectPaved = () => applyBulk(PAVED_BITS_MASK);
  const selectUnpaved = () => applyBulk(UNPAVED_BITS_MASK);

  // call App.applySettings with the latest draft values
  const commitApply = () =>
    onApply?.({
      mask: surfaceMask,
      surfacePenaltySPerKm: Number(surfacePenaltyDraft),
    });

  const stickyTray = {
    position: "sticky",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    borderTop: "1px solid #eee",
    /* give it a tiny elevation so it feels like a footer */
    boxShadow: "0 -2px 6px rgba(0,0,0,0.05)",
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
            onClick={commitApply}
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

        {/* sticky tray: slider above stats */}
        <div style={stickyTray}>
          <SurfacePenaltyControl
            value={surfacePenaltyDraft}
            onChange={onSetSurfacePenalty}
            onApply={commitApply}
          />
          <RideStats
            sticky={false} // tray handles stickiness
            hasSelection={hasSelection}
            hasRoute={hasRoute}
            totalDistanceM={totalDistanceM}
            totalDurationS={totalDurationS}
            distanceBikePreferred={distanceBikePreferred}
            distanceBikeNonPreferred={distanceBikeNonPreferred}
            distanceWalk={distanceWalk}
            colorBikePreferred={colorBikePreferred}
            colorBikeNonPreferred={colorBikeNonPreferred}
            colorWalk={colorWalk}
          />
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
  width: "min(92vw, 320px)",
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

export default ControlPanel;
