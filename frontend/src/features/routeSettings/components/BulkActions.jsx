import React from "react";

export default function BulkActions({
  onSelectAll,
  onSelectNone,
  onSelectPaved,
  onSelectUnpaved,
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <button type="button" onClick={onSelectAll} style={btnSm}>
        All
      </button>
      <button type="button" onClick={onSelectNone} style={btnSm}>
        None
      </button>
      <button type="button" onClick={onSelectPaved} style={btnSm}>
        Paved
      </button>
      <button type="button" onClick={onSelectUnpaved} style={btnSm}>
        Unpaved
      </button>
    </div>
  );
}

const btnSm = {
  border: "1px solid #ddd",
  background: "#fff",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};
