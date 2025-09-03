#pragma once

#include <cstdint>
#include <unordered_map>
#include <vector>

namespace injest
{
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

void writeGraphNodesBin(
    const std::vector<uint64_t>& allNodeIds,
    const std::unordered_map<uint64_t, std::pair<float, float>>&
        nodeIdCoordMap);

void writeGraphEdgesBin(uint32_t numNodes, uint32_t numEdges,
                        const std::vector<uint32_t>& offsets,
                        const std::vector<uint32_t>& neighbors,
                        const std::vector<float>& lengthsMeters,
                        const std::vector<uint16_t>& surfaceFlags,
                        const std::vector<uint8_t>& surfacePrimary,
                        const std::vector<uint8_t>& modeMasks);

}  // namespace injest