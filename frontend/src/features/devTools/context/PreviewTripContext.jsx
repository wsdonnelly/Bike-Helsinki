import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { usePreviewTripEngine } from "../hooks/usePreviewTripEngine";
import { useGeolocation } from "@/features/geolocation/context/GeolocationContext";

const PreviewTripContext = createContext(null);

export function PreviewTripProvider({ children }) {
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [progressM, setProgressMState] = useState(0);
  const [totalM, setTotalM] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const progressRef = useRef(0);

  const setProgressM = useCallback((m) => {
    progressRef.current = m;
    setProgressMState(m);
  }, []);

  const startPreview = useCallback((total) => {
    setTotalM(total);
    setProgressM(0);
    setAutoAdvance(true);
    setIsPreviewActive(true);
  }, [setProgressM]);

  const stopPreview = useCallback(() => {
    setIsPreviewActive(false);
    setProgressM(0);
    setTotalM(0);
    setAutoAdvance(true);
  }, [setProgressM]);

  const pauseAutoAdvance = useCallback(() => setAutoAdvance(false), []);
  const resumeAutoAdvance = useCallback(() => setAutoAdvance(true), []);

  const { isTripActive } = useGeolocation();

  useEffect(() => {
    if (!isTripActive && isPreviewActive) stopPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTripActive]);

  usePreviewTripEngine({ isPreviewActive, progressRef, totalM, autoAdvance, setProgressM });

  return (
    <PreviewTripContext.Provider
      value={{ isPreviewActive, progressM, totalM, autoAdvance, startPreview, stopPreview, setProgressM, pauseAutoAdvance, resumeAutoAdvance }}
    >
      {children}
    </PreviewTripContext.Provider>
  );
}

export function usePreviewTrip() {
  const ctx = useContext(PreviewTripContext);
  if (!ctx) throw new Error("usePreviewTrip must be used inside PreviewTripProvider");
  return ctx;
}
