export const containerStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  height: "100%",
  zIndex: 9999,
  pointerEvents: "none",
};

export const toggleBtn = {
  position: "absolute",
  top: 80,
  left: 10,
  padding: "6px 10px",
  zIndex: 10000,
  border: "1px solid #ccc",
  borderRadius: 6,
  backgroundColor: "#fff",
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
  cursor: "pointer",
  pointerEvents: "auto",
};

export const mobileToggleBtn = {
  position: "fixed",
  bottom: 20,
  right: 20,
  padding: "12px 16px",
  zIndex: 10000,
  border: "1px solid #ccc",
  borderRadius: 50,
  backgroundColor: "#fff",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  cursor: "pointer",
  pointerEvents: "auto",
  fontSize: 18,
};

export const btnSm = {
  border: "1px solid #ddd",
  background: "#fff",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};

export const panel = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "min(92vw, 320px)",
  height: "100%",
  backgroundColor: "#fff",
  boxShadow: "2px 0 5px rgba(0,0,0,0.2)",
  overflowY: "auto",
  padding: 16,
  pointerEvents: "auto",
};

export const mobileSheet = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  maxHeight: "85vh",
  backgroundColor: "#fff",
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
  overflowY: "auto",
  padding: 16,
  pointerEvents: "auto",
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
};

export const stickyTray = {
  position: "sticky",
  bottom: 0,
  left: 0,
  right: 0,
  background: "#fff",
  borderTop: "1px solid #eee",
  boxShadow: "0 -2px 6px rgba(0,0,0,0.05)",
};

export const hdr = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
};

export const handleArea = {
  position: "sticky",
  top: 0,
  left: 0,
  right: 0,
  padding: "10px 0 6px",
  display: "flex",
  justifyContent: "center",
  background: "#fff",
  zIndex: 1,
  userSelect: "none",
  touchAction: "none",
  cursor: "grab",
};

export const handleBar = {
  width: 44,
  height: 5,
  borderRadius: 999,
  background: "#DDD",
};

export const tabBtn = {
  flex: 1,
  padding: "8px 12px",
  border: "1px solid #eee",
  borderRadius: 8,
  cursor: "pointer",
};

export const tabsContainer = {
  display: "flex",
  gap: 8,
  marginBottom: 12,
};

// Helper to merge header styles for mobile
export const mobileHdr = {
  ...hdr,
  cursor: "grab",
  touchAction: "none",
};

// Helper to get title style
export const titleStyle = {
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
  flex: 1,
};

// Helper to get apply button style
export const applyBtn = {
  ...btnSm,
  marginLeft: 6,
};
