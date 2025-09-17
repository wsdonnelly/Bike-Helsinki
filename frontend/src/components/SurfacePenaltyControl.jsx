import React from "react";

const clamp = (n, lo = 0, hi = 1000) => Math.min(hi, Math.max(lo, n));
const strengthText = (v) => (v <= 200 ? "Weak" : v <= 700 ? "Moderate" : "Strong");

export default function SurfacePenaltyControl({
  value = 0,
  onChange,   // (number) => void
  onApply,    // () => void
  min = 0,
  max = 1000,
  step = 1,
}) {
  const handleRange = (e) => onChange?.(clamp(+e.target.value, min, max));
  const handleNumber = (e) => {
    const raw = e.target.value;
    const v = Number.isFinite(+raw) ? +raw : 0;
    onChange?.(clamp(v, min, max));
  };

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
  const sliderLabels = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#666",
    marginTop: 6,
  };

  return (
    <div style={section}>
      <label htmlFor="penalty-range" style={sectionLabel}>
        Surface preference
      </label>

      <input
        id="penalty-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleRange}
        onPointerUp={onApply} // apply on mouse/touch/pen release
        style={{ width: "100%" }}
        list="penalty-ticks"
      />

      {/* Weak/Strong captions */}
      <div style={sliderLabels}>
        <span>Weak</span>
        <span>Strong</span>
      </div>

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
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleNumber}
          onBlur={onApply} // apply when leaving the field
          style={{
            width: 100,
            padding: "4px 6px",
            border: "1px solid #ddd",
            borderRadius: 6,
          }}
        />
        <div style={{ fontSize: 12, color: "#333", minWidth: 110, textAlign: "right" }}>
          {strengthText(value)} • {value} s/km
        </div>
      </div>
    </div>
  );
}
