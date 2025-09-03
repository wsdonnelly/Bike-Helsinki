#pragma once

#include <osmium/handler.hpp>
#include <osmium/io/any_input.hpp>
#include <osmium/osm/node.hpp>
#include <osmium/visitor.hpp>
#include <unordered_map>
#include <unordered_set>

namespace injest
{
struct NodeCollector : public osmium::handler::Handler
{
  std::unordered_set<uint64_t> neededNodeIds;
  std::unordered_map<uint64_t, std::pair<float, float>>& nodeIdCoordMap;
  NodeCollector(std::unordered_set<uint64_t> n,
                std::unordered_map<uint64_t, std::pair<float, float>>& c)
      : neededNodeIds(std::move(n)), nodeIdCoordMap(c)
  {}
  void node(const osmium::Node& node);
};
}  // namespace injest
