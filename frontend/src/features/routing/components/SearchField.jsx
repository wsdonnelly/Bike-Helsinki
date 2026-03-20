import React from "react";

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
      />
      {showDropdown && (results?.length > 0 || searching) && (
        <div style={dropdownStyle}>
          {searching && <div style={searchingStyle}>Searching…</div>}
          {results?.map((hit) => (
            <div
              key={hit.place_id}
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
