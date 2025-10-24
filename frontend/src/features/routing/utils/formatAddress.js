// export const formatAddress = (display_name) => {
//   if (!display_name) return "";

//   const parts = display_name.split(",").map((part) => part.trim());

//   const street = parts[0] || "";
//   const neighborhood = parts[2] || "";
//   const city = parts[5] || "";

//   return [street, neighborhood, city].filter(Boolean).join(", ");
// };


/**
 * Format a Nominatim result into a clean, human-readable address
 * @param {Object} place - Nominatim result object with address property
 * @returns {string} Formatted address
 */
export const formatAddress = (place) => {
  if (!place) return "Unknown location";

  const a = place.address || {};

  // Build street address (number + street name)
  const street = [a.house_number, a.road || a.street || a.pedestrian]
    .filter(Boolean)
    .join(" ");

  // Get neighborhood/area (prefer more specific)
  const neighborhood =
    a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district;

  // Get city (prefer more specific)
  const city = a.city || a.town || a.village || a.municipality || a.county;

  // Build the formatted address
  const parts = [street, neighborhood, city]
    .filter(Boolean)
    .filter((part, index, arr) => {
      // Remove duplicates (case-insensitive)
      return (
        arr.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === index
      );
    });

  // If we have at least street + city, use it; otherwise fallback
  if (parts.length >= 2) {
    return parts.join(", ");
  }

  // Fallback to display_name if structured address is insufficient
  if (place.display_name) {
    // Parse display_name as backup
    const nameParts = place.display_name.split(",").map((p) => p.trim());
    return [nameParts[0], nameParts[2], nameParts[5]]
      .filter(Boolean)
      .join(", ");
  }

  return "Unnamed place";
};
