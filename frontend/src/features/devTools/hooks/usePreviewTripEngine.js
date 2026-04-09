import { useEffect, useRef } from "react";
import { useGeolocation } from "@/features/geolocation/context/GeolocationContext";
import { useRoute } from "@/features/routing";
import { useRouteSettingsContext } from "@/features/routeSettings/context/RouteSettingsContext";
import { buildCumulativeTable, positionAt } from "../utils/routeInterpolation";
import { PREVIEW_TRIP_SPEED_KMH } from "@/shared/constants/config";

const SPEED_MS = PREVIEW_TRIP_SPEED_KMH / 3.6;

export function usePreviewTripEngine({ isPreviewActive, progressRef, totalM, autoAdvance, setProgressM }) {
  const { setPositionOverride } = useGeolocation();
  const { routeCoords } = useRoute();
  const { panelOpen } = useRouteSettingsContext();

  const tableRef = useRef(null);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const autoAdvanceRef = useRef(autoAdvance);
  const panelOpenRef = useRef(panelOpen);

  autoAdvanceRef.current = autoAdvance;
  panelOpenRef.current = panelOpen;

  useEffect(() => {
    if (!isPreviewActive) {
      tableRef.current = null;
      return;
    }
    tableRef.current = buildCumulativeTable(routeCoords);
  }, [isPreviewActive, routeCoords]);

  useEffect(() => {
    if (!isPreviewActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }

    function tick(ts) {
      rafRef.current = requestAnimationFrame(tick);
      const table = tableRef.current;
      if (!table) return;

      if (lastTsRef.current === null) {
        lastTsRef.current = ts;
      }
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      let progress = progressRef.current;

      if (autoAdvanceRef.current && !panelOpenRef.current && progress < totalM) {
        progress = Math.min(progress + dt * SPEED_MS, totalM);
        setProgressM(progress);
      }

      const pos = positionAt(table, routeCoords, progress);
      setPositionOverride({ lat: pos.lat, lon: pos.lon, accuracy: 5, heading: pos.heading, speed: SPEED_MS });
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewActive, totalM]);
}
