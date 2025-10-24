import React, { useEffect, useRef, useState } from "react";
import { useRoute } from "../RouteProvider";
import useNominatimSearch from "../hooks/useNominatimSearch";

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
  const [isOpen, setIsOpen] = useState(true); // ← NEW

  const containerRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    el.addEventListener("pointerdown", stop, true);
    return () => el.removeEventListener("pointerdown", stop, true);
  }, []);

  // Sync inputs from snapped points
  useEffect(() => {
    if (snappedStart?.address) startSearch.setQuery(snappedStart.address);
  }, [snappedStart]);
  useEffect(() => {
    if (!snappedEnd) endSearch.setQuery("");
    else if (snappedEnd?.address) endSearch.setQuery(snappedEnd.address);
  }, [snappedEnd]);

  const hideDropdowns = () => {
    clearTimeout(blurTimeoutRef.current);
    setActiveField(null);
  };
  const hideDropdownsSoon = () => {
    clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => setActiveField(null), 150);
  };

  async function setFromQuery(which) {
    const q = which === "start" ? startSearch.query : endSearch.query;
    if (!q.trim()) return;
    const res = await actions.setPointFromAddress(q, which);
    const hit = res?.hit;
    if (!hit) return;
    const label = hit.display_name;
    if (which === "start") startSearch.setQuery(label);
    else endSearch.setQuery(label);
    hideDropdowns();
  }

  async function setFromResultList(which, hit) {
    if (!hit) return;
    clearTimeout(blurTimeoutRef.current);
    await actions.setPointFromHit(hit, which);
    const label = hit.display_name;
    if (which === "start") startSearch.setQuery(label);
    else endSearch.setQuery(label);
    hideDropdowns();
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
          const address = hit.display_name;
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setFromResultList(which, hit)}
              title={hit.display_name}
            >
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                {address}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>{address}</div>
            </div>
          );
        })}
      </div>
    );
  }

  const ToggleButton = ({ open, onToggle }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // don't let map get the click
        if (open) hideDropdowns(); // closing → hide any results
        onToggle();
      }}
      title={open ? "Hide address search" : "Show address search"}
      style={{
        position: "absolute",
        top: 20,
        right: 10,
        zIndex: 1003,
        // width: 40,
        // height: 40,
        borderRadius: 10,
        border: "1px solid #e5e5e5",
        background: open ? "#fff" : "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5 10.5V20h14v-9.5" />
        <path d="M10 20v-4a2 2 0 0 1 4 0v4" />
      </svg>
    </button>
  );

  return (
    <>
      {/* Toggle is independent of panel visibility */}
      <ToggleButton open={isOpen} onToggle={() => setIsOpen((v) => !v)} />

      {!isOpen ? null : (
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
          {/* Panel header with inline close (optional) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <strong style={{ fontSize: 12, opacity: 0.8 }}>
              Address search
            </strong>
            <button
              type="button"
              onClick={() => {
                hideDropdowns();
                setIsOpen(false);
              }}
              style={{
                border: "1px solid #eee",
                background: "#fff",
                borderRadius: 8,
                padding: "4px 8px",
                fontSize: 12,
                cursor: "pointer",
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Hide"
            >
              Close
            </button>
          </div>

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
                    setSnappedStart(null);
                    setActiveField(null);
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
                    setSnappedEnd(null);
                    setActiveField(null);
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
      )}
    </>
  );
}
