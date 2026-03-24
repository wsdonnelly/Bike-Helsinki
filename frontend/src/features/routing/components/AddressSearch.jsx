import React, { useEffect, useRef, useState } from "react";
import { useRoute } from "../RouteProvider";
import useNominatimSearch from "../hooks/useNominatimSearch";
import SearchField from "./SearchField";

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
  const [isOpen, setIsOpen] = useState(true);

  const containerRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    el.addEventListener("pointerdown", stop, true);
    return () => el.removeEventListener("pointerdown", stop, true);
  }, []);

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
    if (which === "start") startSearch.setQuery(hit.display_name);
    else endSearch.setQuery(hit.display_name);
    hideDropdowns();
  }

  async function setFromResultList(which, hit) {
    if (!hit) return;
    clearTimeout(blurTimeoutRef.current);
    await actions.setPointFromHit(hit, which);
    if (which === "start") startSearch.setQuery(hit.display_name);
    else endSearch.setQuery(hit.display_name);
    hideDropdowns();
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) hideDropdowns();
          setIsOpen((v) => !v);
        }}
        title={isOpen ? "Hide address search" : "Show address search"}
        style={{
          position: "absolute",
          top: 5,
          right: 10,
          zIndex: 1003,
          borderRadius: 10,
          border: "1px solid #e5e5e5",
          background: "#fff",
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

      {isOpen && (
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            top: 10,
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
          <div style={{ marginBottom: 10 }}>
            <SearchField
              query={startSearch.query}
              setQuery={startSearch.setQuery}
              results={startSearch.results}
              searching={startSearch.searching}
              showDropdown={activeField === "start"}
              onFocus={() => {
                clearTimeout(blurTimeoutRef.current);
                setActiveField("start");
              }}
              onBlur={hideDropdownsSoon}
              onSelect={(hit) => setFromResultList("start", hit)}
              onEnter={() => setFromQuery("start")}
              onEscape={hideDropdowns}
              onEmpty={() => {
                setSnappedStart(null);
                setActiveField(null);
              }}
              placeholder="Click map or search start address..."
              isSet={!!snappedStart}
              pointType="start"
              disabled={disabled}
            />
          </div>

          <SearchField
            query={endSearch.query}
            setQuery={endSearch.setQuery}
            results={endSearch.results}
            searching={endSearch.searching}
            showDropdown={activeField === "end"}
            onFocus={() => {
              clearTimeout(blurTimeoutRef.current);
              setActiveField("end");
            }}
            onBlur={hideDropdownsSoon}
            onSelect={(hit) => setFromResultList("end", hit)}
            onEnter={() => setFromQuery("end")}
            onEscape={hideDropdowns}
            onEmpty={() => {
              setSnappedEnd(null);
              setActiveField(null);
            }}
            placeholder="Click map or search end address..."
            isSet={!!snappedEnd}
            pointType="end"
            disabled={disabled}
          />
        </div>
      )}
    </>
  );
}
