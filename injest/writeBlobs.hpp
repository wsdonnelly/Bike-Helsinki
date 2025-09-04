#pragma once

#include <cstdint>
#include <unordered_map>
#include <vector>

#include "blobHeaders.hpp"

namespace injest
{
void writeGraphNodesBin(
    const std::vector<uint64_t>& allNodeIds,
    const std::unordered_map<uint64_t, std::pair<float, float>>&
        nodeIdCoordMap);

void writeGraphEdgesBin(uint32_t numNodes, uint32_t numEdges,
                        const std::vector<uint32_t>& offsets,
                        const std::vector<uint32_t>& neighbors,
                        const std::vector<float>& lengthsMeters,
                        const std::vector<uint8_t>& surfacePrimary,
                        const std::vector<uint8_t>& modeMasks);

}  // namespace injest