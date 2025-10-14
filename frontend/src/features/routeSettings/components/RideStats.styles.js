export const statsBoxSticky = {
  position: "sticky",
  bottom: 0,
  left: 0,
  right: 0,
  background: "#fff",
  borderTop: "1px solid #eee",
  paddingTop: 10,
  paddingBottom: 12,
};

export const statsBoxNormal = {
  background: "#fff",
  borderTop: "1px solid #eee",
  paddingTop: 10,
  paddingBottom: 12,
};

export const statsHeader = {
  fontWeight: 700,
  fontSize: 13,
  marginBottom: 8,
};

export const statsGrid = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  rowGap: 6,
  columnGap: 12,
  fontSize: 13,
  marginBottom: 10,
};

export const statVal = { fontWeight: 600 };

export const barWrap = { marginTop: 6, marginBottom: 8 };

export const barOuter = {
  display: "flex",
  width: "100%",
  height: 14,
  borderRadius: 8,
  overflow: "hidden",
  background: "#f3f4f6",
};

export const legend = {
  marginTop: 8,
  display: "grid",
  rowGap: 6,
};

export const legendItem = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  columnGap: 8,
  padding: "2px 0",
};

export const legendLabel = {
  fontSize: 12,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export const legendVal = {
  marginLeft: 8,
  fontWeight: 700,
  fontSize: 12,
  lineHeight: 1.1,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

export const dot = (color) => ({
  width: 10,
  height: 10,
  borderRadius: 999,
  background: color,
  flex: "0 0 10px",
});
