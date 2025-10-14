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
