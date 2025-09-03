#pragma once

#include <cstdint>

namespace types
{

// ─────────────────────────────────────────────────────────────────────────────
// Surface taxonomy
// - primary: 1 byte enum used for weighting and coloring
// - flags  : 2 byte bitmask used for filtering; includes parent categories
// ─────────────────────────────────────────────────────────────────────────────

using SurfaceMask = uint16_t;

enum class SurfaceBit : SurfaceMask
{
  PAVED = 1u << 0,  // generic
  ASPHALT = 1u << 1,
  CONCRETE = 1u << 2,
  PAVING_STONES = 1u << 3,
  SETT = 1u << 4,
  UNHEWN_COBBLESTONES = 1u << 5,
  COBBLESTONES = 1u << 6,
  BRICKS = 1u << 7,

  UNPAVED = 1u << 8,  // generic
  COMPACTED = 1u << 9,
  FINE_GRAVEL = 1u << 10,
  GRAVEL = 1u << 11,
  GROUND = 1u << 12,
  DIRT = 1u << 13,
  EARTH = 1u << 14,

  UNKNOWN = 1u << 15  // catch-all
};

// Primary surface code (1 byte). Index into per-surface weight/color tables.
enum class SurfacePrimary : uint8_t
{
  PAVED,
  ASPHALT,
  CONCRETE,
  PAVING_STONES,
  SETT,
  UNHEWN_COBBLESTONES,
  COBBLESTONES,
  BRICKS,
  UNPAVED,
  COMPACTED,
  FINE_GRAVEL,
  GRAVEL,
  GROUND,
  DIRT,
  EARTH,
  UNKNOWN
};

//is this needed?
// constexpr SurfaceMask ALL_SURFACES = 0xFFFFu;
constexpr SurfaceMask bit(SurfaceBit b) noexcept
{
  return static_cast<SurfaceMask>(b);
}

// constexpr bool overlaps(SurfaceMask a, SurfaceMask b) noexcept
// {
//   return (a & b) != 0;
// }


// ─────────────────────────────────────────────────────────────────────────────
// Mode bits per directed edge
// ─────────────────────────────────────────────────────────────────────────────

enum ModeBits : uint8_t
{
  MODE_NONE = 0,
  MODE_BIKE = 1u << 0,  // riding permitted in this direction
  MODE_FOOT = 1u << 1   // walking permitted in this direction
};
using ModeMask = uint8_t;

// Sanity checks on sizes
static_assert(sizeof(SurfaceMask) == 2, "SurfaceMask must be 2 bytes");
static_assert(sizeof(SurfacePrimary) == 1, "SurfacePrimary must be 1 byte");
static_assert(sizeof(ModeMask) == 1, "ModeMask must be 1 byte");
}  // namespace types