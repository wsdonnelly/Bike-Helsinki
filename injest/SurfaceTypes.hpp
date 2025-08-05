#pragma once

#include <cstdint>

namespace types
{
    using BitWidth = uint16_t;

    constexpr BitWidth ALL_SURFACES{0xFFFF};

    enum SurfaceTypes : BitWidth
    {
        SURF_PAVED = 1 << 0,
        SURF_ASPHALT = 1 << 1,
        SURF_CONCRETE = 1 << 2,
        SURF_PAVING_STONES = 1 << 3,
        SURF_SETT = 1 << 4,
        SURF_UNHEWN_COBBLESTONES = 1 << 5,
        SURF_COBBLESTONES = 1 << 6,
        SURF_BRICKS = 1 << 7,

        SURF_UNPAVED = 1 << 8,
        SURF_COMPACTED = 1 << 9,
        SURF_FINE_GRAVEL = 1 << 10,
        SURF_GRAVEL = 1 << 11,
        SURF_GROUND = 1 << 12,
        SURF_DIRT = 1 << 13,
        SURF_EARTH = 1 << 14,

        SURF_UNKNOWN = 1 << 15
    };
}
