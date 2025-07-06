#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <osmium/handler.hpp>
#include <osmium/io/any_input.hpp>
#include <osmium/osm/node.hpp>
#include <osmium/osm/way.hpp>
#include <osmium/visitor.hpp>
#include <string_view>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

// Format: [uint32 numNodes] [for i in 0..numNodes-1: uint64 nodeId_i][float32 lat_i][float32 lon_i]
void writeGraphNodesBin(size_t numNodeIds, const std::vector<uint64_t>& allNodeIds,
                        const std::unordered_map<uint64_t, std::pair<float, float>>& nodeCoordMap)
{
    std::ofstream out("../../data/graph_nodes.bin", std::ios::binary);
    uint32_t n_nodes = static_cast<uint32_t>(numNodeIds);
    out.write(reinterpret_cast<const char*>(&n_nodes), sizeof(n_nodes));
    for (uint32_t i{0}; i < numNodeIds; ++i)
    {
        uint64_t nodeId = allNodeIds[i];
        auto [lat, lon] = nodeCoordMap.at(nodeId);
        out.write(reinterpret_cast<const char*>(&nodeId), sizeof(nodeId));
        out.write(reinterpret_cast<const char*>(&lat), sizeof(lat));
        out.write(reinterpret_cast<const char*>(&lon), sizeof(lon));
    }
    out.close();
    std::cout << "Wrote graph_nodes.bin (" << numNodeIds << " nodes)\n";
};

// Format: [uint32 numNodeIds][uint32 edgeCount] [ offsets[0..numNodeIds] (uint32 each) ]
// neighbors[0..edgeCount-1] (uint32) ] [ weights[0..edgeCount-1] (float32) ]
void writeGraphEdgesBin(size_t numNodeIds, size_t edgeCount, const std::vector<uint32_t>& offsets,
                        const std::vector<uint32_t>& neighbors, const std::vector<float>& weights)
{
    std::ofstream out("../../data/graph_edges.bin", std::ios::binary);
    uint32_t n_nodes = static_cast<uint32_t>(numNodeIds);
    uint32_t m_edges = static_cast<uint32_t>(edgeCount);
    out.write(reinterpret_cast<const char*>(&n_nodes), sizeof(n_nodes));
    out.write(reinterpret_cast<const char*>(&m_edges), sizeof(m_edges));
    // write offsets array
    for (uint32_t i{0}; i < offsets.size(); ++i)
    {
        uint32_t val = offsets[i];
        out.write(reinterpret_cast<const char*>(&val), sizeof(val));
    }
    // write neighbors
    for (uint32_t i{0}; i < neighbors.size(); ++i)
    {
        uint32_t v = neighbors[i];
        out.write(reinterpret_cast<const char*>(&v), sizeof(v));
    }
    // write weights
    for (uint32_t i{0}; i < weights.size(); ++i)
    {
        float w = weights[i];
        out.write(reinterpret_cast<const char*>(&w), sizeof(w));
    }
    out.close();
    std::cout << "Wrote graph_edges.bin (" << m_edges << " directed edges)\n";
};

// Handler for collecting bike-friendly ways
// struct WayCollector : public osmium::handler::Handler
// {
//   std::unordered_map<uint64_t, std::vector<uint64_t>>& wayNodesMap;

//   WayCollector(std::unordered_map<uint64_t, std::vector<uint64_t>>&
//   wayNodesMap) :
//       wayNodesMap(wayNodesMap) {}

//   void way(const osmium::Way& way)
//   {
//     const auto& tags = way.tags();
//     const char* hv = tags.get_value_by_key("highway");
//     const char* bv = tags.get_value_by_key("bicycle");

//     if ((hv  != nullptr && std::strcmp(hv, "cycleway") == 0) ||
//         (bv  != nullptr && std::strcmp(bv, "yes")      == 0))
//     {
//         // wayNodesMap[way.id()] = std::vector<uint64_t>();
//         auto& vec = wayNodesMap[way.id()];
//         vec.reserve(way.nodes().size());
//         for (auto& n : way.nodes())
//         {
//           // wayNodesMap[way.id()].push_back(n.ref());
//           vec.push_back(n.ref());
//         }
//     }
//   }
// };

