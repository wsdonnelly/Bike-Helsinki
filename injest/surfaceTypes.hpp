#pragma once

#include <cstdint>

namespace types
{

// ─────────────────────────────────────────────────────────────────────────────
// Surface taxonomy
// - primary: 1 byte enum used for weighting and coloring and indexing
// ─────────────────────────────────────────────────────────────────────────────

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
static_assert(sizeof(SurfacePrimary) == 1, "SurfacePrimary must be 1 byte");
static_assert(sizeof(ModeMask) == 1, "ModeMask must be 1 byte");
}  // namespace types