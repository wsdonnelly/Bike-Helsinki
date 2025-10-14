import React, { useState } from "react";
import { useRoute } from "../RouteProvider";
import useNominatimSearch from "../hooks/useNominatimSearch";
import { formatAddress } from "../utils/formatAddress";


export default function AddressSearch() {
  const { cfg, snappedStart, snappedEnd, actions } = useRoute();
  const { query, setQuery, results, searching } = useNominatimSearch(
    actions.searchAddress
  );
  const [targetPoint, setTargetPoint] = useState("start"); // "start" or "end"
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");

  const disabled = !cfg;

  const handleAddClick = () => {
    actions.setPointFromAddress(query, targetPoint);

    // Save the address name
    if (targetPoint === "start") {
      setStartAddress(query);
    } else {
      setEndAddress(query);
    }

    console.log(`${targetPoint} address set to:`, query);
    setQuery(""); // Clear search after adding
  };

  const handleResultClick = (hit) => {
    actions.setPointFromHit(hit, targetPoint);
    const formatted = formatAddress(hit.display_name);

    // Save the address name
    if (targetPoint === "start") {
      setStartAddress(formatted);
    } else {
      setEndAddress(formatted);
    }

    console.log(`${targetPoint} address set to:`, formatted);
    setQuery(""); // Clear search after selecting
  };

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 1000,
        top: 12,
        left: 50,
        right: 12,
        maxWidth: 520,
        background: "white",
        borderRadius: 8,
        padding: 8,
        boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
      }}
    >
      {/* Point selector buttons */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => setTargetPoint("start")}
          disabled={disabled}
          style={{
            flex: 1,
            padding: "6px 12px",
            border: "2px solid",
            borderColor: targetPoint === "start" ? "#2ecc71" : "#e0e0e0",
            borderRadius: 6,
            background: targetPoint === "start" ? "#2ecc7120" : "white",
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: targetPoint === "start" ? 600 : 400,
            fontSize: 13,
          }}
        >
          🟢 Start {snappedStart && "✓"}
        </button>
        <button
          onClick={() => setTargetPoint("end")}
          disabled={disabled}
          style={{
            flex: 1,
            padding: "6px 12px",
            border: "2px solid",
            borderColor: targetPoint === "end" ? "#e74c3c" : "#e0e0e0",
            borderRadius: 6,
            background: targetPoint === "end" ? "#e74c3c20" : "white",
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: targetPoint === "end" ? 600 : 400,
            fontSize: 13,
          }}
        >
          🔴 End {snappedEnd && "✓"}
        </button>
      </div>

      {/* Search input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder={`Search ${targetPoint} address in Helsinki…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              handleAddClick();
            }
          }}
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 14,
          }}
          disabled={disabled}
        />
        <button
          onClick={handleAddClick}
          disabled={disabled || !query.trim()}
          style={{
            padding: "8px 16px",
            border: "none",
            borderRadius: 6,
            background: disabled || !query.trim() ? "#ccc" : "#007AFF",
            color: "white",
            cursor: disabled || !query.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Set {targetPoint === "start" ? "Start" : "End"}
        </button>
      </div>

      {/* Results dropdown */}
      {!!results.length && (
        <div
          style={{
            marginTop: 6,
            maxHeight: 220,
            overflow: "auto",
            border: "1px solid #eee",
            borderRadius: 6,
            background: "#fafafa",
          }}
        >
          {searching && (
            <div
              style={{
                fontSize: 12,
                opacity: 0.7,
                padding: "8px 10px",
                fontStyle: "italic",
              }}
            >
              Searching…
            </div>
          )}
          {results.map((hit) => (
            <div
              key={hit.place_id}
              style={{
                padding: "8px 10px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
                background: "white",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f0f0f0")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              onClick={() => handleResultClick(hit)}
              title={hit.display_name}
            >
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                {/* {hit.display_name.split(",")[0]} */}
                {formatAddress(hit.display_name)}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {hit.display_name.split(",").slice(1).join(",")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
