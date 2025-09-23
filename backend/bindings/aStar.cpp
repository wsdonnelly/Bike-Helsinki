#include "aStar.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <limits>
#include <queue>
#include <stdexcept>

#include "utils.hpp"

// NOTE: Keep edge-access bits separate from the path step labels.
// Edges use bitmasks (bike=0x1, foot=0x2). Your new enum values are for OUTPUT
// labeling.
namespace
{
constexpr std::uint8_t EDGE_MASK_BIKE = 0x1;
constexpr std::uint8_t EDGE_MASK_FOOT = 0x2;
}  // namespace

inline bool isPreferredBike(std::uint8_t primary, std::uint16_t mask) noexcept
{
  if (primary >= 16) return true;  // unknown → neutral (no penalty)
  return (mask & (std::uint16_t(1) << primary)) != 0;
}

AStarResult aStarTwoLayer(const EdgesView& edgesView,
                          const NodesView& nodesView, uint32_t sourceIdx,
                          uint32_t targetIdx, const AStarParams& params)
{
  const uint32_t numNodes = edgesView.numNodes;
  if (sourceIdx >= numNodes || targetIdx >= numNodes)
    throw std::runtime_error("source/target out of range");

  // Validate speeds
  if (!(std::isfinite(params.bikeSpeedMps) && params.bikeSpeedMps > 0.0) ||
      !(std::isfinite(params.walkSpeedMps) && params.walkSpeedMps > 0.0))
    throw std::invalid_argument(
        "bikeSpeedMps and walkSpeedMps must be finite and > 0");

  const double invBike = 1.0 / params.bikeSpeedMps;
  const double invWalk = 1.0 / params.walkSpeedMps;
  const double wSurfPerM =
      std::max(0.0, params.surfacePenaltySPerKm) * 0.001;  // s per meter

  double targetLat, targetLon;
  nodeDeg(nodesView, targetIdx, targetLat, targetLon);
  const double vmax = std::max(params.bikeSpeedMps, params.walkSpeedMps);

  // Heuristic = optimistic straight-line time with vmax (no penalties)
  auto heuristic = [&](uint32_t currentIdx) -> double {
    double currentLat, currentLon;
    nodeDeg(nodesView, currentIdx, currentLat, currentLon);
    return utils::haversineMeters(currentLat, currentLon, targetLat,
                                  targetLon) /
           vmax;
  };

  const double INF = std::numeric_limits<double>::infinity();
  const uint32_t S_ride = StateKey::idx(sourceIdx, Layer::Ride);
  const uint32_t S_walk = StateKey::idx(sourceIdx, Layer::Walk);

  // States
  std::vector<double> gCost(2 * numNodes, INF);
  // keep track of actual time
  std::vector<double> gTime(2 * numNodes, INF);
  std::vector<uint32_t> parent(2 * numNodes, UINT32_MAX);
  // stores OUTPUT step label
  std::vector<uint8_t> parentMode(2 * numNodes, 0);
  // UINT32_MAX => mode switch
  std::vector<uint32_t> parentEdge(2 * numNodes, UINT32_MAX);
  std::vector<uint8_t> closed(2 * numNodes, 0);

  gCost[S_ride] = 0.0;
  gCost[S_walk] = 0.0;
  gTime[S_ride] = 0.0;  // NEW
  gTime[S_walk] = 0.0;  // NEW

  // check for queue inclusion
  std::vector<uint8_t> inQueue(2 * numNodes, 0);

  std::priority_queue<PQItem> openPQ;
  openPQ.push(
      PQItem{gCost[S_ride] + heuristic(sourceIdx), sourceIdx, Layer::Ride});
  openPQ.push(
      PQItem{gCost[S_walk] + heuristic(sourceIdx), sourceIdx, Layer::Walk});

  auto relaxEdge = [&](uint32_t u, Layer layerU, uint32_t v, uint32_t edgeIdx,
                       double edgeTimeSec, double surfPenalty,
                       uint8_t stepLabel) {
    const uint32_t curIdx = StateKey::idx(u, layerU);
    const uint32_t nextIdx = StateKey::idx(v, layerU);
    const double tentativeCost = gCost[curIdx] + edgeTimeSec + surfPenalty;
    const double tentativeTime = gTime[curIdx] + edgeTimeSec;
    if (tentativeCost < gCost[nextIdx])
    {
      gCost[nextIdx] = tentativeCost;
      gTime[nextIdx] = tentativeTime;
      parent[nextIdx] = curIdx;
      parentMode[nextIdx] = stepLabel;  // label this step for coloring
      parentEdge[nextIdx] = edgeIdx;

      if (!inQueue[nextIdx])
      {
        openPQ.push(PQItem{tentativeCost + heuristic(v), v, layerU});
        inQueue[nextIdx] = 1;
      }
    }
  };

  auto relaxSwitch = [&](uint32_t u, Layer from, Layer to, double penaltySec) {
    const uint32_t curIdx = StateKey::idx(u, from);
    const uint32_t nextIdx = StateKey::idx(u, to);
    const double tentativeCost = gCost[curIdx] + penaltySec;
    const double tentativeTime = gTime[curIdx];
    if (tentativeCost < gCost[nextIdx])
    {
      gCost[nextIdx] = tentativeCost;
      gTime[nextIdx] = tentativeTime;
      parent[nextIdx] = curIdx;
      parentMode[nextIdx] = 0;  // special: switch (no edge)
      parentEdge[nextIdx] = UINT32_MAX;
      openPQ.push(PQItem{tentativeCost + heuristic(u), u, to});
    }
  };

  uint32_t goalState = UINT32_MAX;

  while (!openPQ.empty())
  {
    PQItem it = openPQ.top();
    openPQ.pop();

    const uint32_t u = it.nodeIdx;
    const Layer layer = it.layer;
    const uint32_t uIdx = StateKey::idx(u, layer);
    if (closed[uIdx]) continue;
    closed[uIdx] = 1;

    if (u == targetIdx)
    {
      goalState = uIdx;
      break;
    }

    const uint32_t begin = edgesView.offsets[u];
    const uint32_t end = edgesView.offsets[u + 1];

    if (layer == Layer::Ride)
    {
      for (uint32_t edgeIdx{begin}; edgeIdx < end; ++edgeIdx)
      {
        if ((edgesView.modeMask[edgeIdx] & EDGE_MASK_BIKE) == 0) continue;

        const uint32_t v = edgesView.neighbors[edgeIdx];
        const double len =
            static_cast<double>(edgesView.lengthsMeters[edgeIdx]);
        const uint8_t s =
            edgesView.surfacePrimary ? edgesView.surfacePrimary[edgeIdx] : 0xFF;

        // this will be added later
        const double factor = edgesView.surfacePrimary
                                  ? surfaceFactor(params.bikeSurfaceFactor, s)
                                  : 1.0;
        const double time_s = len * invBike * factor;

        // Bike-only soft preference penalty + label
        const bool preferred = isPreferredBike(s, params.bikeSurfaceMask);
        const double surfPenalty = preferred ? 0.0 : (wSurfPerM * len);
        const uint8_t stepLabel =
            preferred ? MODE_BIKE_PREFERRED : MODE_BIKE_NON_PREFERRED;

        relaxEdge(u, layer, v, edgeIdx, time_s, surfPenalty, stepLabel);
      }

      if (params.rideToWalkPenaltyS >= 0.0)
      {
        relaxSwitch(u, Layer::Ride, Layer::Walk, params.rideToWalkPenaltyS);
      }
    }
    else
    {  // Walk layer
      for (uint32_t edgeIdx{begin}; edgeIdx < end; ++edgeIdx)
      {
        if ((edgesView.modeMask[edgeIdx] & EDGE_MASK_FOOT) == 0) continue;

        const uint32_t v = edgesView.neighbors[edgeIdx];
        const double len =
            static_cast<double>(edgesView.lengthsMeters[edgeIdx]);
        const uint8_t s =
            edgesView.surfacePrimary ? edgesView.surfacePrimary[edgeIdx] : 0xFF;

        const double factor = edgesView.surfacePrimary
                                  ? surfaceFactor(params.walkSurfaceFactor, s)
                                  : 1.0;
        const double time_s = len * invWalk * factor;

        relaxEdge(u, layer, v, edgeIdx, time_s, 0.0, MODE_FOOT);
      }

      if (params.walkToRidePenaltyS >= 0.0)
      {
        relaxSwitch(u, Layer::Walk, Layer::Ride, params.walkToRidePenaltyS);
      }
    }
  }

  AStarResult result;
  if (goalState == UINT32_MAX)
  {
    result.success = false;
    return result;
  }

  // Reconstruct states
  std::vector<uint32_t> stateChain;
  for (uint32_t cur{goalState}; cur != UINT32_MAX;)
  {
    stateChain.push_back(cur);
    uint32_t p = parent[cur];
    if (p == UINT32_MAX) break;
    cur = p;
  }
  std::reverse(stateChain.begin(), stateChain.end());

  // Outputs
  result.pathNodes.clear();
  result.pathModes.clear();
  result.pathNodes.reserve(stateChain.size());
  result.pathNodes.push_back(stateChain.front() / 2u);

  double totalMeters = 0.0;

  for (size_t i{1}; i < stateChain.size(); ++i)
  {
    const uint32_t cur = stateChain[i];

    if (parentEdge[cur] == UINT32_MAX)
    {
      // Mode switch at same node (no distance)
      continue;
    }

    const uint32_t edgeIdx = parentEdge[cur];
    const uint32_t v = cur / 2u;
    const double len = static_cast<double>(edgesView.lengthsMeters[edgeIdx]);

    totalMeters += len;

    switch (parentMode[cur])
    {
      case MODE_FOOT:
        result.distanceWalk += len;
        break;
      case MODE_BIKE_PREFERRED:
        result.distanceBikePreferred += len;
        break;
      case MODE_BIKE_NON_PREFERRED:
        result.distanceBikeNonPreferred += len;
        break;
    }

    result.pathModes.push_back(parentMode[cur]);  // keep exact label (preferred
                                                  // / non-preferred / walk)
    result.pathNodes.push_back(v);
  }

  result.distanceM = totalMeters;
  result.durationS = gTime[goalState];
  result.success = true;
  return result;
}
