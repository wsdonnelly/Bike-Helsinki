// Not currently used: RouteContext stores raw display_name from Digitransit.
// Kept as a ready-made alternative for producing shorter "Street, City" labels
// if the verbose Pelias display_name proves too long for the UI.
export const formatAddress = (place) => {
  if (!place) return "Unknown location";

  const a = place.address || {};

  const street = [a.house_number, a.road || a.street || a.pedestrian]
    .filter(Boolean)
    .join(" ");

  const neighborhood =
    a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district;

  const city = a.city || a.town || a.village || a.municipality || a.county;

  const parts = [street, neighborhood, city]
    .filter(Boolean)
    .filter((part, index, arr) => {
      return (
        arr.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === index
      );
    });

  if (parts.length >= 2) {
    return parts.join(", ");
  }

  if (place.display_name) {
    return place.display_name
      .split(",")
      .map((p) => p.trim())
      .slice(0, 3)
      .filter(Boolean)
      .join(", ");
  }

  return "Unnamed place";
};
