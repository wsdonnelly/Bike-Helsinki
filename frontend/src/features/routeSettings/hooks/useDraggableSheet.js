import { useState, useRef, useEffect } from "react";
import { clamp } from "@/shared/utils/math";

export function useDraggableSheet(isOpen) {
  const [sheetOffset, setSheetOffset] = useState(0);
  const sheetOffsetRef = useRef(0);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const draggingRef = useRef(false);

  const MAX_OFFSET = Math.round(window.innerHeight * 0.6);

  const startDrag = (e) => {
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    draggingRef.current = true;
    dragStartY.current = y;
    dragStartOffset.current = sheetOffset;
  };

  const onDragMove = (e) => {
    if (!draggingRef.current) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = y - dragStartY.current;
    const next = clamp(dragStartOffset.current + dy, 0, MAX_OFFSET);
    sheetOffsetRef.current = next;
    setSheetOffset(next);
  };

  const endDrag = (onClose, onSettle) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const threshold = MAX_OFFSET * 0.8;
    if (sheetOffsetRef.current > threshold) {
      onClose();
    } else {
      onSettle?.(sheetOffsetRef.current);
    }
  };

  useEffect(() => {
    if (isOpen) setSheetOffset(0);
  }, [isOpen]);

  return {
    sheetOffset,
    draggingRef,
    startDrag,
    onDragMove,
    endDrag,
  };
}
