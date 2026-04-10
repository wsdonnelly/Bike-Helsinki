import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useRoute } from "@/features/routing";

const GEO_OPTS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 };

const GeolocationContext = createContext(null);

export function GeolocationProvider({ children }) {
  const { cfg } = useRoute();
  const [realPosition, setRealPosition] = useState(null);
  const [positionOverride, setPositionOverrideState] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isTripActive, setIsTripActive] = useState(false);
  const [error, setError] = useState(null);
  const [outOfBounds, setOutOfBounds] = useState(false);
  const watchIdRef = useRef(null);
  const positionOverrideRef = useRef(null);

  const position = positionOverride ?? realPosition;

  const setPositionOverride = useCallback((pos) => {
    positionOverrideRef.current = pos;
    setPositionOverrideState(pos);
  }, []);

  const onSuccess = useCallback((pos) => {
    const { latitude, longitude, accuracy, heading, speed } = pos.coords;
    setRealPosition({ lat: latitude, lon: longitude, accuracy, heading, speed });
    setError(null);
  }, []);

  useEffect(() => {
    if (!position || !cfg?.bbox) return;
    const { minLat, maxLat, minLon, maxLon } = cfg.bbox;
    setOutOfBounds(
      position.lat < minLat || position.lat > maxLat ||
      position.lon < minLon || position.lon > maxLon
    );
  }, [position, cfg]);

  const onError = useCallback((err) => {
    if (err.code === err.PERMISSION_DENIED) {
      setError("Location permission denied.");
    } else {
      setError("Unable to get your location.");
    }
    setIsLocating(false);
    setIsTripActive(false);
  }, []);

  const startLocating = useCallback(() => {
    if (positionOverrideRef.current) {
      setIsLocating(true);
      return;
    }
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, GEO_OPTS);
    setIsLocating(true);
    setError(null);
  }, [onSuccess, onError]);

  const stopLocating = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    positionOverrideRef.current = null;
    setPositionOverrideState(null);
    setIsLocating(false);
    setIsTripActive(false);
    setRealPosition(null);
    setError(null);
    setOutOfBounds(false);
  }, []);

  const startTrip = useCallback(() => setIsTripActive(true), []);
  const stopTrip = useCallback(() => setIsTripActive(false), []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <GeolocationContext.Provider
      value={{ position, isLocating, isTripActive, error, outOfBounds, startLocating, stopLocating, startTrip, stopTrip, setPositionOverride }}
    >
      {children}
    </GeolocationContext.Provider>
  );
}

export function useGeolocation() {
  const ctx = useContext(GeolocationContext);
  if (!ctx) throw new Error("useGeolocation must be used inside GeolocationProvider");
  return ctx;
}
