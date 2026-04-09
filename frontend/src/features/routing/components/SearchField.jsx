import React from "react";

function LocateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

const dropdownStyle = {
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
};

const searchingStyle = {
  fontSize: 12,
  opacity: 0.7,
  padding: "8px 10px",
  fontStyle: "italic",
};

const resultItemStyle = {
  padding: "8px 10px",
  cursor: "pointer",
  borderBottom: "1px solid #eee",
  background: "white",
  transition: "background 0.15s",
};

function getInputStyle(pointType, isSet) {
  return {
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
    fontSize: 16,
    transition: "all 0.2s",
    outline: "none",
  };
}

export default function SearchField({
  query,
  setQuery,
  results,
  searching,
  showDropdown,
  onFocus,
  onBlur,
  onSelect,
  onEnter,
  onEscape,
  onEmpty,
  onLocate,
  locateActive,
  placeholder,
  isSet,
  pointType,
  disabled,
}) {
  return (
    <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "stretch" }}>
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          if (v.trim() === "") onEmpty?.();
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim()) {
            e.preventDefault();
            onEnter?.();
          }
          if (e.key === "Escape") onEscape?.();
        }}
        style={getInputStyle(pointType, isSet)}
        disabled={disabled}
        aria-disabled={disabled}
        aria-label={pointType === "start" ? "Start address" : "End address"}
      />
      {onLocate && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onLocate(); }}
          style={{
            border: "none", cursor: "pointer",
            padding: "0 8px",
            display: "flex", alignItems: "center", flexShrink: 0,
            borderRadius: 6,
            background: locateActive ? "#2196f3" : "transparent",
            color: locateActive ? "#fff" : "#2196f3",
            transition: "background 0.15s, color 0.15s",
          }}
          title={locateActive ? "Stop using current location" : "Use current location"}
          aria-label={locateActive ? "Stop using current location" : "Use current location"}
          aria-pressed={locateActive}
        >
          <LocateIcon />
        </button>
      )}
      {showDropdown && (results?.length > 0 || searching) && (
        <div style={dropdownStyle} role="listbox">
          {searching && <div style={searchingStyle}>Searching…</div>}
          {results?.map((hit) => (
            <div
              key={hit.place_id}
              role="option"
              aria-selected={false}
              style={resultItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(hit)}
              title={hit.display_name}
            >
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                {hit.display_name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
