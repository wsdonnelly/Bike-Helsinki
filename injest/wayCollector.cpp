#include "wayCollector.hpp"

#include <algorithm>
#include <cstring>
#include <osmium/osm/way.hpp>

namespace injest
{
// ─────────────────────────────────────────────────────────────────────────────
// Surface mapping implementation
// ─────────────────────────────────────────────────────────────────────────────
void SurfaceMaps::fromTag(const char* surfaceVal,
                          types::SurfacePrimary& surfacePrimaryOut)
{
  if (!surfaceVal || !*surfaceVal)
  {
    surfacePrimaryOut = types::SurfacePrimary::UNKNOWN;

    return;
  }

  const std::string_view key{surfaceVal};
  auto it = std::find_if(kEntries.begin(), kEntries.end(),
                         [&](const Entry& e) { return e.key == key; });

  if (it != kEntries.end())
  {
    surfacePrimaryOut = it->primary;
  }
  else
  {
    surfacePrimaryOut = types::SurfacePrimary::UNKNOWN;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper function implementations
// ─────────────────────────────────────────────────────────────────────────────
bool isYes(const char* v)
{
  return v &&
         (std::strcmp(v, "yes") == 0 || std::strcmp(v, "designated") == 0 ||
          std::strcmp(v, "permissive") == 0);
}

bool isNo(const char* v)
{
  return v && (std::strcmp(v, "no") == 0 || std::strcmp(v, "private") == 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// WayCollector implementation
// ─────────────────────────────────────────────────────────────────────────────
WayCollector::WayCollector(
    std::unordered_map<uint64_t, std::vector<uint64_t>>& wayIdNodeIdsMapIn,
    std::unordered_map<uint64_t, WayMeta>& wayMetaMapIn)
    : wayIdNodeIdsMap(wayIdNodeIdsMapIn), wayIdWayMetaMap(wayMetaMapIn)
{}

void WayCollector::way(const osmium::Way& way)
{
  const auto& tags = way.tags();
  const char* highwayVal = tags.get_value_by_key("highway");
  const char* accVal = tags.get_value_by_key("access");
  const char* bicycleVal = tags.get_value_by_key("bicycle");
  const char* footVal = tags.get_value_by_key("foot");
  const char* routeVal = tags.get_value_by_key("route");
  const char* aerialwayVal = tags.get_value_by_key("aerialway");
  const char* railwayVal = tags.get_value_by_key("railway");
  const char* waterwayVal = tags.get_value_by_key("waterway");

  // Early-out: exclude obvious non-walk/bike transport infrastructures on ways
  auto isActiveRail = [](const char* v) -> bool {
    if (!v) return false;

    std::string_view sv(v);
    static const std::unordered_set<std::string_view> kBlock{
        "rail",      "tram",         "subway",    "light_rail",  "monorail",
        "funicular", "narrow_gauge", "preserved", "construction"};

    // explicitly allow these
    if (sv == "platform" || sv == "razed" || sv == "abandoned" ||
        sv == "disused" || sv == "dismantled" || sv == "proposed")
    {
      return false;
    }
    return kBlock.count(sv) > 0;
  };

  if ((routeVal && kTransportRoutesBlacklist.count(routeVal)) || aerialwayVal ||
      waterwayVal || isActiveRail(railwayVal))
  {
    return;
  }

  bool candidate_bike =
      (highwayVal && kBikeHighways.count(highwayVal)) || isYes(bicycleVal);
  bool candidate_foot =
      (highwayVal && kFootHighways.count(highwayVal)) || isYes(footVal);

  // If a route=* is present on the way:
  // - Accept if it's an allowed walking/cycling route (additive, not
  // overriding).
  // - (Ferries & other transports already returned above.)
  if (routeVal)
  {
    if (kBikeRoutes.count(routeVal)) candidate_bike = true;
    if (kFootRoutes.count(routeVal)) candidate_foot = true;
  }

  // Respect explicit prohibitions
  if (isNo(bicycleVal)) candidate_bike = false;
  if (isNo(footVal)) candidate_foot = false;

  // If general access is blocked, keep only explicit per-mode overrides
  if (isNo(accVal) && !isYes(bicycleVal) && !isYes(footVal))
  {
    return;
  }

  if (!candidate_bike && !candidate_foot) return;

  WayMeta wayMeta;
  // set surface value
  SurfaceMaps::fromTag(tags.get_value_by_key("surface"),
                       wayMeta.surfacePrimary);

  bool bike_allowed = !isNo(bicycleVal) && candidate_bike;
  bool foot_allowed =
      !isNo(footVal) && (candidate_foot || !highwayVal ||
                         std::strcmp(highwayVal, "motorway") != 0);

  if (bicycleVal && std::strcmp(bicycleVal, "dismount") == 0)
  {
    bike_allowed = false;
  }

  bool fwd{true}, back{true};
  const char* isOneWay = tags.get_value_by_key("oneway");
  const char* isJunct = tags.get_value_by_key("junction");
  if ((isOneWay && (std::strcmp(isOneWay, "yes") == 0 ||
                    std::strcmp(isOneWay, "1") == 0)) ||
      (isJunct && std::strcmp(isJunct, "roundabout") == 0))
  {
    fwd = true;
    back = false;
  }
  else if (isOneWay && std::strcmp(isOneWay, "-1") == 0)
  {
    fwd = false;
    back = true;
  }

  const char* ow_bike = tags.get_value_by_key("oneway:bicycle");
  const char* cycleway = tags.get_value_by_key("cycleway");
  if (ow_bike && std::strcmp(ow_bike, "no") == 0)
  {
    fwd = true;
    back = true;
  }
  if (cycleway && (std::strcmp(cycleway, "opposite") == 0 ||
                   std::strcmp(cycleway, "opposite_lane") == 0 ||
                   std::strcmp(cycleway, "opposite_track") == 0))
  {
    fwd = true;
    back = true;
  }

  wayMeta.bikeFwd = bike_allowed && fwd;
  wayMeta.bikeBack = bike_allowed && back;
  // foot generally two-way skip fwd/back
  wayMeta.footAllowed = foot_allowed;

  auto& wayNodes = wayIdNodeIdsMap[way.id()];
  wayNodes.reserve(way.nodes().size());
  for (const auto& node : way.nodes())
  {
    wayNodes.push_back(node.ref());
  }

  wayIdWayMetaMap[way.id()] = wayMeta;
}

}  // namespace injest