// EXTENDED
//  Handler for collecting bike-friendly ways
struct WayCollector : public osmium::handler::Handler
{
    std::unordered_map<uint64_t, std::vector<uint64_t>>& wayNodesMap;

    // Allowed highway types for cycling
    // can be constexpr???
    static inline const std::unordered_set<std::string_view> kAllowedHighways{
        "cycleway",    // dedicated cycleway
        "path",        // generic path
        "residential", // quiet streets
        "service",     // service roads (e.g. parking lanes)
        "secondary",   // larger roads that may have bike lanes
        "tertiary",    "unclassified", "track"};

    // Allowed bicycle tag values
    // can be constexpr???
    static inline const std::unordered_set<std::string_view> kAllowedBicycle{"yes", "designated", "permissive"};

    WayCollector(std::unordered_map<uint64_t, std::vector<uint64_t>>& wayNodesMap) : wayNodesMap(wayNodesMap)
    {
    }

    void way(const osmium::Way& way)
    {
        const auto& tags = way.tags();
        const char* hv = tags.get_value_by_key("highway");
        const char* bv = tags.get_value_by_key("bicycle");

        bool highway_ok = hv && kAllowedHighways.count(hv);
        bool bicycle_ok = bv && kAllowedBicycle.count(bv);

        if (highway_ok || bicycle_ok)
        {
            auto& vec = wayNodesMap[way.id()];
            vec.reserve(way.nodes().size());
            for (auto& n : way.nodes())
            {
                vec.push_back(n.ref());
            }
        }
    }
};

// Handler for collecting needed nodes
struct NodeCollector : public osmium::handler::Handler
{
    std::unordered_set<uint64_t> neededNodeIds;
    std::unordered_map<uint64_t, std::pair<float, float>>& nodeCoordMap;

    NodeCollector(std::unordered_set<uint64_t> neededNodeIds,
                  std::unordered_map<uint64_t, std::pair<float, float>>& nodeCoordMap)
        : neededNodeIds(std::move(neededNodeIds)), nodeCoordMap(nodeCoordMap)
    {
    }

    void node(const osmium::Node& node)
    {
        uint64_t id = node.id();
        if (neededNodeIds.count(id))
        {
            nodeCoordMap[id] = {static_cast<float>(node.location().lat()), static_cast<float>(node.location().lon())};
        }
    }
};

double haversine(double lat1, double lon1, double lat2, double lon2)
{
    constexpr double kPi{3.14159265358979323846};
    constexpr double kEarthRadiusMeters{6371000.0};

    // Convert degrees to radians
    double lat1Rad = lat1 * kPi / 180.0;
    double lat2Rad = lat2 * kPi / 180.0;
    double deltaLatRad = (lat2 - lat1) * kPi / 180.0;
    double deltaLonRad = (lon2 - lon1) * kPi / 180.0;

    // Apply the haversine formula
    double sinHalfDeltaLat = std::sin(deltaLatRad / 2.0);
    double sinHalfDeltaLon = std::sin(deltaLonRad / 2.0);

    double haversineValue =
        sinHalfDeltaLat * sinHalfDeltaLat + std::cos(lat1Rad) * std::cos(lat2Rad) * sinHalfDeltaLon * sinHalfDeltaLon;

    double centralAngle = 2.0 * std::atan2(std::sqrt(haversineValue), std::sqrt(1.0 - haversineValue));

    return kEarthRadiusMeters * centralAngle;
}

