import { useState, useEffect, useRef } from "react";
import { SNAP_BACK_DELAY_MS } from "@/shared/constants/config";

export function useFollowing({ mapRef, isActive }) {
  const [isFollowing, setIsFollowing] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      clearTimeout(timerRef.current);
      setIsFollowing(true);
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    const onMoveStart = (e) => {
      if (!e.originalEvent) return;
      setIsFollowing(false);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsFollowing(true), SNAP_BACK_DELAY_MS);
    };

    map.on("movestart", onMoveStart);
    return () => {
      map.off("movestart", onMoveStart);
      clearTimeout(timerRef.current);
    };
  }, [isActive, mapRef]);

  return { isFollowing };
}
