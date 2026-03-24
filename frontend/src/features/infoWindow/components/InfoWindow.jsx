import * as styles from "./InfoWindow.styles";

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

const InfoWindow = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-window-title"
        style={styles.dialog}
      >
        <div style={styles.header}>
          <div style={styles.headerRow}>
            <h2 id="info-window-title" style={styles.title}>
              Welcome To Bike-Helsinki Preview
            </h2>
          </div>
        </div>

        <div style={styles.content}>
          <div style={{ marginBottom: 24 }}>
            <div style={styles.banner}>
              <strong style={{ marginRight: 6 }}>Preview branch:</strong>
              This deploy includes new Address Search and geolocation features. Expect rough
              edges :)
            </div>
            <h3 style={styles.sectionHeading}>How to get started</h3>
            <ol style={styles.list}>
              <li style={styles.listItem}>
                <strong>
                  Click the map or use the address search bar to set your origin
                  and destination.
                </strong>{" "}
                Your route will be calculated automatically.
              </li>
              <li style={styles.listItem}>
                <strong>Edit your origin and destination.</strong> Click again
                on the map, or use the address search, or drag an existing
                marker anywhere on the map!
              </li>
              <li style={styles.listItem}>
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
            <h3 style={styles.sectionHeading}>⚙️ Customize your route</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                Use the <strong>control panel</strong> (☰ button) to adjust
                surface preferences
              </li>
              <li style={styles.listItem}>
                Filter by <strong>desired surface types</strong> (paved, gravel,
                dirt, etc.)
              </li>
              <li style={styles.listItem}>
                Adjust the <strong>surface preference slider</strong> to tell
                the router how much to avoid non-preferred surfaces by adding a
                time penalty (seconds per kilometer) to them. Set the slider to
                0 s/km to treat all surfaces equally; raise it to bias routing
                toward your selected surface types.
              </li>
              <li style={styles.listItem}>
                View detailed <strong>route statistics</strong> and distances
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={styles.sectionHeading}>🚴 Route colors</h3>
            <div style={styles.colorLegend}>
              <div style={styles.colorRow}>
                <div style={styles.colorSwatch("#007AFF")} />
                <span style={styles.colorLabel}>
                  <strong>Blue</strong> - Preferred bike surfaces
                </span>
              </div>
              <div style={styles.colorRow}>
                <div style={styles.colorSwatch("#FF7F0E")} />
                <span style={styles.colorLabel}>
                  <strong>Orange</strong> - Non-preferred bike surfaces
                </span>
              </div>
              <div style={styles.colorRow}>
                <div style={styles.colorSwatch("#7C3AED", true)} />
                <span style={styles.colorLabel}>
                  <strong>Purple</strong> - Walking sections
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button
            onClick={onClose}
            style={styles.closeBtn}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#0056CC";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#007AFF";
              e.target.style.transform = "translateY(0)";
            }}
          >
            Got it, let's start!
          </button>
        </div>
      </div>
    </>
  );
};

export default InfoWindow;
