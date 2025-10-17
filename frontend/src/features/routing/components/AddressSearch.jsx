import React, { useEffect, useRef, useState } from "react";
import { useRoute } from "../RouteProvider";
import useNominatimSearch from "../hooks/useNominatimSearch";

export default function AddressSearch() {
  const { cfg, snappedStart, snappedEnd, actions } = useRoute();
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
    if (snappedEnd?.address) {
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

  const btnStyle = (color, isDisabled) => ({
    padding: "8px 14px",
    border: "none",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 14,
    color: "#fff",
    background: isDisabled ? "#c7c7c7" : color,
    cursor: isDisabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  });

  const inputWrapStyle = {
    position: "relative",
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  };

  const inputStyle = {
    flex: 1,
    padding: "8px 10px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 14,
  };

  function Results({ which }) {
    const isStart = which === "start";
    const { results, searching } = isStart ? startSearch : endSearch;

    console.log(`Results(${which}):`, {
      activeField,
      resultsCount: results?.length,
      searching,
      shouldShow: activeField === which,
    });

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
        // Remove this - it's too broad:
        // onMouseDown={(e) => e.preventDefault()}
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
        {results?.map((hit) => (
          <div
            key={hit.place_id}
            style={{
              padding: "8px 10px",
              cursor: "pointer",
              borderBottom: "1px solid #eee",
              background: "white",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            onMouseDown={(e) => {
              e.preventDefault(); // Only prevent on the result item itself
            }}
            onClick={() => setFromResultList(which, hit)}
            title={hit.display_name}
          >
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
              {hit.display_name.split(",")[0]}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {hit.display_name.split(",").slice(1).join(",")}
            </div>
          </div>
        ))}
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
            placeholder="Search START address..."
            value={startSearch.query}
            onChange={(e) => {
              clearTimeout(blurTimeoutRef.current);
              startSearch.setQuery(e.target.value);
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
            style={inputStyle}
            disabled={disabled}
            aria-disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setFromQuery("start")}
            disabled={disabled || !startSearch.query.trim()}
            style={btnStyle("#2ecc71", disabled || !startSearch.query.trim())}
            title={snappedStart ? "Update Start" : "Set Start"}
          >
            {snappedStart ? "Update" : "Set"} Start
          </button>
          <Results which="start" />
        </div>
      </div>

      {/* END field */}
      <div>
        <div style={inputWrapStyle}>
          <input
            placeholder="Search END address..."
            value={endSearch.query}
            onChange={(e) => {
              console.log("END onChange:", e.target.value);
              clearTimeout(blurTimeoutRef.current);
              endSearch.setQuery(e.target.value);
            }}
            onFocus={() => {
              console.log("END onFocus triggered");
              clearTimeout(blurTimeoutRef.current);
              setActiveField("end");
            }}
            onBlur={() => {
              console.log("END onBlur triggered");
              hideDropdownsSoon();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && endSearch.query.trim()) {
                e.preventDefault();
                setFromQuery("end");
              }
              if (e.key === "Escape") hideDropdowns();
            }}
            style={inputStyle}
            disabled={disabled}
            aria-disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setFromQuery("end")}
            disabled={disabled || !endSearch.query.trim()}
            style={btnStyle("#2ecc71", disabled || !endSearch.query.trim())}
            title={snappedEnd ? "Update End" : "Set End"}
          >
            {snappedEnd ? "Update" : "Set"} End
          </button>
          <Results which="end" />
        </div>
      </div>
    </div>
  );
}
