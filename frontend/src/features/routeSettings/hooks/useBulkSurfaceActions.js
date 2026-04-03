import { SurfaceBits, ALL_BITS_MASK, PAVED_BITS_MASK, UNPAVED_BITS_MASK } from "../constants/surfaceTypes";

export function useBulkSurfaceActions(setDraftMask) {
  const applyBulk = (newMask) => {
    newMask |= SurfaceBits.SURF_UNKNOWN;
    setDraftMask?.(newMask);
  };

  return {
    selectAll: () => applyBulk(ALL_BITS_MASK),
    selectNone: () => applyBulk(0),
    selectPaved: () => applyBulk(PAVED_BITS_MASK),
    selectUnpaved: () => applyBulk(UNPAVED_BITS_MASK),
  };
}
