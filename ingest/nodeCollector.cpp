#include "nodeCollector.hpp"

namespace ingest
{
void NodeCollector::node(const osmium::Node& node)
{
  uint64_t id = node.id();
  if (neededNodeIds.count(id))
    nodeIdCoordMap[id] = {(float)node.location().lat(),
                          (float)node.location().lon()};
}
}  // namespace ingest