int main(int argc, char* argv[])
{
    if (argc < 2)
    {
        std::cerr << "Usage: buildGraph <path-to-osm-pbf>\n";
        return 1;
    }
    const char* osmFile = argv[1];

    // unordered_map<uint64_t unique way id, std::vector<uint64_t ordered list of
    // node id belonging to that way >> wayNodesMap;
    std::unordered_map<uint64_t, std::vector<uint64_t>> wayNodesMap;
    WayCollector wc(wayNodesMap);

    // ─── Pass 1: Collect bike-friendly ways ──────────────────────────────
    osmium::io::Reader readerPassOne(osmFile);
    osmium::apply(readerPassOne, wc);
    readerPassOne.close();

    std::cout << "wayNodesMap size: " << wayNodesMap.size() << "\n";

    // ─── Pass 2: Collect node coordinates ────────────────────────────────
    // Build neededNodeIds
    std::unordered_set<uint64_t> neededNodeIds;
    for (auto& [wayId, nodesList] : wayNodesMap)
    {
        for (uint64_t nodeId : nodesList)
        {
            neededNodeIds.insert(nodeId);
        }
    }
    std::cout << "Will collect coords for " << neededNodeIds.size() << " nodes.\n";

    // unordered_map<uint64_t nodeID, std::pair<float lat, float lon>>
    // nodeCoordMap
    std::unordered_map<uint64_t, std::pair<float, float>> nodeCoordMap;
    NodeCollector nc(std::move(neededNodeIds), nodeCoordMap);

    osmium::io::Reader readerPassTwo(osmFile);
    osmium::apply(readerPassTwo, nc);
    readerPassTwo.close();

    std::cout << "Collected " << nodeCoordMap.size() << " node coordinates.\n";

    // ─── Build adjacency in memory ────────────────────────────────────────
    // First, assign a 0..N-1 index to each nodeId for compact arrays:
    std::vector<uint64_t> allNodeIds;
    allNodeIds.reserve(nodeCoordMap.size());
    for (auto& [nodeId, coords] : nodeCoordMap)
    {
        allNodeIds.push_back(nodeId);
    }
    std::sort(allNodeIds.begin(), allNodeIds.end());
    size_t numNodeIds = allNodeIds.size();

    // Map nodeId → idx (0..numNodeIds-1)
    std::unordered_map<uint64_t, uint32_t> nodeIdToIdx;
    nodeIdToIdx.reserve(numNodeIds);
    for (uint32_t i{0}; i < numNodeIds; ++i)
    {
        nodeIdToIdx[allNodeIds[i]] = i;
    }

    // Prepare adjacency offsets (CSR format)
    // Count total edges first
    size_t edgeCount{0};
    for (auto& [wayId, nodesList] : wayNodesMap)
    {
        for (size_t i{0}; i + 1 < nodesList.size(); ++i)
        {
            // add both directions
            edgeCount += 2;
        }
    }

    // CSR arrays:
    //   vector<uint32_t> offsets(N+1);  // offsets[i] = start index in "edges"
    //   vector<uint32_t> neighbors(edgeCount);
    //   vector<float>    weights(edgeCount);

    std::vector<uint32_t> offsets(numNodeIds + 1, 0);
    // First pass: count degree(u) for each u
    for (auto& [wayId, nodeList] : wayNodesMap)
    {
        for (size_t i{0}; i + 1 < nodeList.size(); ++i)
        {
            uint32_t u = nodeIdToIdx.at(nodeList[i]);
            uint32_t v = nodeIdToIdx.at(nodeList[i + 1]);
            offsets[u + 1] += 1;
            offsets[v + 1] += 1; // bidirectional
        }
    }
    // Prefix sum to get final offsets
    for (size_t i = 1; i <= numNodeIds; ++i)
    {
        offsets[i] += offsets[i - 1];
    }

    std::vector<uint32_t> neighbors(edgeCount);
    std::vector<float> weights(edgeCount);
    // To fill neighbors/weights, copy offsets to a temp array we can increment
    std::vector<uint32_t> currentPos = offsets;

    // Second pass: actually fill in neighbors/weights
    for (const auto& [_, nodeList] : wayNodesMap)
    {
        for (size_t i{0}; i < nodeList.size() - 1; ++i)
        {
            uint64_t id_u = nodeList[i];
            uint64_t id_v = nodeList[i + 1];
            auto [lat_u, lon_u] = nodeCoordMap[id_u];
            auto [lat_v, lon_v] = nodeCoordMap[id_v];
            float dist = static_cast<float>(haversine(lat_u, lon_u, lat_v, lon_v));

            uint32_t u = nodeIdToIdx[id_u];
            uint32_t v = nodeIdToIdx[id_v];
            // u → v
            size_t idx_uv = currentPos[u]++;
            neighbors[idx_uv] = v;
            weights[idx_uv] = dist;
            // v → u
            size_t idx_vu = currentPos[v]++;
            neighbors[idx_vu] = u;
            weights[idx_vu] = dist;
        }
    }

    writeGraphNodesBin(numNodeIds, allNodeIds, nodeCoordMap);
    writeGraphEdgesBin(numNodeIds, edgeCount, offsets, neighbors, weights);

    return 0;
}