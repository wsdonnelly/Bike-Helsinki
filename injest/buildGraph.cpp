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
struct NodesHeader {
  char     magic[8]   = {'M','M','A','P','N','O','D','E'}; // "MMAPNODE"
  uint32_t version    = 1;
  uint32_t num_nodes  = 0;
  uint8_t  coord_type = 0;  // 0=float32 degrees
  uint8_t  reserved[3]{0,0,0};
};
static_assert(sizeof(NodesHeader) == 20, "NodesHeader must be 20 bytes");

struct EdgesHeader {
  char     magic[8]   = {'M','M','A','P','E','D','G','E'}; // "MMAPEDGE"
  uint32_t version    = 1;
  uint32_t num_nodes  = 0;
  uint32_t num_edges  = 0;  // directed edges
  uint8_t  has_surface_primary = 1; // now set to 1
  uint8_t  has_surface_flags   = 1; // now set to 1
  uint8_t  has_mode_mask       = 1; // now set to 1
  uint8_t  length_type         = 0; // 0=float32 meters
};
static_assert(sizeof(EdgesHeader) == 24, "EdgesHeader must be 24 bytes");

// ─────────────────────────────────────────────────────────────────────────────
// Haversine
// ─────────────────────────────────────────────────────────────────────────────
static inline double haversine(double lat1, double lon1, double lat2, double lon2) {
  constexpr double kPi = 3.14159265358979323846;
  constexpr double kR  = 6371000.0;
  auto toRad = [&](double deg) { return deg * kPi / 180.0; };
  const double dLat = toRad(lat2 - lat1);
  const double dLon = toRad(lon2 - lon1);
  const double a = std::sin(dLat/2)*std::sin(dLat/2) +
                   std::cos(toRad(lat1))*std::cos(toRad(lat2)) *
                   std::sin(dLon/2)*std::sin(dLon/2);
  const double c = 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
  return kR * c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface mapping (OSM tag → primary + flags)
// ─────────────────────────────────────────────────────────────────────────────
struct SurfaceMaps {
  static inline const types::SurfaceMask PAVED   = types::bit(types::SurfaceBit::PAVED);
  static inline const types::SurfaceMask UNPAVED = types::bit(types::SurfaceBit::UNPAVED);
  static inline const types::SurfaceMask UNKNOWN = types::bit(types::SurfaceBit::UNKNOWN);

  struct Entry { const char* key; types::SurfacePrimary primary; types::SurfaceMask flags; };
  static inline const Entry k[] = {
    {"asphalt",           types::SurfacePrimary::ASPHALT,            types::bit(types::SurfaceBit::ASPHALT)            | PAVED},
    {"concrete",          types::SurfacePrimary::CONCRETE,           types::bit(types::SurfaceBit::CONCRETE)           | PAVED},
    {"paving_stones",     types::SurfacePrimary::PAVING_STONES,      types::bit(types::SurfaceBit::PAVING_STONES)      | PAVED},
    {"sett",              types::SurfacePrimary::SETT,               types::bit(types::SurfaceBit::SETT)               | PAVED},
    {"unhewn_cobblestones", types::SurfacePrimary::UNHEWN_COBBLESTONES, types::bit(types::SurfaceBit::UNHEWN_COBBLESTONES) | PAVED},
    {"cobblestones",      types::SurfacePrimary::COBBLESTONES,       types::bit(types::SurfaceBit::COBBLESTONES)       | PAVED},
    {"bricks",            types::SurfacePrimary::BRICKS,             types::bit(types::SurfaceBit::BRICKS)             | PAVED},
    {"compacted",         types::SurfacePrimary::COMPACTED,          types::bit(types::SurfaceBit::COMPACTED)          | UNPAVED},
    {"fine_gravel",       types::SurfacePrimary::FINE_GRAVEL,        types::bit(types::SurfaceBit::FINE_GRAVEL)        | UNPAVED},
    {"gravel",            types::SurfacePrimary::GRAVEL,             types::bit(types::SurfaceBit::GRAVEL)             | UNPAVED},
    {"ground",            types::SurfacePrimary::GROUND,             types::bit(types::SurfaceBit::GROUND)             | UNPAVED},
    {"dirt",              types::SurfacePrimary::DIRT,               types::bit(types::SurfaceBit::DIRT)               | UNPAVED},
    {"earth",             types::SurfacePrimary::EARTH,              types::bit(types::SurfaceBit::EARTH)              | UNPAVED},
    {"paved",             types::SurfacePrimary::UNKNOWN,            PAVED},
    {"unpaved",           types::SurfacePrimary::UNKNOWN,            UNPAVED},
  };

  static inline void from_tag(const char* sv, types::SurfacePrimary& primary_out, types::SurfaceMask& flags_out) {
    if (!sv) { primary_out = types::SurfacePrimary::UNKNOWN; flags_out = UNKNOWN; return; }
    for (const auto& e : k) {
      if (std::strcmp(sv, e.key) == 0) { primary_out = e.primary; flags_out = e.flags; return; }
    }
    primary_out = types::SurfacePrimary::UNKNOWN; flags_out = UNKNOWN;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Way metadata (access + surfaces)
// ─────────────────────────────────────────────────────────────────────────────
struct WayMeta {
  bool bike_fwd{false}, bike_back{false};
  bool foot_fwd{false}, foot_back{false};
  types::SurfacePrimary primary = types::SurfacePrimary::UNKNOWN;
  types::SurfaceMask flags = types::bit(types::SurfaceBit::UNKNOWN);
};

static inline bool is_yes(const char* v) {
  return v && (std::strcmp(v,"yes")==0 || std::strcmp(v,"designated")==0 || std::strcmp(v,"permissive")==0);
}
static inline bool is_no(const char* v) {
  return v && (std::strcmp(v,"no")==0 || std::strcmp(v,"private")==0);
}

struct WayCollector : public osmium::handler::Handler {
  std::unordered_map<uint64_t, std::vector<uint64_t>>& way_nodes;
  std::unordered_map<uint64_t, WayMeta>& way_meta;

  static inline const std::unordered_set<std::string_view> kBikeHighways{
    "cycleway","path","residential","service","secondary","tertiary","unclassified","track"
  };
  static inline const std::unordered_set<std::string_view> kFootHighways{
    "footway","path","pedestrian","steps","residential","service","living_street"
  };

  WayCollector(std::unordered_map<uint64_t, std::vector<uint64_t>>& wn,
               std::unordered_map<uint64_t, WayMeta>& wm)
  : way_nodes(wn), way_meta(wm) {}

  void way(const osmium::Way& w) {
    const auto& tags = w.tags();
    const char* hv  = tags.get_value_by_key("highway");
    const char* acc = tags.get_value_by_key("access");
    const char* bv  = tags.get_value_by_key("bicycle");
    const char* fv  = tags.get_value_by_key("foot");

    bool candidate_bike = (hv && kBikeHighways.count(hv)) || is_yes(bv);
    bool candidate_foot = (hv && kFootHighways.count(hv)) || is_yes(fv);

    if (is_no(acc) && !is_yes(bv) && !is_yes(fv)) return;
    if (!candidate_bike && !candidate_foot) return;

    WayMeta meta;
    SurfaceMaps::from_tag(tags.get_value_by_key("surface"), meta.primary, meta.flags);

    bool bike_allowed = !is_no(bv) && candidate_bike;
    bool foot_allowed = !is_no(fv) && (candidate_foot || !hv || std::strcmp(hv,"motorway")!=0);

    if (bv && std::strcmp(bv,"dismount")==0) bike_allowed = false;

    bool fwd{true}, back{true};
    const char* isOneWay  = tags.get_value_by_key("oneway");
    const char* isJunct   = tags.get_value_by_key("junction");
    if ((isOneWay && (std::strcmp(isOneWay,"yes")==0 || std::strcmp(isOneWay,"1")==0)) ||
        (isJunct && std::strcmp(isJunct,"roundabout")==0)) { fwd=true; back=false; }
    else if (isOneWay && std::strcmp(isOneWay,"-1")==0) { fwd=false; back=true; }

    const char* ow_bike  = tags.get_value_by_key("oneway:bicycle");
    const char* cycleway = tags.get_value_by_key("cycleway");
    if (ow_bike && std::strcmp(ow_bike,"no")==0) { fwd=true; back=true; }
    if (cycleway && (std::strcmp(cycleway,"opposite")==0 ||
                     std::strcmp(cycleway,"opposite_lane")==0 ||
                     std::strcmp(cycleway,"opposite_track")==0)) { fwd=true; back=true; }

    meta.bike_fwd = bike_allowed && fwd;
    meta.bike_back = bike_allowed && back;
    meta.foot_fwd = foot_allowed;   // foot generally two-way
    meta.foot_back = foot_allowed;

    auto& vec = way_nodes[w.id()];
    vec.reserve(w.nodes().size());
    for (const auto& n : w.nodes()) vec.push_back(n.ref());

    way_meta[w.id()] = meta;
  }
};

struct NodeCollector : public osmium::handler::Handler {
  std::unordered_set<uint64_t> needed;
  std::unordered_map<uint64_t, std::pair<float,float>>& coords;
  NodeCollector(std::unordered_set<uint64_t> n,
                std::unordered_map<uint64_t, std::pair<float,float>>& c)
  : needed(std::move(n)), coords(c) {}
  void node(const osmium::Node& node) {
    uint64_t id = node.id();
    if (needed.count(id)) coords[id] = { (float)node.location().lat(), (float)node.location().lon() };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Writers
// ─────────────────────────────────────────────────────────────────────────────
static void writeGraphNodesBin(const std::vector<uint64_t>& allNodeIds,
                               const std::unordered_map<uint64_t, std::pair<float,float>>& nodeCoordMap)
{
  NodesHeader hdr;
  hdr.num_nodes = (uint32_t)allNodeIds.size();
  hdr.coord_type = 0; // float32 deg

  std::ofstream out("../../data/graph_nodes.bin", std::ios::binary);
  if (!out) throw std::runtime_error("Cannot open graph_nodes.bin for write");

  out.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));

  // ids[N]
  out.write(reinterpret_cast<const char*>(allNodeIds.data()),
            allNodeIds.size()*sizeof(uint64_t));

  // lat[N], lon[N]
  std::vector<float> lat(allNodeIds.size()), lon(allNodeIds.size());
  for (size_t i=0;i<allNodeIds.size();++i) {
    auto it = nodeCoordMap.find(allNodeIds[i]);
    if (it == nodeCoordMap.end()) throw std::runtime_error("missing coord for node id");
    lat[i] = it->second.first;
    lon[i] = it->second.second;
  }
  out.write(reinterpret_cast<const char*>(lat.data()), lat.size()*sizeof(float));
  out.write(reinterpret_cast<const char*>(lon.data()), lon.size()*sizeof(float));

  out.close();
  std::cout << "Wrote graph_nodes.bin (" << allNodeIds.size() << " nodes)\n";
}

static void writeGraphEdgesBin(uint32_t numNodes, uint32_t numEdges,
                               const std::vector<uint32_t>& offsets,
                               const std::vector<uint32_t>& neighbors,
                               const std::vector<float>& lengths_m,
                               const std::vector<uint16_t>& surface_flags,
                               const std::vector<uint8_t>& surface_primary,
                               const std::vector<uint8_t>& mode_mask)
{
  EdgesHeader hdr;
  hdr.num_nodes = numNodes;
  hdr.num_edges = numEdges;
  hdr.has_surface_flags   = 1;
  hdr.has_surface_primary = 1;
  hdr.has_mode_mask       = 1;
  hdr.length_type         = 0;

  std::ofstream out("../../data/graph_edges.bin", std::ios::binary);
  if (!out) throw std::runtime_error("Cannot open graph_edges.bin for write");

  out.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));

  // lengths block (for defensive parsing)
  uint32_t L_off = (uint32_t)offsets.size();
  uint32_t L_nei = (uint32_t)neighbors.size();
  uint32_t L_len = (uint32_t)lengths_m.size();
  uint32_t L_fl  = (uint32_t)surface_flags.size();
  uint32_t L_pri = (uint32_t)surface_primary.size();
  uint32_t L_mm  = (uint32_t)mode_mask.size();
  out.write(reinterpret_cast<const char*>(&L_off), 4);
  out.write(reinterpret_cast<const char*>(&L_nei), 4);
  out.write(reinterpret_cast<const char*>(&L_len), 4);
  out.write(reinterpret_cast<const char*>(&L_fl),  4);
  out.write(reinterpret_cast<const char*>(&L_pri), 4);
  out.write(reinterpret_cast<const char*>(&L_mm),  4);

  // arrays
  out.write(reinterpret_cast<const char*>(offsets.data()),       L_off*sizeof(uint32_t));
  out.write(reinterpret_cast<const char*>(neighbors.data()),     L_nei*sizeof(uint32_t));
  out.write(reinterpret_cast<const char*>(lengths_m.data()),     L_len*sizeof(float));
  out.write(reinterpret_cast<const char*>(surface_flags.data()), L_fl *sizeof(uint16_t));
  out.write(reinterpret_cast<const char*>(surface_primary.data()), L_pri*sizeof(uint8_t));
  out.write(reinterpret_cast<const char*>(mode_mask.data()),     L_mm *sizeof(uint8_t));

  out.close();
  std::cout << "Wrote graph_edges.bin (" << numEdges << " directed edges)\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: read PBF → build directed CSR with modes & surfaces
// ─────────────────────────────────────────────────────────────────────────────
int main(int argc, char* argv[])
{
  if (argc < 2) { std::cerr << "Usage: buildGraph <path-to-osm-pbf>\n"; return 1; }
  const char* osmFile = argv[1];

  std::unordered_map<uint64_t, std::vector<uint64_t>> wayNodesMap;
  std::unordered_map<uint64_t, WayMeta> wayMetaMap;
  WayCollector wc(wayNodesMap, wayMetaMap);

  // Pass 1: collect candidate ways + metadata
  {
    osmium::io::Reader r(osmFile);
    osmium::apply(r, wc);
    r.close();
  }
  std::cout << "wayNodesMap size: " << wayNodesMap.size() << "\n";

  // Build set of needed nodes
  std::unordered_set<uint64_t> neededNodeIds;
  neededNodeIds.reserve(wayNodesMap.size() * 4);
  for (const auto& [wayId, nodes] : wayNodesMap) {
    (void)wayId;
    for (uint64_t id : nodes) neededNodeIds.insert(id);
  }
  std::cout << "Will collect coords for " << neededNodeIds.size() << " nodes.\n";

  // Pass 2: coordinates
  std::unordered_map<uint64_t, std::pair<float,float>> nodeCoordMap;
  nodeCoordMap.reserve(neededNodeIds.size() * 2);
  {
    NodeCollector nc(std::move(neededNodeIds), nodeCoordMap);
    osmium::io::Reader r(osmFile);
    osmium::apply(r, nc);
    r.close();
  }
  std::cout << "Collected " << nodeCoordMap.size() << " node coordinates.\n";

  // Assign compact indices 0..N-1
  std::vector<uint64_t> allNodeIds; allNodeIds.reserve(nodeCoordMap.size());
  for (auto& kv : nodeCoordMap) allNodeIds.push_back(kv.first);
  std::sort(allNodeIds.begin(), allNodeIds.end());
  const uint32_t numNodes = (uint32_t)allNodeIds.size();

  std::unordered_map<uint64_t, uint32_t> nodeIdToIdx;
  nodeIdToIdx.reserve(numNodes * 2);
  for (uint32_t i=0;i<numNodes;++i) nodeIdToIdx[allNodeIds[i]] = i;

  // Count directed edges
  std::vector<uint32_t> offsets(numNodes + 1, 0);
  auto inc = [&](uint32_t u){ offsets[u + 1]++; };

  for (const auto& [wayId, nodes] : wayNodesMap) {
    const WayMeta& m = wayMetaMap[wayId];
    if (nodes.size() < 2) continue;
    for (size_t i=0;i+1<nodes.size();++i) {
      uint64_t id_u = nodes[i], id_v = nodes[i+1];
      if (id_u == id_v) continue;
      auto itU = nodeIdToIdx.find(id_u); if (itU==nodeIdToIdx.end()) continue;
      auto itV = nodeIdToIdx.find(id_v); if (itV==nodeIdToIdx.end()) continue;
      uint32_t u = itU->second, v = itV->second;
      if (m.bike_fwd || m.foot_fwd) inc(u); // u->v
      if (m.bike_back || m.foot_back) inc(v); // v->u
    }
  }
  for (size_t i=1;i<=numNodes;++i) offsets[i] += offsets[i-1];
  const uint32_t numEdges = offsets.back();

  // Prepare arrays
  std::vector<uint32_t> neighbors(numEdges);
  std::vector<float>    lengths_m(numEdges);
  std::vector<uint16_t> surface_flags(numEdges);
  std::vector<uint8_t>  surface_primary(numEdges);
  std::vector<uint8_t>  mode_mask(numEdges);
  std::vector<uint32_t> cur = offsets;

  // Fill arrays
  for (const auto& [wayId, nodes] : wayNodesMap) {
    const WayMeta& m = wayMetaMap[wayId];
    if (nodes.size() < 2) continue;

    for (size_t i=0;i+1<nodes.size();++i) {
      uint64_t id_u = nodes[i], id_v = nodes[i+1];
      if (id_u == id_v) continue;

      auto itU = nodeIdToIdx.find(id_u); if (itU==nodeIdToIdx.end()) continue;
      auto itV = nodeIdToIdx.find(id_v); if (itV==nodeIdToIdx.end()) continue;
      uint32_t u = itU->second, v = itV->second;

      const auto cu = nodeCoordMap.at(id_u);
      const auto cv = nodeCoordMap.at(id_v);
      const float dist = (float)haversine(cu.first, cu.second, cv.first, cv.second);

      if (m.bike_fwd || m.foot_fwd) {
        uint32_t idx = cur[u]++;
        neighbors[idx] = v;
        lengths_m[idx] = dist;
        surface_flags[idx]   = (uint16_t)m.flags;
        surface_primary[idx] = (uint8_t)m.primary;
        uint8_t mm = 0;
        if (m.bike_fwd) mm |= (uint8_t)types::MODE_BIKE; // must be 0x1
        if (m.foot_fwd) mm |= (uint8_t)types::MODE_FOOT; // must be 0x2
        mode_mask[idx] = mm;
      }
      if (m.bike_back || m.foot_back) {
        uint32_t idx = cur[v]++;
        neighbors[idx] = u;
        lengths_m[idx] = dist;
        surface_flags[idx]   = (uint16_t)m.flags;
        surface_primary[idx] = (uint8_t)m.primary;
        uint8_t mm = 0;
        if (m.bike_back) mm |= (uint8_t)types::MODE_BIKE;
        if (m.foot_back) mm |= (uint8_t)types::MODE_FOOT;
        mode_mask[idx] = mm;
      }
    }
  }

  // Write blobs
  writeGraphNodesBin(allNodeIds, nodeCoordMap);
  writeGraphEdgesBin(numNodes, numEdges, offsets, neighbors, lengths_m,
                     surface_flags, surface_primary, mode_mask);

  return 0;
}
