import React from "react";

const clamp = (n, lo = 0, hi = 1000) => Math.min(hi, Math.max(lo, n));

export default function SurfacePenaltyControl({
  value = 0,
  onChange,         // (number) => void  (updates draft in App)
  onApply,          // () => void        (calls App.applySettings via parent)
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

  return (
    <div style={section}>
      <label htmlFor="penalty-range" style={sectionLabel}>
        Surface penalty <span style={{ color: "#666" }}>(s/km)</span>
      </label>

      <input
        id="penalty-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleRange}
        onPointerUp={onApply}       // apply on mouse/touch/pen release
        style={{ width: "100%" }}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleNumber}
          onBlur={onApply}         // optional: apply when leaving the field
          style={{ width: 100, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 6 }}
          aria-label="Surface penalty numeric input"
        />
        <output htmlFor="penalty-range" style={{ fontSize: 12, color: "#333", minWidth: 60, textAlign: "right" }}>
          {value} s/km
        </output>
      </div>
    </div>
  );
}
