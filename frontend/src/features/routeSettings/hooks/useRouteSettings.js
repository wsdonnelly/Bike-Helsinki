import { useState } from "react";
import { useRoute } from "@/features/routing";
import { clamp } from "@/shared/utils/math";

export function useRouteSettings() {
  const { settings } = useRoute();

  const [panelOpen, setPanelOpen] = useState(false);
  const [draftMask, setDraftMask] = useState(settings.appliedMask);
  const [draftPenalty, setDraftPenalty] = useState(settings.appliedPenalty);

  const openPanel = () => {
    setDraftMask(settings.appliedMask & 0xffff);
    setDraftPenalty(clamp(settings.appliedPenalty, 0, 1000));
    setPanelOpen(true);
  };

  const closePanel = () => setPanelOpen(false);

  const toggleDraftBit = (bit) => {
    setDraftMask((prev) => (prev & bit ? prev & ~bit : prev | bit));
  };

  const applySettings = async ({ mask, surfacePenaltySPerKm } = {}) => {
    const nextMask = (mask ?? draftMask) & 0xffff;
    const nextPenalty = clamp(surfacePenaltySPerKm ?? draftPenalty, 0, 1000);
    await settings.applySettings({
      mask: nextMask,
      surfacePenaltySPerKm: nextPenalty,
    });
    setPanelOpen(true);
  };

  return {
    panelOpen,
    openPanel,
    closePanel,
    draftMask,
    setDraftMask,
    toggleDraftBit,
    draftPenalty,
    setDraftPenalty,
    applySettings,
  };
}
