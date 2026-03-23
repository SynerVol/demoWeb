import React from 'react'

const DRONE_COLORS = { 'ALPHA-1': '#00FFFF', 'BETA-2': '#FF6B35', 'GAMMA-3': '#A855F7' }
const STATUS_COLORS = { TAKEOFF: '#ffd60a', SCANNING: '#00ff88', RTL: '#ff6b35', LANDED: '#5a8099' }

export default function Sidebar({ running, radius, setRadius, altitude, setAltitude, drones, detections, onStart, onStop, searchCenter }) {
  return (
    <aside style={{
      width: 280,
      background: 'rgba(5,10,15,0.98)',
      borderRight: '1px solid rgba(0,200,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
      backdropFilter: 'blur(16px)',
    }}>
      {/* Mission Control */}
      <Section title="MISSION CONTROL">

        {/* Search Area Coordinates */}
        <div style={{
          background: 'rgba(255,45,85,0.07)',
          border: '1px solid rgba(255,45,85,0.2)',
          borderRadius: 5, padding: '8px 10px', marginBottom: 14,
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2, marginBottom: 4 }}>
            SEARCH CENTER
          </div>
          {searchCenter && searchCenter[0] !== 48.81430786259582 ? (
            <>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#ff2d55' }}>
                {searchCenter[0].toFixed(6)}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#ff2d55' }}>
                {searchCenter[1].toFixed(6)}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              Right-click map to set
            </div>
          )}
        </div>

        <Label>SEARCH RADIUS (m)</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <input
            type="range" min={30} max={200} value={radius}
            onChange={e => setRadius(+e.target.value)}
            disabled={running}
            style={{ flex: 1, accentColor: '#00c8ff' }}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: '#00c8ff', minWidth: 36 }}>{radius}</span>
        </div>

        <Label>ALTITUDE (m AGL)</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <input
            type="range" min={8} max={40} value={altitude}
            onChange={e => setAltitude(+e.target.value)}
            disabled={running}
            style={{ flex: 1, accentColor: '#00c8ff' }}
          />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: '#00c8ff', minWidth: 36 }}>{altitude}</span>
        </div>

        {!running ? (
          <button onClick={onStart} style={btnStyle('#00c8ff', '#050a0f')}>
            ▶ LAUNCH MISSION
          </button>
        ) : (
          <button onClick={onStop} style={btnStyle('#ff2d55', '#fff')}>
            ■ ABORT MISSION
          </button>
        )}
      </Section>

      {/* Drone Fleet */}
      <Section title="SWARM STATUS">
        {Object.keys(DRONE_COLORS).map(id => {
          const d = drones[id]
          const color = DRONE_COLORS[id]
          return (
            <div key={id} style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${d ? color + '33' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 8,
              transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DroneIcon color={color} active={!!d} />
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, color: d ? color : 'var(--text-dim)', letterSpacing: 1 }}>
                    {id}
                  </span>
                </div>
                {d && (
                  <StatusPill status={d.status} />
                )}
              </div>

              {d ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <TelCell label="ALT" value={`${d.alt?.toFixed ? d.alt.toFixed(1) : d.alt}m`} />
                  <TelCell label="SPD" value={`${d.speed || 0}m/s`} />
                  <TelCell label="BAT" value={`${Math.round(d.battery || 0)}%`} color={d.battery < 30 ? '#ff2d55' : undefined} />
                  <TelCell label="WP" value={`${d.wp_index || 0}`} />
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '4px 0' }}>
                  STANDBY
                </div>
              )}

              {/* Battery bar */}
              {d && (
                <div style={{ marginTop: 8, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                  <div style={{
                    height: '100%',
                    width: `${d.battery || 0}%`,
                    background: d.battery < 30 ? '#ff2d55' : '#00ff88',
                    borderRadius: 1,
                    transition: 'width 0.5s',
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </Section>

      {/* Detection log */}
      <Section title={`DETECTIONS (${detections.length})`}>
        {detections.length === 0 ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
            NO CONTACTS
          </div>
        ) : (
          [...detections].reverse().slice(0, 6).map(det => (
            <div key={det.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px', marginBottom: 4,
              background: 'rgba(255,45,85,0.08)',
              border: '1px solid rgba(255,45,85,0.2)',
              borderRadius: 4,
              animation: 'fadeIn 0.4s ease',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#ff2d55' }}>⚠ PERSON</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>
                  {det.drone_id}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
                color: det.confidence > 85 ? '#ff2d55' : '#ffd60a',
              }}>
                {det.confidence}%
              </div>
            </div>
          ))
        )}
      </Section>
    </aside>
  )
}

// Sub-components
function Section({ title, children }) {
  return (
    <div style={{ padding: '16px 16px 4px', borderBottom: '1px solid rgba(0,200,255,0.07)' }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 3,
        color: 'var(--text-dim)', marginBottom: 12,
      }}>{title}</div>
      {children}
      <div style={{ height: 12 }} />
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2, marginBottom: 4 }}>{children}</div>
}

function TelCell({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 3, padding: '3px 6px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || '#fff'
  return (
    <div style={{
      background: color + '22',
      border: `1px solid ${color}55`,
      borderRadius: 3,
      padding: '1px 6px',
      fontFamily: 'var(--mono)',
      fontSize: 9,
      color,
      letterSpacing: 1,
    }}>{status}</div>
  )
}

function DroneIcon({ color, active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill={active ? color : '#333'} opacity={active ? 0.9 : 0.4} />
      <line x1="8" y1="1" x2="8" y2="4" stroke={active ? color : '#333'} strokeWidth="1.5" opacity="0.7" />
      <line x1="8" y1="12" x2="8" y2="15" stroke={active ? color : '#333'} strokeWidth="1.5" opacity="0.7" />
      <line x1="1" y1="8" x2="4" y2="8" stroke={active ? color : '#333'} strokeWidth="1.5" opacity="0.7" />
      <line x1="12" y1="8" x2="15" y2="8" stroke={active ? color : '#333'} strokeWidth="1.5" opacity="0.7" />
      {active && <circle cx="8" cy="8" r="5" stroke={color} strokeWidth="0.5" opacity="0.3" />}
    </svg>
  )
}

function btnStyle(border, text) {
  return {
    width: '100%',
    padding: '11px 0',
    background: border === '#00c8ff' ? 'rgba(0,200,255,0.1)' : 'rgba(255,45,85,0.15)',
    border: `1px solid ${border}`,
    borderRadius: 5,
    color: border,
    fontFamily: 'var(--sans)',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 2,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: 4,
  }
}
