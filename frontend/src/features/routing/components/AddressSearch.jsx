import React, { useEffect, useRef, useState } from "react";
import { useRoute } from "../RouteProvider";
import useGeocoding from "../hooks/useGeocoding";
import SearchField from "./SearchField";
import { useGeolocation } from "@/features/geolocation";

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
  const { isLocating, position, startLocating, stopLocating } = useGeolocation();
  const pendingLocateRef = useRef(false);

  const handleLocateStart = () => {
    if (isLocating) {
      stopLocating();
      return;
    }
    startLocating();
    if (position) {
      actions.setPointFromCoords(position.lat, position.lon, "start");
    } else {
      pendingLocateRef.current = true;
    }
  };

  useEffect(() => {
    if (pendingLocateRef.current && position) {
      pendingLocateRef.current = false;
      actions.setPointFromCoords(position.lat, position.lon, "start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const startSearch = useGeocoding(actions.searchAddress);
  const endSearch = useGeocoding(actions.searchAddress);

  const [activeField, setActiveField] = useState(null);

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
    if (!snappedStart) startSearch.setQuery("");
    else if (snappedStart.address) startSearch.setQuery(snappedStart.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snappedStart]);
  useEffect(() => {
    if (!snappedEnd) endSearch.setQuery("");
    else if (snappedEnd?.address) endSearch.setQuery(snappedEnd.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div ref={containerRef} style={{ width: "100%" }} aria-label="Address search">
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
          }}
          onLocate={handleLocateStart}
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
        }}
        placeholder="Click map or search end address..."
        isSet={!!snappedEnd}
        pointType="end"
        disabled={disabled}
      />
    </div>
  );
}
