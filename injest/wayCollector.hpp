#pragma once

#include <array>
#include <cstring>
#include <osmium/handler.hpp>
#include <osmium/osm/way.hpp>
#include <string_view>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "surfaceTypes.hpp"

namespace injest
{
// ─────────────────────────────────────────────────────────────────────────────
// Surface mapping (OSM tag → SurfacePrimary)
// ─────────────────────────────────────────────────────────────────────────────
struct SurfaceMaps
{
  struct Entry
  {
    std::string_view key;
    types::SurfacePrimary primary;
  };

  static constexpr std::array<Entry, 16> kEntries{
      {{"paved", types::SurfacePrimary::PAVED},
       {"asphalt", types::SurfacePrimary::ASPHALT},
       {"concrete", types::SurfacePrimary::CONCRETE},
       {"paving_stones", types::SurfacePrimary::PAVING_STONES},
       {"sett", types::SurfacePrimary::SETT},
       {"unhewn_cobblestones", types::SurfacePrimary::UNHEWN_COBBLESTONES},
       {"cobblestones", types::SurfacePrimary::COBBLESTONES},
       {"bricks", types::SurfacePrimary::BRICKS},

       {"unpaved", types::SurfacePrimary::UNPAVED},
       {"compacted", types::SurfacePrimary::COMPACTED},
       {"fine_gravel", types::SurfacePrimary::FINE_GRAVEL},
       {"gravel", types::SurfacePrimary::GRAVEL},
       {"ground", types::SurfacePrimary::GROUND},
       {"dirt", types::SurfacePrimary::DIRT},
       {"earth", types::SurfacePrimary::EARTH},

       {"unknown", types::SurfacePrimary::UNKNOWN}}};

  // Set wayMeta's surface fields based on OSM surface tag
  static void fromTag(const char* surfaceVal,
                      types::SurfacePrimary& surfacePrimaryOut);
};

// ─────────────────────────────────────────────────────────────────────────────
// Way metadata (access + surfaces)
// ─────────────────────────────────────────────────────────────────────────────
struct WayMeta
{
  bool bikeFwd{false};
  bool bikeBack{false};
  bool footAllowed{false};
  types::SurfacePrimary surfacePrimary{types::SurfacePrimary::UNKNOWN};
};

// Helper functions for OSM tag parsing
bool isYes(const char* v);
bool isNo(const char* v);

// ─────────────────────────────────────────────────────────────────────────────
// OSM Way collector handler
// ─────────────────────────────────────────────────────────────────────────────
struct WayCollector : public osmium::handler::Handler
{
  // Reference to external storage maps
  std::unordered_map<uint64_t, std::vector<uint64_t>>& wayIdNodeIdsMap;
  std::unordered_map<uint64_t, WayMeta>& wayIdWayMetaMap;

  // OSM highway types suitable for biking
  static inline const std::unordered_set<std::string_view> kBikeHighways{
      "cycleway", "path",         "residential", "service",    "secondary",
      "tertiary", "unclassified", "track",       "pedestrian", "unclassified"};

  // OSM highway types suitable for walking
  static inline const std::unordered_set<std::string_view> kFootHighways{
      "footway", "path",          "pedestrian", "steps",       "residential",
      "service", "living_street", "track",      "unclassified"};

  // Acceptable OSM route=* values for biking
  static inline const std::unordered_set<std::string_view> kBikeRoutes{
      "bicycle", "mtb", "road"};

  // Acceptable OSM route=* values for walking
  static inline const std::unordered_set<std::string_view> kFootRoutes{
      "hiking", "foot", "nordic_walking", "running", "fitness_trail"};

  // OSM route=* values to exclude (transport infrastructure)
  static inline const std::unordered_set<std::string_view>
      kTransportRoutesBlacklist{
          "ferry",  "bus",        "tram",       "train",    "railway",
          "subway", "light_rail", "trolleybus", "monorail", "ski"};

  // Constructor
  WayCollector(
      std::unordered_map<uint64_t, std::vector<uint64_t>>& wayIdNodeIdsMapIn,
      std::unordered_map<uint64_t, WayMeta>& wayMetaMapIn);

  // Main handler method - processes each OSM way
  void way(const osmium::Way& way);
};

}  // namespace injest