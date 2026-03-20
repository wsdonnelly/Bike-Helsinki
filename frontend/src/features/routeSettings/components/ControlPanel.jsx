import React from "react";
import { useIsMobile } from "@/shared";
import DesktopSidebar from "./DesktopSidebar";
import MobileSheet from "./MobileSheet";

const ControlPanel = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSheet /> : <DesktopSidebar />;
};

export default ControlPanel;
