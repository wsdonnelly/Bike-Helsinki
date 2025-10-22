import { useState, useCallback } from "react";

export default function useInfoWindow() {
  const [visible, setVisible] = useState(true);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const open = useCallback(() => {
    setVisible(true);
  }, []);

  return { visible, open, close };
}
