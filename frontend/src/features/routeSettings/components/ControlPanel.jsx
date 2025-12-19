import React, { useState } from "react";
import SurfacePenaltyControl from "./SurfacePenaltyControl";
import RideStats from "./RideStats";
import SurfaceCheckboxGroup from "./SurfaceCheckboxGroup";
import BulkActions from "./BulkActions";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { useDraggableSheet } from "../hooks/useDraggableSheet";
import {
  SurfaceBits,
  SURFACE_GROUPS,
  PAVED_BITS_MASK,
  UNPAVED_BITS_MASK,
  ALL_BITS_MASK,
} from "../constants/surfaceTypes";
import * as styles from "./ControlPanel.styles";

// Satellite/Globe icon as a reusable component
const GlobeIcon = () => (
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
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20z" />
  </svg>
);

const ControlPanel = ({
  surfaceMask,
  onToggleSurface,
  onSetSurfaceMask,
  onApply,
  onOpen,
  onClose,
  panelOpen,
  surfacePenaltyDraft = 0,
  onSetSurfacePenalty,
  totalDistanceM = 0,
  totalDurationS = 0,
  distanceBikePreferred = 0,
  distanceBikeNonPreferred = 0,
  distanceWalk = 0,
  hasSelection = false,
  hasRoute = false,
  isSatView = false,
  onToggleSatView,
}) => {
  const isMobile = useIsMobile("(max-width: 640px)");
  const [activeTab, setActiveTab] = useState("filters");

  const { sheetOffset, draggingRef, startDrag, onDragMove, endDrag } =
    useDraggableSheet(panelOpen);

  const applyBulk = (newMask) => {
    newMask |= SurfaceBits.SURF_UNKNOWN;
    onSetSurfaceMask?.(newMask);
  };

  const selectAll = () => applyBulk(ALL_BITS_MASK);
  const selectNone = () => applyBulk(0);
  const selectPaved = () => applyBulk(PAVED_BITS_MASK);
  const selectUnpaved = () => applyBulk(UNPAVED_BITS_MASK);

  const commitApply = () =>
    onApply?.({
      mask: surfaceMask,
      surfacePenaltySPerKm: Number(surfacePenaltyDraft),
    });

  // Desktop version
  if (!isMobile) {
    return (
      <div style={styles.containerStyle}>
        {!panelOpen && (
          <button
            type="button"
            aria-label="Open surface filters"
            onClick={onOpen}
            style={styles.toggleBtn}
          >
            ☰
          </button>
        )}

        {panelOpen && (
          <div
            role="dialog"
            aria-modal="false"
            aria-label="Surface filters"
            style={styles.panel}
          >
            <div style={styles.hdr}>
              <h2 style={styles.titleStyle}>Surface Types</h2>

              {/* Satellite toggle button */}
              <button
                type="button"
                onClick={onToggleSatView}
                style={{
                  ...styles.btnSm,
                  marginLeft: 'auto',
                  marginRight: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 10px',
                  backgroundColor: isSatView ? '#e3f2fd' : '#fff',
                  border: isSatView ? '1px solid #2196f3' : '1px solid #ddd',
                }}
                aria-label={isSatView ? "Switch to map view" : "Switch to satellite view"}
                title={isSatView ? "Switch to map view" : "Switch to satellite view"}
              >
                <GlobeIcon />
              </button>

              <button type="button" onClick={onClose} style={styles.btnSm}>
                Close
              </button>

              <button
                type="button"
                aria-label="Apply"
                onClick={commitApply}
                style={styles.applyBtn}
              >
                Apply
              </button>
            </div>

            <BulkActions
              onSelectAll={selectAll}
              onSelectNone={selectNone}
              onSelectPaved={selectPaved}
              onSelectUnpaved={selectUnpaved}
            />

            {SURFACE_GROUPS.map((group) => (
              <SurfaceCheckboxGroup
                key={group.title}
                group={group}
                surfaceMask={surfaceMask}
                onToggleSurface={onToggleSurface}
              />
            ))}

            <div style={styles.stickyTray}>
              <SurfacePenaltyControl
                value={surfacePenaltyDraft}
                onChange={onSetSurfacePenalty}
                onApply={commitApply}
              />
              <RideStats
                sticky={false}
                hasSelection={hasSelection}
                hasRoute={hasRoute}
                totalDistanceM={totalDistanceM}
                totalDurationS={totalDurationS}
                distanceBikePreferred={distanceBikePreferred}
                distanceBikeNonPreferred={distanceBikeNonPreferred}
                distanceWalk={distanceWalk}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mobile version
  return (
    <>
      {!panelOpen && (
        <button
          type="button"
          aria-label="Open surface filters"
          onClick={onOpen}
          style={styles.mobileToggleBtn}
        >
          ☰
        </button>
      )}

      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Surface filters"
          style={{
            ...styles.mobileSheet,
            transform: `translateY(${sheetOffset}px)`,
            transition: draggingRef.current ? "none" : "transform .2s ease",
          }}
          onPointerMove={onDragMove}
          onPointerUp={() => endDrag(onClose)}
          onPointerCancel={() => endDrag(onClose)}
          onTouchMove={onDragMove}
          onTouchEnd={() => endDrag(onClose)}
          onTouchCancel={() => endDrag(onClose)}
        >
          <div
            style={styles.handleArea}
            onPointerDown={startDrag}
            onTouchStart={startDrag}
          >
            <div style={styles.handleBar} />
          </div>

          <div
            style={styles.mobileHdr}
            onPointerDown={startDrag}
            onTouchStart={startDrag}
          >
            <h2 style={styles.titleStyle}>Route Options</h2>

            {/* Satellite toggle button for mobile */}
            <button
              type="button"
              onClick={onToggleSatView}
              style={{
                ...styles.btnSm,
                marginLeft: 'auto',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 10px',
                backgroundColor: isSatView ? '#e3f2fd' : '#fff',
                border: isSatView ? '1px solid #2196f3' : '1px solid #ddd',
              }}
              aria-label={isSatView ? "Switch to map view" : "Switch to satellite view"}
              title={isSatView ? "Switch to map view" : "Switch to satellite view"}
            >
              <GlobeIcon />
            </button>

            <button type="button" onClick={onClose} style={styles.btnSm}>
              Close
            </button>

            {activeTab === "filters" && (
              <button
                type="button"
                onClick={() => {
                  commitApply();
                  setActiveTab("stats");
                }}
                style={styles.applyBtn}
              >
                Apply
              </button>
            )}
          </div>

          <div style={styles.tabsContainer}>
            <button
              onClick={() => setActiveTab("filters")}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === "filters" ? "#f0f0f0" : "#fff",
                fontWeight: activeTab === "filters" ? 600 : 400,
              }}
            >
              Filters
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === "stats" ? "#f0f0f0" : "#fff",
                fontWeight: activeTab === "stats" ? 600 : 400,
              }}
            >
              Stats
            </button>
          </div>

          {activeTab === "filters" && (
            <>
              <BulkActions
                onSelectAll={selectAll}
                onSelectNone={selectNone}
                onSelectPaved={selectPaved}
                onSelectUnpaved={selectUnpaved}
              />

              {SURFACE_GROUPS.map((group) => (
                <SurfaceCheckboxGroup
                  key={group.title}
                  group={group}
                  surfaceMask={surfaceMask}
                  onToggleSurface={onToggleSurface}
                />
              ))}
            </>
          )}

          {activeTab === "stats" && (
            <div>
              <SurfacePenaltyControl
                value={surfacePenaltyDraft}
                onChange={onSetSurfacePenalty}
                onApply={commitApply}
              />
              <RideStats
                sticky={false}
                hasSelection={hasSelection}
                hasRoute={hasRoute}
                totalDistanceM={totalDistanceM}
                totalDurationS={totalDurationS}
                distanceBikePreferred={distanceBikePreferred}
                distanceBikeNonPreferred={distanceBikeNonPreferred}
                distanceWalk={distanceWalk}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ControlPanel;