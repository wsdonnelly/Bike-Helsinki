export const formatAddress = (fullAddress) => {
  if (!fullAddress) return "";

  const parts = fullAddress.split(",").map((part) => part.trim());

  const street = parts[0] || "";
  const neighborhood = parts[2] || "";
  const city = parts[5] || "";

  return [street, neighborhood, city].filter(Boolean).join(", ");
};
