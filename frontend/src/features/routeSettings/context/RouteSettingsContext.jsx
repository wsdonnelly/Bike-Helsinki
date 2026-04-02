import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { useRoute } from "@/features/routing";
import { clamp, MAX_PENALTY, DEFAULT_MASK } from "@/shared";

const Ctx = createContext(null);
export const useRouteSettingsContext = () => useContext(Ctx);

export function RouteSettingsProvider({ children }) {
  const { settings } = useRoute();

  const [panelOpen, setPanelOpen] = useState(false);
  const [routeFitTick, setRouteFitTick] = useState(0);
  const triggerRouteFit = () => setRouteFitTick((n) => n + 1);
  const sheetHeightRef = useRef(0);
  const sheetOffsetRef = useRef(0);
  const setSheetHeight = useCallback((h) => {
    sheetHeightRef.current = h;
  }, []);
  const setSheetOffset = useCallback((offset) => {
    sheetOffsetRef.current = offset;
  }, []);
  const getSheetVisibleHeight = useCallback(
    () => Math.max(0, sheetHeightRef.current - sheetOffsetRef.current),
    []
  );
  const [draftMask, setDraftMask] = useState(settings.appliedMask);
  const [draftPenalty, setDraftPenalty] = useState(settings.appliedPenalty);

  const [isSatView, setIsSatView] = useState(() => {
    const saved = localStorage.getItem("satelliteView");
    return saved === "true";
  });

  const openPanel = () => {
    setDraftMask(settings.appliedMask & DEFAULT_MASK);
    setDraftPenalty(clamp(settings.appliedPenalty, 0, MAX_PENALTY));
    sheetOffsetRef.current = 0;
    setPanelOpen(true);
  };

  const closePanel = () => setPanelOpen(false);

  const toggleDraftBit = (bit) => {
    setDraftMask((prev) => (prev & bit ? prev & ~bit : prev | bit));
  };

  const applySettings = async ({ mask, surfacePenaltySPerKm } = {}) => {
    const nextMask = (mask ?? draftMask) & DEFAULT_MASK;
    const nextPenalty = clamp(surfacePenaltySPerKm ?? draftPenalty, 0, MAX_PENALTY);
    await settings.applySettings({ mask: nextMask, surfacePenaltySPerKm: nextPenalty });
    setPanelOpen(true);
  };

  const toggleSatView = () => {
    setIsSatView((prev) => {
      const next = !prev;
      localStorage.setItem("satelliteView", next.toString());
      return next;
    });
  };

  const value = {
    panelOpen,
    openPanel,
    closePanel,
    routeFitTick,
    triggerRouteFit,
    setSheetHeight,
    setSheetOffset,
    getSheetVisibleHeight,
    draftMask,
    setDraftMask,
    toggleDraftBit,
    draftPenalty,
    setDraftPenalty,
    applySettings,
    isSatView,
    toggleSatView,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
