#pragma once

#include <cmath>  // std::isfinite
#include <cstddef>
#include <cstdint>
#include <vector>

#include "route.hpp"

// ---------------- Two-mode A* over CSR ----------------

// If you really want bit flags, keep these as plain enum values or make a
// strong-typed flags enum.
enum : std::uint8_t
{
  MODE_BIKE = 0x1,
  MODE_FOOT = 0x2
};

enum class Layer : std::uint8_t
{
  Ride = 0,
  Walk = 1
};

inline void nodeDeg(const NodesView& nodeView, std::uint32_t idx,
                    double& latDeg, double& lonDeg) noexcept
{
  latDeg = static_cast<double>(nodeView.lat_f32[idx]);
  lonDeg = static_cast<double>(nodeView.lon_f32[idx]);
}

// Get factor by surface primary index; fall back to 1.0 if missing/invalid.
inline double surfaceFactor(const std::vector<double>& factors,
                            std::uint8_t surfacePrimaryIdx) noexcept
{
  constexpr double kDefaultFactor{1.0};

  if (factors.empty()) return kDefaultFactor;

  const std::size_t idx = static_cast<std::size_t>(surfacePrimaryIdx);
  if (idx >= factors.size()) return kDefaultFactor;

  const double factor = factors[idx];
  // Guard against NaN/Inf/<=0 coming from user input.
  if (!std::isfinite(factor) || factor <= 0.0) return kDefaultFactor;
  return factor;
}

struct AStarParams
{
  // Filtering
  std::uint16_t bikeSurfaceMask = 0xFFFF;

  // Speeds (meters/sec)
  double bikeSpeedMps = 6.0;  // ~21.6 km/h
  double walkSpeedMps = 1.5;  // ~5.4 km/h

  // Penalties (seconds) to switch modes at a node
  double rideToWalkPenaltyS = 5.0;  // dismount
  double walkToRidePenaltyS = 3.0;  // remount

  // Per-surface primary multipliers (index by uint8 surfacePrimary)
  // If empty, all factors default to 1.0
  std::vector<double> bikeSurfaceFactor;
  std::vector<double> walkSurfaceFactor;
};

struct AStarResult
{
  bool success{false};

  // Node indices s..t
  std::vector<std::uint32_t> pathNodes;

  // MODE_* for each step between nodes; length = pathNodes.size()-1
  std::vector<std::uint8_t> pathModes;

  double distanceM{0.0};
  double durationS{0.0};

  // Distances per mode (aggregates)
  double distanceBike{0.0};
  double distanceWalk{0.0};
};

// Keep inside struct to expand later if needed
struct StateKey
{
  inline static constexpr std::uint32_t kLayers{2};

  static constexpr std::uint32_t idx(std::uint32_t nodeIdx,
                                     Layer layer) noexcept
  {
    return nodeIdx * kLayers + static_cast<std::uint32_t>(layer);
  }
};

struct PQItem
{
  // f(n) = g(n) + h(n): the estimated total trip time if you go through n
  // Min-heap behavior with std::priority_queue via reversed comparison.
  double priorityF;       // f = g + h
  std::uint32_t nodeIdx;  // graph node
  Layer layer;            // Ride/Walk

  bool operator<(const PQItem& rhs) const noexcept
  {
    return priorityF > rhs.priorityF;
  }
};

// IMPORTANT: Do NOT mark this 'static' in the header unless you also define it
// inline here. If the definition lives in a .cpp, keep it as a normal
// declaration like below.
[[nodiscard]]
AStarResult aStarTwoLayer(const EdgesView& edgesView,
                          const NodesView& nodesView, std::uint32_t sourceIdx,
                          std::uint32_t targetIdx, const AStarParams& params);
