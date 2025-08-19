#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <osmium/handler.hpp>
#include <osmium/io/any_input.hpp>
#include <osmium/osm/node.hpp>
#include <osmium/osm/way.hpp>
#include <osmium/visitor.hpp>
#include <string>
#include <string_view>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

#include "SurfaceTypes.hpp"

// ─────────────────────────────────────────────────────────────────────────────
// Binary headers (versioned)
// ─────────────────────────────────────────────────────────────────────────────
struct NodesHeader
{
  char magic[8] = {'M', 'M', 'A', 'P', 'N', 'O', 'D', 'E'};  // "MMAPNODE"
  uint32_t version = 1;
  uint32_t numNodes = 0;
  uint8_t coordType = 0;  // 0=float32 degrees
  uint8_t reserved[3]{0, 0, 0};
};
static_assert(sizeof(NodesHeader) == 20, "NodesHeader must be 20 bytes");

struct EdgesHeader
{
  char magic[8] = {'M', 'M', 'A', 'P', 'E', 'D', 'G', 'E'};  // "MMAPEDGE"
  uint32_t version = 1;
  uint32_t numNodes = 0;
  uint32_t numEdges = 0;          // directed edges
  uint8_t hasSurfacePrimary = 1;  // now set to 1
  uint8_t hasSurfaceFlags = 1;    // now set to 1
  uint8_t hasModeMask = 1;        // now set to 1
  uint8_t lengthType = 0;         // 0=float32 meters
};

static_assert(sizeof(EdgesHeader) == 24, "EdgesHeader must be 24 bytes");

