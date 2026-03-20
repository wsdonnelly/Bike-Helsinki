import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT_PX } from "../constants/config";

export function useIsMobile(q = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mm = window.matchMedia(q);
    const on = () => setM(mm.matches);
    on();
    mm.addEventListener?.("change", on);
    return () => mm.removeEventListener?.("change", on);
  }, [q]);
  return m;
}
