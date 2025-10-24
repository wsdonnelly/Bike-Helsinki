import React from "react";

const InfoWindow = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  const HouseIcon = ({ size = 16, style }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M10 20v-4a2 2 0 0 1 4 0v4" />
    </svg>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 10000,
          pointerEvents: "auto",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Info Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-window-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(90vw, 500px)",
          maxHeight: "80vh",
          backgroundColor: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          zIndex: 10001,
          pointerEvents: "auto",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 24px 16px",
            borderBottom: "1px solid #f0f0f0",
            background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
            color: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2
              id="info-window-title"
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              Welcome To Bike-Helsinki Preview
            </h2>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            padding: 24,
            overflowY: "auto",
            flex: 1,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            {/* Banner */}
            <div
              style={{
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255, 87, 34, 0.10)", // soft amber
                color: "#6b4f00",
                border: "1px solid rgba(255, 193, 7, 0.35)",
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              <strong style={{ marginRight: 6 }}>Preview branch:</strong>
              This deploy includes the new Address Search features. Expect rough edges :)
              Also currently working on more geolocation features (track your location and follow routes)
              and a full reworking of the underlying algorithm. Stay tuned!
            </div>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 18,
                fontWeight: 600,
                color: "#333",
              }}
            >
              How to get started
            </h3>
            <ol
              style={{
                margin: 0,
                paddingLeft: 20,
                lineHeight: 1.6,
                color: "#555",
              }}
            >
              <li style={{ marginBottom: 8 }}>
                <strong>
                  Click the map or use the address search bar to set your origin
                  and destination.
                </strong>{" "}
                Your route will be calculated automatically.
              </li>

              <li style={{ marginBottom: 8 }}>
                <strong>Edit your origin and destination.</strong> Click again
                on the map, or use the address search, or drag an existing
                marker anywhere on the map!
              </li>

              <li style={{ marginBottom: 8 }}>
                <span>
                  Use the{" "}
                  <strong>
                    <HouseIcon size={16} style={{ marginTop: -1 }} />
                  </strong>{" "}
                  button to open/close the address search bar at the top of the
                  map.
                </span>
              </li>
            </ol>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 18,
                fontWeight: 600,
                color: "#333",
              }}
            >
              ⚙️ Customize your route
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                lineHeight: 1.6,
                color: "#555",
              }}
            >
              <li style={{ marginBottom: 8 }}>
                Use the <strong>control panel</strong> (☰ button) to adjust
                surface preferences
              </li>
              <li style={{ marginBottom: 8 }}>
                Filter by <strong>desired surface types</strong> (paved, gravel,
                dirt, etc.)
              </li>
              <li style={{ marginBottom: 8 }}>
                Adjust the <strong>surface preference slider</strong> to tell
                the router how much to avoid non-preferred surfaces by adding a
                time penalty (seconds per kilometer) to them. Set the slider to
                0 s/km to treat all surfaces equally; raise it to bias routing
                toward your selected surface types.
              </li>
              <li style={{ marginBottom: 8 }}>
                View detailed <strong>route statistics</strong> and distances
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 18,
                fontWeight: 600,
                color: "#333",
              }}
            >
              🚴 Route colors
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 20,
                    height: 4,
                    backgroundColor: "#007AFF",
                    borderRadius: 2,
                  }}
                />
                <span style={{ fontSize: 14, color: "#555" }}>
                  <strong>Blue</strong> - Preferred bike surfaces
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 20,
                    height: 4,
                    backgroundColor: "#FF7F0E",
                    borderRadius: 2,
                  }}
                />
                <span style={{ fontSize: 14, color: "#555" }}>
                  <strong>Orange</strong> - Non-preferred bike surfaces
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 20,
                    height: 4,
                    backgroundColor: "#7C3AED",
                    borderRadius: 2,
                    backgroundImage:
                      "repeating-linear-gradient(90deg, transparent, transparent 3px, white 3px, white 6px)",
                  }}
                />
                <span style={{ fontSize: 14, color: "#555" }}>
                  <strong>Purple</strong> - Walking sections
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f0f0f0",
            backgroundColor: "#fafafa",
            textAlign: "center",
          }}
        >
          <button
            onClick={onClose}
            style={{
              backgroundColor: "#007AFF",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "12px 24px",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 122, 255, 0.3)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#0056CC";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#007AFF";
              e.target.style.transform = "translateY(0)";
            }}
          >
            Got it, let's start! 🚀
          </button>
        </div>
      </div>
    </>
  );
};

export default InfoWindow;
