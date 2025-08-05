// ./src/components/ControlPanel.jsx
import React, { useEffect, useRef } from 'react'

const SurfaceTypes = {
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
  SURF_UNKNOWN: 1 << 15
}

const ControlPanel = ({
  surfaceMask,
  onToggleSurface,
  onClear,
  onClose,
  panelOpen,
  setPanelOpen
}) => {
  const panelRef = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }

    if (panelOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [panelOpen, onClose])

  const panelWidth = 300

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 9999, display: 'flex' }}>
      {/* Hover Strip for Desktop */}
      <div
        style={{
          width: '4px',
          height: '100%',
          backgroundColor: 'transparent',
          cursor: 'pointer'
        }}
        onMouseEnter={() => setPanelOpen(true)}
        onMouseLeave={onClose}
      />

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setPanelOpen(true)}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          padding: '4px 8px',
          zIndex: 10000,
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          display: 'block'
        }}
      >
        ☰
      </button>

      {/* Sliding Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          top: 0,
          left: panelOpen ? '0px' : `-${panelWidth}px`,
          width: `${panelWidth}px`,
          height: '100%',
          backgroundColor: '#fff',
          boxShadow: '2px 0 5px rgba(0,0,0,0.2)',
          overflowY: 'auto',
          padding: '16px',
          transition: 'left 0.3s ease-in-out'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Surface Types</h2>
          <button
            onClick={() => {
              onClear()
              onClose()
            }}
            style={{
              fontSize: '14px',
              color: 'red',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Clear
          </button>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {Object.entries(SurfaceTypes).map(([name, bit]) => (
            <li key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <label style={{ fontSize: '14px', textTransform: 'capitalize' }}>
                {name.replace('SURF_', '').replace(/_/g, ' ').toLowerCase()}
              </label>
              <input
                type="checkbox"
                checked={(surfaceMask & bit) !== 0}
                onChange={() => onToggleSurface(bit)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default ControlPanel
