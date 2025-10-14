import React from "react";

export default function SurfaceCheckboxGroup({
  group,
  surfaceMask,
  onToggleSurface,
}) {
  return (
    <fieldset style={fs}>
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
  );
}

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
