// Bit flags must match injest/surfaceTypes.hpp
export const SurfaceBits = {
  SURF_PAVED: 1 << 0,
  SURF_ASPHALT: 1 << 1,
  SURF_CONCRETE: 1 << 2,
  SURF_PAVING_STONES: 1 << 3,
  SURF_SETT: 1 << 4,
  SURF_UNHEWN_COBBLESTONES: 1 << 5,
  SURF_COBBLESTONES: 1 << 6,
  SURF_BRICKS: 1 << 7,

  SURF_UNPAVED: 1 << 8,
  SURF_COMPACTED: 1 << 9,
  SURF_FINE_GRAVEL: 1 << 10,
  SURF_GRAVEL: 1 << 11,
  SURF_GROUND: 1 << 12,
  SURF_DIRT: 1 << 13,
  SURF_EARTH: 1 << 14,
  SURF_UNKNOWN: 1 << 15,
};

export const SURFACE_GROUPS = [
  {
    title: "Paved surfaces",
    items: [
      ["PAVED", SurfaceBits.SURF_PAVED, "Generic paved"],
      ["ASPHALT", SurfaceBits.SURF_ASPHALT, "Asphalt"],
      ["CONCRETE", SurfaceBits.SURF_CONCRETE, "Concrete"],
      ["PAVING_STONES", SurfaceBits.SURF_PAVING_STONES, "Paving stones"],
      ["SETT", SurfaceBits.SURF_SETT, "Sett"],
      [
        "UNHEWN_COBBLESTONES",
        SurfaceBits.SURF_UNHEWN_COBBLESTONES,
        "Unhewn cobblestones",
      ],
      ["COBBLESTONES", SurfaceBits.SURF_COBBLESTONES, "Cobblestones"],
      ["BRICKS", SurfaceBits.SURF_BRICKS, "Bricks"],
    ],
  },
  {
    title: "Unpaved surfaces",
    items: [
      ["UNPAVED", SurfaceBits.SURF_UNPAVED, "Generic unpaved"],
      ["COMPACTED", SurfaceBits.SURF_COMPACTED, "Compacted"],
      ["FINE_GRAVEL", SurfaceBits.SURF_FINE_GRAVEL, "Fine gravel"],
      ["GRAVEL", SurfaceBits.SURF_GRAVEL, "Gravel"],
      ["GROUND", SurfaceBits.SURF_GROUND, "Ground"],
      ["DIRT", SurfaceBits.SURF_DIRT, "Dirt"],
      ["EARTH", SurfaceBits.SURF_EARTH, "Earth"],
    ],
  },
];

const groupMask = (title) =>
  (SURFACE_GROUPS.find((g) => g.title === title)?.items ?? []).reduce(
    (m, [, bit]) => m | bit,
    0
  );

export const PAVED_BITS_MASK = groupMask("Paved surfaces");
export const UNPAVED_BITS_MASK = groupMask("Unpaved surfaces");
export const ALL_BITS_MASK = SURFACE_GROUPS.reduce(
  (acc, g) => acc | g.items.reduce((m, [, bit]) => m | bit, 0),
  0
);