// move to utils or other hpp same version as route.cpp
static inline double haversineMeters(double lat1Deg, double lon1Deg,
                                     double lat2Deg, double lon2Deg)
{
  constexpr double kPi = 3.14159265358979323846;
  constexpr double kDegToRad = kPi / 180.0;
  constexpr double kEarthRadiusMeters = 6371000.0;

  const double dLat = (lat2Deg - lat1Deg) * kDegToRad;
  const double dLon = (lon2Deg - lon1Deg) * kDegToRad;
  const double lat1 = lat1Deg * kDegToRad;
  const double lat2 = lat2Deg * kDegToRad;

  const double sinHalfDLat = std::sin(dLat * 0.5);
  const double sinHalfDLon = std::sin(dLon * 0.5);

  const double a = sinHalfDLat * sinHalfDLat +
                   std::cos(lat1) * std::cos(lat2) * sinHalfDLon * sinHalfDLon;

  const double centralAngle =
      2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
  return kEarthRadiusMeters * centralAngle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface mapping (OSM tag → primary + flags)
// ─────────────────────────────────────────────────────────────────────────────
struct SurfaceMaps
{
  static constexpr types::SurfaceMask PAVED =
      types::bit(types::SurfaceBit::PAVED);
  static constexpr types::SurfaceMask UNPAVED =
      types::bit(types::SurfaceBit::UNPAVED);
  static constexpr types::SurfaceMask UNKNOWN =
      types::bit(types::SurfaceBit::UNKNOWN);

  struct Entry
  {
    std::string_view key;
    types::SurfacePrimary primary;
    types::SurfaceMask flags;
  };

  static constexpr std::array<Entry, 15> kEntries{{
      {"asphalt", types::SurfacePrimary::ASPHALT,
       types::bit(types::SurfaceBit::ASPHALT) | PAVED},
      {"concrete", types::SurfacePrimary::CONCRETE,
       types::bit(types::SurfaceBit::CONCRETE) | PAVED},
      {"paving_stones", types::SurfacePrimary::PAVING_STONES,
       types::bit(types::SurfaceBit::PAVING_STONES) | PAVED},
      {"sett", types::SurfacePrimary::SETT,
       types::bit(types::SurfaceBit::SETT) | PAVED},
      {"unhewn_cobblestones", types::SurfacePrimary::UNHEWN_COBBLESTONES,
       types::bit(types::SurfaceBit::UNHEWN_COBBLESTONES) | PAVED},
      {"cobblestones", types::SurfacePrimary::COBBLESTONES,
       types::bit(types::SurfaceBit::COBBLESTONES) | PAVED},
      {"bricks", types::SurfacePrimary::BRICKS,
       types::bit(types::SurfaceBit::BRICKS) | PAVED},
      {"compacted", types::SurfacePrimary::COMPACTED,
       types::bit(types::SurfaceBit::COMPACTED) | UNPAVED},
      {"fine_gravel", types::SurfacePrimary::FINE_GRAVEL,
       types::bit(types::SurfaceBit::FINE_GRAVEL) | UNPAVED},
      {"gravel", types::SurfacePrimary::GRAVEL,
       types::bit(types::SurfaceBit::GRAVEL) | UNPAVED},
      {"ground", types::SurfacePrimary::GROUND,
       types::bit(types::SurfaceBit::GROUND) | UNPAVED},
      {"dirt", types::SurfacePrimary::DIRT,
       types::bit(types::SurfaceBit::DIRT) | UNPAVED},
      {"earth", types::SurfacePrimary::EARTH,
       types::bit(types::SurfaceBit::EARTH) | UNPAVED},
      {"paved", types::SurfacePrimary::UNKNOWN, PAVED},
      {"unpaved", types::SurfacePrimary::UNKNOWN, UNPAVED},
  }};

  static void fromTag(const char* surfaceVal, types::SurfacePrimary& primaryOut,
                      types::SurfaceMask& flagsOut)
  {
    if (!surfaceVal || !*surfaceVal)
    {
      primaryOut = types::SurfacePrimary::UNKNOWN;
      flagsOut = UNKNOWN;
      return;
    }
    const std::string_view key{surfaceVal};
    // 15 items → linear search is fine
    auto it = std::find_if(kEntries.begin(), kEntries.end(),
                           [&](const Entry& e) { return e.key == key; });
    if (it != kEntries.end())
    {
      primaryOut = it->primary;
      flagsOut = it->flags;
    } else
    {
      primaryOut = types::SurfacePrimary::UNKNOWN;
      flagsOut = UNKNOWN;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Way metadata (access + surfaces)
// ─────────────────────────────────────────────────────────────────────────────
struct WayMeta
{
  bool bikeFwd{false}, bikeBack{false};
  bool footFwd{false}, footBack{false};
  types::SurfacePrimary primary = types::SurfacePrimary::UNKNOWN;
  types::SurfaceMask flags = types::bit(types::SurfaceBit::UNKNOWN);
};

static inline bool isYes(const char* v)
{
  return v &&
         (std::strcmp(v, "yes") == 0 || std::strcmp(v, "designated") == 0 ||
          std::strcmp(v, "permissive") == 0);
}

static inline bool isNo(const char* v)
{
  return v && (std::strcmp(v, "no") == 0 || std::strcmp(v, "private") == 0);
}

struct WayCollector : public osmium::handler::Handler
{
  std::unordered_map<uint64_t, std::vector<uint64_t>>& wayIdNodeIdsMap;
  std::unordered_map<uint64_t, WayMeta>& wayIdWayMetaMap;

  static inline const std::unordered_set<std::string_view> kBikeHighways{
      "cycleway",  "path",     "residential",  "service",
      "secondary", "tertiary", "unclassified", "track"};
  static inline const std::unordered_set<std::string_view> kFootHighways{
      "footway",     "path",    "pedestrian",   "steps",
      "residential", "service", "living_street"};

  WayCollector(
      std::unordered_map<uint64_t, std::vector<uint64_t>>& wayIdNodeIdsMapIn,
      std::unordered_map<uint64_t, WayMeta>& wayMetaMapIn)
      : wayIdNodeIdsMap(wayIdNodeIdsMapIn), wayIdWayMetaMap(wayMetaMapIn)
  {}

  void way(const osmium::Way& way)
  {
    const auto& tags = way.tags();
    const char* highwayVal = tags.get_value_by_key("highway");
    const char* accVal = tags.get_value_by_key("access");
    const char* bicycleVal = tags.get_value_by_key("bicycle");
    const char* footVal = tags.get_value_by_key("foot");

    bool candidate_bike =
        (highwayVal && kBikeHighways.count(highwayVal)) || isYes(bicycleVal);
    bool candidate_foot =
        (highwayVal && kFootHighways.count(highwayVal)) || isYes(footVal);

    if (isNo(accVal) && !isYes(bicycleVal) && !isYes(footVal)) return;
    if (!candidate_bike && !candidate_foot) return;

    WayMeta wayMeta;
    SurfaceMaps::fromTag(tags.get_value_by_key("surface"), wayMeta.primary,
                         wayMeta.flags);

    bool bike_allowed = !isNo(bicycleVal) && candidate_bike;
    bool foot_allowed =
        !isNo(footVal) && (candidate_foot || !highwayVal ||
                           std::strcmp(highwayVal, "motorway") != 0);

    if (bicycleVal && std::strcmp(bicycleVal, "dismount") == 0)
      bike_allowed = false;

    bool fwd{true}, back{true};
    const char* isOneWay = tags.get_value_by_key("oneway");
    const char* isJunct = tags.get_value_by_key("junction");
    if ((isOneWay && (std::strcmp(isOneWay, "yes") == 0 ||
                      std::strcmp(isOneWay, "1") == 0)) ||
        (isJunct && std::strcmp(isJunct, "roundabout") == 0))
    {
      fwd = true;
      back = false;
    } else if (isOneWay && std::strcmp(isOneWay, "-1") == 0)
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
    wayMeta.footFwd = foot_allowed;  // foot generally two-way
    wayMeta.footBack = foot_allowed;

    auto& vec = wayIdNodeIdsMap[way.id()];
    vec.reserve(way.nodes().size());
    for (const auto& node : way.nodes())
    {
      vec.push_back(node.ref());
    }

    wayIdWayMetaMap[way.id()] = wayMeta;
  }
};

struct NodeCollector : public osmium::handler::Handler
{
  std::unordered_set<uint64_t> neededNodeIds;
  std::unordered_map<uint64_t, std::pair<float, float>>& nodeIdCoordMap;
  NodeCollector(std::unordered_set<uint64_t> n,
                std::unordered_map<uint64_t, std::pair<float, float>>& c)
      : neededNodeIds(std::move(n)), nodeIdCoordMap(c)
  {}
  void node(const osmium::Node& node)
  {
    uint64_t id = node.id();
    if (neededNodeIds.count(id))
      nodeIdCoordMap[id] = {(float)node.location().lat(), (float)node.location().lon()};
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Writers
// ─────────────────────────────────────────────────────────────────────────────
static void writeGraphNodesBin(
    const std::vector<uint64_t>& allNodeIds,
    const std::unordered_map<uint64_t, std::pair<float, float>>& nodeIdCoordMap)
{
  NodesHeader hdr;
  hdr.numNodes = (uint32_t)allNodeIds.size();
  hdr.coordType = 0;  // float32 deg

  std::ofstream out("../../data/graph_nodes.bin", std::ios::binary);
  if (!out) throw std::runtime_error("Cannot open graph_nodes.bin for write");

  out.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));

  // ids[N]
  out.write(reinterpret_cast<const char*>(allNodeIds.data()),
            allNodeIds.size() * sizeof(uint64_t));

  // lat[N], lon[N]
  std::vector<float> lat(allNodeIds.size()), lon(allNodeIds.size());
  for (size_t i = 0; i < allNodeIds.size(); ++i)
  {
    auto it = nodeIdCoordMap.find(allNodeIds[i]);
    if (it == nodeIdCoordMap.end())
      throw std::runtime_error("missing coord for node id");
    lat[i] = it->second.first;
    lon[i] = it->second.second;
  }
  out.write(reinterpret_cast<const char*>(lat.data()),
            lat.size() * sizeof(float));
  out.write(reinterpret_cast<const char*>(lon.data()),
            lon.size() * sizeof(float));

  out.close();
  std::cout << "Wrote graph_nodes.bin (" << allNodeIds.size() << " nodes)\n";
}

static void writeGraphEdgesBin(uint32_t numNodes, uint32_t numEdges,
                               const std::vector<uint32_t>& offsets,
                               const std::vector<uint32_t>& neighbors,
                               const std::vector<float>& lengthsMeters,
                               const std::vector<uint16_t>& surfaceFlags,
                               const std::vector<uint8_t>& surfacePrimary,
                               const std::vector<uint8_t>& modeMasks)
{
  EdgesHeader hdr;
  hdr.numNodes = numNodes;
  hdr.numEdges = numEdges;
  hdr.hasSurfaceFlags = 1;
  hdr.hasSurfacePrimary = 1;
  hdr.hasModeMask = 1;
  hdr.lengthType = 0;

  std::ofstream out("../../data/graph_edges.bin", std::ios::binary);
  if (!out) throw std::runtime_error("Cannot open graph_edges.bin for write");

  out.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));

  // lengths block (for defensive parsing)
  uint32_t offsetsSize = (uint32_t)offsets.size();
  uint32_t neighborsSize = (uint32_t)neighbors.size();
  uint32_t lengthsSize = (uint32_t)lengthsMeters.size();
  uint32_t surfaceFlagsSize = (uint32_t)surfaceFlags.size();
  uint32_t surfacePrimarySize = (uint32_t)surfacePrimary.size();
  uint32_t modeMasksSize = (uint32_t)modeMasks.size();
  out.write(reinterpret_cast<const char*>(&offsetsSize), 4);
  out.write(reinterpret_cast<const char*>(&neighborsSize), 4);
  out.write(reinterpret_cast<const char*>(&lengthsSize), 4);
  out.write(reinterpret_cast<const char*>(&surfaceFlagsSize), 4);
  out.write(reinterpret_cast<const char*>(&surfacePrimarySize), 4);
  out.write(reinterpret_cast<const char*>(&modeMasksSize), 4);

  // arrays
  out.write(reinterpret_cast<const char*>(offsets.data()),
            offsetsSize * sizeof(uint32_t));
  out.write(reinterpret_cast<const char*>(neighbors.data()),
            neighborsSize * sizeof(uint32_t));
  out.write(reinterpret_cast<const char*>(lengthsMeters.data()),
            lengthsSize * sizeof(float));
  out.write(reinterpret_cast<const char*>(surfaceFlags.data()),
            surfaceFlagsSize * sizeof(uint16_t));
  out.write(reinterpret_cast<const char*>(surfacePrimary.data()),
            surfacePrimarySize * sizeof(uint8_t));
  out.write(reinterpret_cast<const char*>(modeMasks.data()),
            modeMasksSize * sizeof(uint8_t));

  out.close();
  std::cout << "Wrote graph_edges.bin (" << numEdges << " directed edges)\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: read PBF → build directed CSR with modes & surfaces
// ─────────────────────────────────────────────────────────────────────────────
int main(int argc, char* argv[])
{
  if (argc < 2)
  {
    std::cerr << "Usage: buildGraph <path-to-osm-pbf>\n";
    return 1;
  }
  const char* osmFile = argv[1];

  // wayIdNodeIdsMap: wayId -> node ID's
  std::unordered_map<uint64_t, std::vector<uint64_t>> wayIdNodeIdsMap;
  std::unordered_map<uint64_t, WayMeta> wayIdWayMetaMap;
  // WayCollector fills wayIdNodeIdsMap and wayIdWayMetaMap
  WayCollector wayCollector(wayIdNodeIdsMap, wayIdWayMetaMap);

  // Pass 1: collect candidate ways + metadata
  {
    osmium::io::Reader reader(osmFile);
    osmium::apply(reader, wayCollector);
    reader.close();
  }
  std::cout << "wayIdNodeIdsMap size: " << wayIdNodeIdsMap.size() << "\n";

  // Build set of needed nodes
  std::unordered_set<uint64_t> neededNodeIds;
  neededNodeIds.reserve(wayIdNodeIdsMap.size() * 4);
  for (const auto& [wayId, nodes] : wayIdNodeIdsMap)
  {
    (void)wayId;
    for (uint64_t id : nodes)
    {
      neededNodeIds.insert(id);
    }
  }
  std::cout << "Will collect coords for " << neededNodeIds.size()
            << " nodes.\n";

  // Pass 2: coordinates
  // nodeIdCoordMap: nodeId -> [lat, lon]
  std::unordered_map<uint64_t, std::pair<float, float>> nodeIdCoordMap;
  nodeIdCoordMap.reserve(neededNodeIds.size() * 2);
  {
    NodeCollector nodeCollector(std::move(neededNodeIds), nodeIdCoordMap);
    osmium::io::Reader reader(osmFile);
    osmium::apply(reader, nodeCollector);
    reader.close();
  }
  std::cout << "Collected " << nodeIdCoordMap.size() << " node coordinates.\n";

  // Assign compact indices 0..N-1
  std::vector<uint64_t> allNodeIds;
  allNodeIds.reserve(nodeIdCoordMap.size());
  // for (auto& kv : nodeIdCoordMap)
  for (const auto& [id, coord] : nodeIdCoordMap)
  {
    (void)coord;
    allNodeIds.push_back(id);
  }
  std::sort(allNodeIds.begin(), allNodeIds.end());
  const uint32_t numNodes = (uint32_t)allNodeIds.size();

  // nodeIdToIdx: id -> idx
  std::unordered_map<uint64_t, uint32_t> nodeIdToIdx;
  nodeIdToIdx.reserve(numNodes * 2);
  for (uint32_t i{0}; i < numNodes; ++i)
  {
    nodeIdToIdx[allNodeIds[i]] = i;
  }

  // Count directed edges
  std::vector<uint32_t> offsets(numNodes + 1, 0);
  auto inc = [&](uint32_t u) { offsets[u + 1]++; };

  for (const auto& [wayId, nodes] : wayIdNodeIdsMap)
  {
    const WayMeta& wayMeta = wayIdWayMetaMap[wayId];
    if (nodes.size() < 2) continue;
    for (size_t i{0}; i + 1 < nodes.size(); ++i)
    {
      uint64_t idU = nodes[i];
      uint64_t idV = nodes[i + 1];

      if (idU == idV) continue;
      auto itU = nodeIdToIdx.find(idU);
      if (itU == nodeIdToIdx.end()) continue;
      auto itV = nodeIdToIdx.find(idV);
      if (itV == nodeIdToIdx.end()) continue;
      uint32_t u = itU->second, v = itV->second;
      if (wayMeta.bikeFwd || wayMeta.footFwd)
      {
        inc(u);  // u->v
      }
      if (wayMeta.bikeBack || wayMeta.footBack)
      {
        inc(v);  // v->u
      }
    }
  }

  for (size_t i{1}; i <= numNodes; ++i)
  {
    offsets[i] += offsets[i - 1];
  }
  const uint32_t numEdges = offsets.back();

  // Prepare arrays
  std::vector<uint32_t> neighbors(numEdges);
  std::vector<float> lengthsMeters(numEdges);
  std::vector<uint16_t> surfaceFlags(numEdges);
  std::vector<uint8_t> surfacePrimary(numEdges);
  std::vector<uint8_t> modeMasks(numEdges);
  std::vector<uint32_t> cur = offsets;

  // Fill arrays
  for (const auto& [wayId, nodes] : wayIdNodeIdsMap)
  {
    if (nodes.size() < 2) continue;

    for (size_t i{0}; i + 1 < nodes.size(); ++i)
    {
      uint64_t idU = nodes[i];
      uint64_t idV = nodes[i + 1];

      if (idU == idV) continue;

      auto itU = nodeIdToIdx.find(idU);
      if (itU == nodeIdToIdx.end()) continue;
      auto itV = nodeIdToIdx.find(idV);
      if (itV == nodeIdToIdx.end()) continue;

      uint32_t idxU = itU->second;
      uint32_t idxV = itV->second;

      const auto coordU = nodeIdCoordMap.at(idU);
      const auto coord = nodeIdCoordMap.at(idV);
      const float dist = (float)haversineMeters(coordU.first, coordU.second,
                                                coord.first, coord.second);

      const WayMeta& wayMeta = wayIdWayMetaMap[wayId];
      if (wayMeta.bikeFwd || wayMeta.footFwd)
      {
        uint32_t idx = cur[idxU]++;
        neighbors[idx] = idxV;
        lengthsMeters[idx] = dist;
        surfaceFlags[idx] = (uint16_t)wayMeta.flags;
        surfacePrimary[idx] = (uint8_t)wayMeta.primary;
        uint8_t modeMask{0};
        if (wayMeta.bikeFwd)
        {
          modeMask |= (uint8_t)types::MODE_BIKE;  // must be 0x1
        }
        if (wayMeta.footFwd)
        {
          modeMask |= (uint8_t)types::MODE_FOOT;  // must be 0x2
        }
        modeMasks[idx] = modeMask;
      }
      if (wayMeta.bikeBack || wayMeta.footBack)
      {
        uint32_t idx = cur[idxV]++;
        neighbors[idx] = idxU;
        lengthsMeters[idx] = dist;
        surfaceFlags[idx] = (uint16_t)wayMeta.flags;
        surfacePrimary[idx] = (uint8_t)wayMeta.primary;
        uint8_t modeMask{0};
        if (wayMeta.bikeBack) modeMask |= (uint8_t)types::MODE_BIKE;
        if (wayMeta.footBack) modeMask |= (uint8_t)types::MODE_FOOT;
        modeMasks[idx] = modeMask;
      }
    }
  }

  // Write blobs
  writeGraphNodesBin(allNodeIds, nodeIdCoordMap);
  writeGraphEdgesBin(numNodes, numEdges, offsets, neighbors, lengthsMeters,
                     surfaceFlags, surfacePrimary, modeMasks);

  return 0;
}
