import React, { useEffect, useRef, useState } from "react";
import { useRoute } from "../RouteProvider";
import useNominatimSearch from "../hooks/useNominatimSearch";
// import { formatAddress } from "../utils/formatAddress";

export default function AddressSearch() {
  const {
    cfg,
    snappedStart,
    setSnappedStart,
    snappedEnd,
    setSnappedEnd,
    actions,
  } = useRoute();
  const disabled = !cfg;

  const startSearch = useNominatimSearch(actions.searchAddress);
  const endSearch = useNominatimSearch(actions.searchAddress);

  const [activeField, setActiveField] = useState(null);

  const containerRef = useRef(null);
  const blurTimeoutRef = useRef(null); // Track blur timeout

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    el.addEventListener("pointerdown", stop, true);
    return () => el.removeEventListener("pointerdown", stop, true);
  }, []);

  // Sync the input with the snapped point's address
  useEffect(() => {
    if (snappedStart?.address) {
      startSearch.setQuery(snappedStart.address);
    }
  }, [snappedStart]); // When snappedStart changes, update the input

  useEffect(() => {
    if (!snappedEnd){
      endSearch.setQuery("");
    }
    else if (snappedEnd?.address) {
      endSearch.setQuery(snappedEnd.address);
    }
  }, [snappedEnd]); // When snappedEnd changes, update the input

  // Improved hide function
  const hideDropdowns = () => {
    clearTimeout(blurTimeoutRef.current);
    setActiveField(null);
  };

  const hideDropdownsSoon = () => {
    clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => setActiveField(null), 150);
  };

  // 1) Select by using the current query's top match
  async function setFromQuery(which) {
    const q = which === "start" ? startSearch.query : endSearch.query;
    if (!q.trim()) return;

    const res = await actions.setPointFromAddress(q, which);
    const hit = res?.hit;
    if (!hit) return;

    const label = hit.display_name;
    if (which === "start") {
      startSearch.setQuery(label);
    } else {
      endSearch.setQuery(label);
    }
    hideDropdowns(); // Immediate hide
  }

  // 2) Select by clicking a result row
  async function setFromResultList(which, hit) {
    if (!hit) return;

    clearTimeout(blurTimeoutRef.current); // Cancel any pending hide

    await actions.setPointFromHit(hit, which);

    const label = hit.display_name;
    if (which === "start") {
      startSearch.setQuery(label);
    } else {
      endSearch.setQuery(label);
    }

    hideDropdowns(); // Immediate hide
  }

  const inputWrapStyle = {
    position: "relative",
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  };

  const getInputStyle = (pointType, isSet) => ({
    flex: 1,
    padding: "8px 10px",
    border: "2px solid",
    borderColor:
      pointType === "start"
        ? isSet
          ? "#2ecc71"
          : "rgba(46, 204, 113, 0.3)"
        : isSet
        ? "#e74c3c"
        : "rgba(231, 76, 60, 0.3)",
    borderRadius: 6,
    fontSize: 14,
    transition: "all 0.2s",
    outline: "none",
  });

  function Results({ which }) {
    const isStart = which === "start";
    const { results, searching } = isStart ? startSearch : endSearch;
    if (activeField !== which) return null;
    if (!results?.length && !searching) return null;

    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "calc(100% + 6px)",
          maxHeight: 220,
          overflow: "auto",
          border: "1px solid #eee",
          borderRadius: 6,
          background: "#fafafa",
          zIndex: 10,
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
        {results?.map((hit) => {
          // const formatted = formatAddress(hit);
          const formatted = hit.display_name;
          return (
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
              onMouseDown={(e) => {
                e.preventDefault(); // Only prevent on the result item itself
              }}
              onClick={() => setFromResultList(which, hit)}
              title={hit.display_name}
            >
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                {formatted}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>{formatted}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(92vw, 560px)",
        background: "white",
        borderRadius: 10,
        padding: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        zIndex: 1002,
      }}
      aria-label="Address search"
    >
      {/* START field */}
      <div style={{ marginBottom: 10 }}>
        <div style={inputWrapStyle}>
          <input
            placeholder="Click map or search start address..."
            value={startSearch.query}
            onChange={(e) => {
              clearTimeout(blurTimeoutRef.current);
              const v = e.target.value;
              startSearch.setQuery(v);
              if (v.trim() === "") {
                // clears previous polyline route
                setSnappedStart(null);
                setActiveField(null); // optional: close dropdown
              }
            }}
            onFocus={() => {
              clearTimeout(blurTimeoutRef.current);
              setActiveField("start");
            }}
            onBlur={hideDropdownsSoon}
            onKeyDown={(e) => {
              if (e.key === "Enter" && startSearch.query.trim()) {
                e.preventDefault();
                setFromQuery("start");
              }
              if (e.key === "Escape") hideDropdowns();
            }}
            style={getInputStyle("start", !!snappedStart)}
            disabled={disabled}
            aria-disabled={disabled}
          />
          <Results which="start" />
        </div>
      </div>

      {/* END field */}
      <div>
        <div style={inputWrapStyle}>
          <input
            placeholder="Click map or search end address..."
            value={endSearch.query}
            onChange={(e) => {
              clearTimeout(blurTimeoutRef.current);
              const v = e.target.value;
              endSearch.setQuery(v);
              if (v.trim() === "") {
                setSnappedEnd(null); // <-- clear
                setActiveField(null); // optional: close dropdown
              }
            }}
            onFocus={() => {
              clearTimeout(blurTimeoutRef.current);
              setActiveField("end");
            }}
            onBlur={hideDropdownsSoon}
            onKeyDown={(e) => {
              if (e.key === "Enter" && endSearch.query.trim()) {
                e.preventDefault();
                setFromQuery("end");
              }
              if (e.key === "Escape") hideDropdowns();
            }}
            style={getInputStyle("end", !!snappedEnd)}
            disabled={disabled}
            aria-disabled={disabled}
          />
          <Results which="end" />
        </div>
      </div>
    </div>
  );
}
