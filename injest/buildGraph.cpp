#include <cstring>
#include <fstream>
#include <iostream>
#include <osmium/io/any_input.hpp>
#include <osmium/visitor.hpp>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

#include "nodeCollector.hpp"
#include "surfaceTypes.hpp"
#include "utils.hpp"
#include "wayCollector.hpp"
#include "writeBins.hpp"

using namespace injest;
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
      if (wayMeta.bikeFwd || wayMeta.footAllowed)
      {
        inc(u);  // u->v
      }
      if (wayMeta.bikeBack || wayMeta.footAllowed)
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
  std::vector<uint8_t> surfacePrimaryVec(numEdges);
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
      const float dist = (float)utils::haversineMeters(
          coordU.first, coordU.second, coord.first, coord.second);

      const WayMeta& wayMeta = wayIdWayMetaMap[wayId];
      if (wayMeta.bikeFwd || wayMeta.footAllowed)
      {
        uint32_t idx = cur[idxU]++;
        neighbors[idx] = idxV;
        lengthsMeters[idx] = dist;
        surfacePrimaryVec[idx] = (uint8_t)wayMeta.surfacePrimary;

        uint8_t modeMask{0};
        if (wayMeta.bikeFwd)
        {
          modeMask |= (uint8_t)types::MODE_BIKE;  // must be 0x1
        }
        if (wayMeta.footAllowed)
        {
          modeMask |= (uint8_t)types::MODE_FOOT;  // must be 0x2
        }
        modeMasks[idx] = modeMask;
      }
      if (wayMeta.bikeBack || wayMeta.footAllowed)
      {
        uint32_t idx = cur[idxV]++;
        neighbors[idx] = idxU;
        lengthsMeters[idx] = dist;
        surfacePrimaryVec[idx] = (uint8_t)wayMeta.surfacePrimary;
        uint8_t modeMask{0};
        if (wayMeta.bikeBack) modeMask |= (uint8_t)types::MODE_BIKE;
        if (wayMeta.footAllowed) modeMask |= (uint8_t)types::MODE_FOOT;
        modeMasks[idx] = modeMask;
      }
    }
  }

  // Write bins
  writeGraphNodesBin(allNodeIds, nodeIdCoordMap);
  writeGraphEdgesBin(numNodes, numEdges, offsets, neighbors, lengthsMeters,
                     surfacePrimaryVec, modeMasks);

  return 0;
}
