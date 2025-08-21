import React from 'react';

// Bit flags must match backend SurfaceTypes.hpp
export const SurfaceBits = {
  SURF_PAVED:               1 << 0,
  SURF_ASPHALT:             1 << 1,
  SURF_CONCRETE:            1 << 2,
  SURF_PAVING_STONES:       1 << 3,
  SURF_SETT:                1 << 4,
  SURF_UNHEWN_COBBLESTONES: 1 << 5,
  SURF_COBBLESTONES:        1 << 6,
  SURF_BRICKS:              1 << 7,
  SURF_UNPAVED:             1 << 8,
  SURF_COMPACTED:           1 << 9,
  SURF_FINE_GRAVEL:         1 << 10,
  SURF_GRAVEL:              1 << 11,
  SURF_GROUND:              1 << 12,
  SURF_DIRT:                1 << 13,
  SURF_EARTH:               1 << 14,
  SURF_UNKNOWN:             1 << 15
};

// Stable order + friendlier labels
const GROUPS = [
  {
    title: 'Paved surfaces',
    items: [
      ['ASPHALT',             SurfaceBits.SURF_ASPHALT,             'Asphalt'],
      ['CONCRETE',            SurfaceBits.SURF_CONCRETE,            'Concrete'],
      ['PAVING_STONES',       SurfaceBits.SURF_PAVING_STONES,       'Paving stones'],
      ['SETT',                SurfaceBits.SURF_SETT,                'Sett'],
      ['UNHEWN_COBBLESTONES', SurfaceBits.SURF_UNHEWN_COBBLESTONES, 'Unhewn cobblestones'],
      ['COBBLESTONES',        SurfaceBits.SURF_COBBLESTONES,        'Cobblestones'],
      ['BRICKS',              SurfaceBits.SURF_BRICKS,              'Bricks'],
    ]
  },
  {
    title: 'Unpaved surfaces',
    items: [
      ['COMPACTED',    SurfaceBits.SURF_COMPACTED,    'Compacted'],
      ['FINE_GRAVEL',  SurfaceBits.SURF_FINE_GRAVEL,  'Fine gravel'],
      ['GRAVEL',       SurfaceBits.SURF_GRAVEL,       'Gravel'],
      ['GROUND',       SurfaceBits.SURF_GROUND,       'Ground'],
      ['DIRT',         SurfaceBits.SURF_DIRT,         'Dirt'],
      ['EARTH',        SurfaceBits.SURF_EARTH,        'Earth'],
    ]
  },
  {
    title: 'Generic & unknown',
    items: [
      ['PAVED',   SurfaceBits.SURF_PAVED,   'Any paved'],
      ['UNPAVED', SurfaceBits.SURF_UNPAVED, 'Any unpaved'],
      ['UNKNOWN', SurfaceBits.SURF_UNKNOWN, 'Unknown'],
    ]
  }
];

// Utility to compute masks from GROUPS
const ALL_BITS_MASK = GROUPS.reduce(
  (acc, g) => acc | g.items.reduce((m, [, bit]) => m | bit, 0),
  0
);

const ControlPanel = ({
  surfaceMask,
  onToggleSurface,       // (bit) => void
  onSetSurfaceMask,      // (newMask) => void  (optional)
  panelOpen,
  onTogglePanel
}) => {
  // Bulk actions
  const applyBulk = (newMask) => {
    if (typeof onSetSurfaceMask === 'function') {
      onSetSurfaceMask(newMask);
      return;
    }
    // fallback: reach target by toggling bits
    for (const [, bit] of Object.entries(SurfaceBits)) {
      const want = (newMask & bit) !== 0;
      const have = (surfaceMask & bit) !== 0;
      if (want !== have) onToggleSurface(bit);
    }
  };

  const selectAll  = () => applyBulk(ALL_BITS_MASK);
  const selectNone = () => applyBulk(0);
  const invertMask = () => applyBulk((~surfaceMask) & ALL_BITS_MASK);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 9999, pointerEvents: 'none' }}>
      {/* ☰ is visible only when panel is CLOSED */}
      {!panelOpen && (
        <button
          type="button"
          aria-label="Open surface filters"
          onClick={onTogglePanel}
          style={{
            position: 'absolute',
            top: 80,
            left: 10,
            padding: '6px 10px',
            zIndex: 10000,
            border: '1px solid #ccc',
            borderRadius: 6,
            backgroundColor: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
        >
          ☰
        </button>
      )}

      {/* Panel is COMPLETELY HIDDEN (not rendered) when closed */}
      {panelOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Surface filters"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 300,
            height: '100%',
            backgroundColor: '#fff',
            boxShadow: '2px 0 5px rgba(0,0,0,0.2)',
            overflowY: 'auto',
            padding: 16,
            pointerEvents: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>Surface Types</h2>
            {/* “Apply” instead of “Close” */}
            <button
              type="button"
              aria-label="Apply"
              onClick={onTogglePanel}
              style={{
                border: '1px solid #ddd',
                background: '#fafafa',
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer'
              }}
            >
              Apply
            </button>
          </div>

          {/* Bulk actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={selectAll}  style={btnSm}>All</button>
            <button type="button" onClick={selectNone} style={btnSm}>None</button>
            <button type="button" onClick={invertMask} style={btnSm}>Invert</button>
          </div>

          {GROUPS.map((group) => (
            <fieldset key={group.title} style={fs}>
              <legend style={legend}>{group.title}</legend>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {group.items.map(([key, bit, label]) => {
                  const id = `surf-${key.toLowerCase()}`;
                  const checked = (surfaceMask & bit) !== 0;
                  return (
                    <li key={key} style={row}>
                      <label htmlFor={id} style={{ fontSize: 14 }}>{label}</label>
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleSurface(bit)}
                        aria-checked={checked}
                      />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}

          <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
            Tip: Changes are applied when you press <b>Apply</b>.
          </p>
        </div>
      )}
    </div>
  );
};

// tiny style helpers
const btnSm = {
  border: '1px solid #ddd',
  background: '#fff',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer'
};
const fs = {
  border: '1px solid #eee',
  borderRadius: 6,
  padding: 12,
  marginBottom: 12
};
const legend = { fontWeight: 600, fontSize: 13, padding: '0 6px' };
const row = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px dashed #f1f1f1'
};

export default ControlPanel;
