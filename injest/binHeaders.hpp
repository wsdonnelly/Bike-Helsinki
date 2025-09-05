#pragma once

#include <cstdint>

namespace injest
{
struct NodesHeader
{
  char magic[8]; // "MMAPNODE"
  uint32_t numNodes;
  uint32_t reserved{0};
};
static_assert(sizeof(NodesHeader) == 16, "NodesHeader must be 16 bytes");

struct EdgesHeader
{
  char magic[8];  // "MMAPEDGE"
  uint32_t numNodes;
  uint32_t numEdges;
  uint8_t hasSurfacePrimary;
  uint8_t hasModeMask;
  uint8_t lengthType;
  uint8_t reserved{0};
};
static_assert(sizeof(EdgesHeader) == 20, "EdgesHeader must be 20 bytes");
}
