export const backdrop = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  zIndex: 10000,
  pointerEvents: "auto",
};

export const dialog = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(90vw, 500px)",
  maxHeight: "80vh",
  backgroundColor: "#fff",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  zIndex: 10001,
  pointerEvents: "auto",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

export const header = {
  padding: "24px 24px 16px",
  borderBottom: "1px solid #f0f0f0",
  background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
  color: "#fff",
};

export const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export const title = {
  margin: 0,
  fontSize: 24,
  fontWeight: 700,
  textShadow: "0 1px 2px rgba(0,0,0,0.1)",
};

export const content = {
  padding: 24,
  overflowY: "auto",
  flex: 1,
};

export const banner = {
  marginBottom: 12,
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(255, 87, 34, 0.10)",
  color: "#6b4f00",
  border: "1px solid rgba(255, 193, 7, 0.35)",
  fontSize: 14,
  lineHeight: 1.4,
};

export const sectionHeading = {
  margin: "0 0 12px",
  fontSize: 18,
  fontWeight: 600,
  color: "#333",
};

export const list = {
  margin: 0,
  paddingLeft: 20,
  lineHeight: 1.6,
  color: "#555",
};

export const listItem = { marginBottom: 8 };

export const colorLegend = { display: "flex", flexDirection: "column", gap: 8 };

export const colorRow = { display: "flex", alignItems: "center", gap: 12 };

export const colorSwatch = (color, dashed = false) => ({
  width: 20,
  height: 4,
  backgroundColor: color,
  borderRadius: 2,
  ...(dashed && {
    backgroundImage:
      "repeating-linear-gradient(90deg, transparent, transparent 3px, white 3px, white 6px)",
  }),
});

export const colorLabel = { fontSize: 14, color: "#555" };

export const footer = {
  padding: "16px 24px",
  borderTop: "1px solid #f0f0f0",
  backgroundColor: "#fafafa",
  textAlign: "center",
};

export const closeBtn = {
  backgroundColor: "#007AFF",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "12px 24px",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0, 122, 255, 0.3)",
  transition: "all 0.2s ease",
};
