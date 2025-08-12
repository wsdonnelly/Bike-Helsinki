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
  // specific surface bits
  ASPHALT = 1u << 0,
  CONCRETE = 1u << 1,
  PAVING_STONES = 1u << 2,
  SETT = 1u << 3,
  UNHEWN_COBBLESTONES = 1u << 4,
  COBBLESTONES = 1u << 5,
  BRICKS = 1u << 6,

  COMPACTED = 1u << 7,
  FINE_GRAVEL = 1u << 8,
  GRAVEL = 1u << 9,
  GROUND = 1u << 10,
  DIRT = 1u << 11,
  EARTH = 1u << 12,

  // parent bits
  PAVED = 1u << 13,    // parent category
  UNPAVED = 1u << 14,  // parent category
  UNKNOWN = 1u << 15   // catch-all
};

constexpr SurfaceMask bit(SurfaceBit b) noexcept
{
  return static_cast<SurfaceMask>(b);
}
constexpr bool overlaps(SurfaceMask a, SurfaceMask b) noexcept
{
  return (a & b) != 0;
}

// Primary surface code (1 byte). Index into per-surface weight/color tables.
enum class SurfacePrimary : uint8_t
{
  ASPHALT,
  CONCRETE,
  PAVING_STONES,
  SETT,
  UNHEWN_COBBLESTONES,
  COBBLESTONES,
  BRICKS,
  COMPACTED,
  FINE_GRAVEL,
  GRAVEL,
  GROUND,
  DIRT,
  EARTH,
  UNKNOWN,
  COUNT
};

constexpr SurfaceMask ALL_SURFACES = 0xFFFFu;

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
}