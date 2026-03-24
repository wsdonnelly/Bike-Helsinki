import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

const GEO_OPTS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 };

const GeolocationContext = createContext(null);

export function GeolocationProvider({ children }) {
  const [position, setPosition] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isTripActive, setIsTripActive] = useState(false);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  const onSuccess = useCallback((pos) => {
    const { latitude, longitude, accuracy, heading, speed } = pos.coords;
    setPosition({ lat: latitude, lon: longitude, accuracy, heading, speed });
    setError(null);
  }, []);

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
    setIsLocating(false);
    setIsTripActive(false);
    setPosition(null);
    setError(null);
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
      value={{ position, isLocating, isTripActive, error, startLocating, stopLocating, startTrip, stopTrip }}
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
