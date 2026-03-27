import { useEffect, useRef } from "react";
import { useGeolocation } from "../context/GeolocationContext";

export function TripController({ mapRef }) {
  const { position, isLocating, isTripActive } = useGeolocation();
  const lastFlyRef = useRef(0);
  const hasCenteredRef = useRef(false);
  const hasCenteredOnLocateRef = useRef(false);

  useEffect(() => {
    if (!isLocating || !position || hasCenteredOnLocateRef.current) return;
    mapRef.current?.flyTo({ center: [position.lon, position.lat], zoom: 15, duration: 800 });
    hasCenteredOnLocateRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, isLocating]);

  useEffect(() => {
    if (!isLocating) hasCenteredOnLocateRef.current = false;
  }, [isLocating]);

  useEffect(() => {
    if (!isTripActive || !position) return;
    const map = mapRef.current;
    if (!map) return;
    const now = Date.now();
    if (!hasCenteredRef.current) {
      map.flyTo({ center: [position.lon, position.lat], zoom: 18, duration: 500 });
      hasCenteredRef.current = true;
      lastFlyRef.current = now;
      return;
    }
    if (now - lastFlyRef.current < 1000) return;
    map.flyTo({ center: [position.lon, position.lat], zoom: map.getZoom(), duration: 300 });
    if (position.heading != null) {
      map.rotateTo(position.heading, { duration: 300 });
    }
    lastFlyRef.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, isTripActive]);

  useEffect(() => {
    if (!isTripActive) hasCenteredRef.current = false;
  }, [isTripActive]);

  return null;
}
