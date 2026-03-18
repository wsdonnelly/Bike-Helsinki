#pragma once

#include <cmath>

namespace utils
{
static inline double haversineMeters(double lat1Deg, double lon1Deg,
                                     double lat2Deg, double lon2Deg)
{
  constexpr double kPi = 3.14159265358979323846;
  constexpr double kDegToRad = kPi / 180.0;
  constexpr double kEarthRadiusMeters = 6371000.0;

  const double dLat = (lat2Deg - lat1Deg) * kDegToRad;
  const double dLon = (lon2Deg - lon1Deg) * kDegToRad;
  const double lat1 = lat1Deg * kDegToRad;
  const double lat2 = lat2Deg * kDegToRad;

  const double sinHalfDLat = std::sin(dLat * 0.5);
  const double sinHalfDLon = std::sin(dLon * 0.5);

  const double a = sinHalfDLat * sinHalfDLat +
                   std::cos(lat1) * std::cos(lat2) * sinHalfDLon * sinHalfDLon;

  const double centralAngle =
      2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
  return kEarthRadiusMeters * centralAngle;
}
}  // namespace utils
