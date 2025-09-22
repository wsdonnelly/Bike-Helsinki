import { useEffect, useState } from "react";

export function useIsMobile(q = "(max-width: 640px)") {
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
