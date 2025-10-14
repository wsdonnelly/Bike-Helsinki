import React from "react";
import { useRoute } from "../RouteProvider";
import useNominatimSearch from "../hooks/useNominatimSearch";

export default function AddressSearch() {
  const { cfg, snappedStart, actions } = useRoute();
  const { query, setQuery, results, searching } = useNominatimSearch(
    actions.searchAddress
  );

  const disabled = !cfg;

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
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Search address in Helsinki…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: "8px 10px" }}
          disabled={disabled}
        />
        <button
          onClick={() =>
            actions.setPointFromAddress(query, !snappedStart ? "start" : "end")
          }
          disabled={disabled || !query.trim()}
        >
          Add
        </button>
      </div>

      {!!results.length && (
        <div style={{ marginTop: 6, maxHeight: 220, overflow: "auto" }}>
          {searching && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Searching…</div>
          )}
          {results.map((hit) => (
            <div
              key={hit.place_id}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                border: "1px solid #eee",
                marginTop: 4,
              }}
              onClick={() =>
                actions.setPointFromHit(hit, !snappedStart ? "start" : "end")
              }
              title={hit.display_name}
            >
              {hit.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
