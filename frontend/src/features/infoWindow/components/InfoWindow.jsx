import * as styles from "./InfoWindow.styles";


const LocateIcon = ({ size = 14, style }) => (
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
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
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
              <strong style={{ marginRight: 6 }}>Actively in development</strong> —
              a free tool to help you plan and follow routes that make the most
              of Helsinki's excellent bike infrastructure, beautiful and abundant
              trails, and nature.
              <br /><br />
              <strong>Recent work:</strong> navigation mode and follow-camera
              behavior.
              <br />
              <strong>Coming soon:</strong> a full rework of the OSM data
              pipeline for richer, more accurate routing going beyond surface type
              filtering to selecting routes by overall bike-friendliness and
              surface quality.
            </div>
            <h3 style={styles.sectionHeading}>How to get started</h3>
            <ol style={styles.list}>
              <li style={styles.listItem}>
                <strong>Click anywhere on the map to set your origin and
                destination</strong> — your route calculates automatically. You
                can also use the address search in the{" "}
                <strong>☰ control panel</strong>.
              </li>
              <li style={styles.listItem}>
                <strong>Edit points anytime</strong> by clicking the map again,
                dragging a marker, or updating the address search in the control
                panel.
              </li>
            </ol>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={styles.sectionHeading}>GPS & location</h3>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                A{" "}
                <strong>
                  <LocateIcon size={14} style={{ marginTop: -1 }} />
                </strong>{" "}
                locate button sits next to the start address field. Tap it to
                enable GPS — your position and accuracy radius appear on the
                map, and the start point locks to your current location.
              </li>
              <li style={styles.listItem}>
                With GPS active, press <strong>Start Trip</strong> in the
                control panel to enter navigation mode — the map follows your
                position and rotates to face your direction of travel.
              </li>
              <li style={styles.listItem}>
                Open the <strong>control panel</strong> during a trip to pause
                follow-camera and review your route. Closing it resumes
                following immediately.
              </li>
              <li style={styles.listItem}>
                Pan freely while navigating — the camera snaps back after a few
                seconds.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={styles.sectionHeading}>Customize your route</h3>
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
            <h3 style={styles.sectionHeading}>Route colors</h3>
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
