#include "writeBlobs.hpp"

#include <fstream>
#include <iostream>
#include <cstring>

namespace injest
{

void writeGraphNodesBin(
    const std::vector<uint64_t>& allNodeIds,
    const std::unordered_map<uint64_t, std::pair<float, float>>& nodeIdCoordMap)
{
  NodesHeader hdr;
  std::memcpy(hdr.magic, "MMAPNODE", 8);
  hdr.numNodes = static_cast<uint32_t>(allNodeIds.size());

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

void writeGraphEdgesBin(uint32_t numNodes, uint32_t numEdges,
                        const std::vector<uint32_t>& offsets,
                        const std::vector<uint32_t>& neighbors,
                        const std::vector<float>& lengthsMeters,
                        const std::vector<uint8_t>& surfacePrimary,
                        const std::vector<uint8_t>& modeMasks)
{
  EdgesHeader hdr;
  std::memcpy(hdr.magic, "MMAPEDGE", 8);
  hdr.numNodes = numNodes;
  hdr.numEdges = numEdges;
  hdr.hasSurfacePrimary = 1;
  hdr.hasModeMask = 1;
  hdr.lengthType = 0;

  std::ofstream out("../../data/graph_edges.bin", std::ios::binary);
  if (!out) throw std::runtime_error("Cannot open graph_edges.bin for write");

  out.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));

  // lengths block (for defensive parsing)
  uint32_t offsetsSize = static_cast<uint32_t>(offsets.size());
  uint32_t neighborsSize = static_cast<uint32_t>(neighbors.size());
  uint32_t lengthsSize = static_cast<uint32_t>(lengthsMeters.size());
  uint32_t surfacePrimarySize = static_cast<uint32_t>(surfacePrimary.size());
  uint32_t modeMasksSize = static_cast<uint32_t>(modeMasks.size());

  out.write(reinterpret_cast<const char*>(&offsetsSize), 4);
  out.write(reinterpret_cast<const char*>(&neighborsSize), 4);
  out.write(reinterpret_cast<const char*>(&lengthsSize), 4);
  out.write(reinterpret_cast<const char*>(&surfacePrimarySize), 4);
  out.write(reinterpret_cast<const char*>(&modeMasksSize), 4);

  // arrays
  out.write(reinterpret_cast<const char*>(offsets.data()),
            offsetsSize * sizeof(uint32_t));
  out.write(reinterpret_cast<const char*>(neighbors.data()),
            neighborsSize * sizeof(uint32_t));
  out.write(reinterpret_cast<const char*>(lengthsMeters.data()),
            lengthsSize * sizeof(float));
  out.write(reinterpret_cast<const char*>(surfacePrimary.data()),
            surfacePrimarySize * sizeof(uint8_t));
  out.write(reinterpret_cast<const char*>(modeMasks.data()),
            modeMasksSize * sizeof(uint8_t));

  out.close();
  std::cout << "Wrote graph_edges.bin (" << numEdges << " directed edges)\n";
}
}  // namespace injest
