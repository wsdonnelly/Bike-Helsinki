import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useGeolocation } from "../context/GeolocationContext";

export function TripController() {
  const map = useMap();
  const { position, isLocating, isTripActive } = useGeolocation();
  const lastFlyRef = useRef(0);
  const hasCenteredRef = useRef(false);
  const hasCenteredOnLocateRef = useRef(false);

  useEffect(() => {
    if (!isLocating || !position || hasCenteredOnLocateRef.current) return;
    map.flyTo([position.lat, position.lon], 15, { duration: 0.8 });
    hasCenteredOnLocateRef.current = true;
  }, [position, isLocating, map]);

  useEffect(() => {
    if (!isLocating) hasCenteredOnLocateRef.current = false;
  }, [isLocating]);

  useEffect(() => {
    if (!isTripActive || !position) return;
    const now = Date.now();
    if (!hasCenteredRef.current) {
      map.flyTo([position.lat, position.lon], 18, { duration: 0.5 });
      hasCenteredRef.current = true;
      lastFlyRef.current = now;
      return;
    }
    if (now - lastFlyRef.current < 1000) return;
    map.flyTo([position.lat, position.lon], map.getZoom(), { duration: 0.3 });
    lastFlyRef.current = now;
  }, [position, isTripActive, map]);

  useEffect(() => {
    if (!isTripActive) hasCenteredRef.current = false;
  }, [isTripActive]);

  return null;
}
