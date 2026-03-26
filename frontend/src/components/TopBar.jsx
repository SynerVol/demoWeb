import React from 'react'

function fmt(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

// String-art triangle logo — recreated from the reference image
function SynervolLogo() {
  const N  = 22
  const A  = [2, 2], B = [42, 2], C = [22, 48]

  // Fan 1: lines from top edge (B→A direction) to left edge (A→C)
  const lines1 = Array.from({ length: N }, (_, i) => {
    const t  = i / (N - 1)
    return {
      x1: B[0] + t * (A[0] - B[0]),
      y1: 2,
      x2: A[0] + t * (C[0] - A[0]),
      y2: A[1] + t * (C[1] - A[1]),
    }
  })

  // Fan 2: lines from top edge (A→B direction) to right edge (B→C)
  const lines2 = Array.from({ length: N }, (_, i) => {
    const t  = i / (N - 1)
    return {
      x1: A[0] + t * (B[0] - A[0]),
      y1: 2,
      x2: B[0] + t * (C[0] - B[0]),
      y2: B[1] + t * (C[1] - B[1]),
    }
  })

  return (
    <svg width="36" height="40" viewBox="0 0 44 50" fill="none">
      {/* Outer triangle */}
      <polygon
        points="2,2 42,2 22,48"
        stroke="rgba(0,200,255,0.25)"
        strokeWidth="0.8"
        fill="none"
      />
      {/* String-art lines */}
      {[...lines1, ...lines2].map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={i < N ? 'rgba(0,200,255,0.65)' : 'rgba(0,200,255,0.55)'}
          strokeWidth="0.55"
        />
      ))}
      {/* Small 4-pointed star (bottom-right, like in the reference) */}
      <path
        d="M40 45 L41.2 43.8 L42.4 45 L41.2 46.2 Z"
        fill="rgba(0,200,255,0.5)"
      />
    </svg>
  )
}

export default function TopBar({ wsConnected, running, paused, stats, onPause, onResume }) {
  return (
    <header style={{
      background: 'rgba(5,10,15,0.98)',
      borderBottom: '1px solid rgba(0,200,255,0.12)',
      padding: '0 24px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      backdropFilter: 'blur(16px)',
      zIndex: 100,
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SynervolLogo />
        <div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 18, letterSpacing: 3, color: '#00c8ff' }}>
            SYNERVOL
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2, marginLeft: 10 }}>
            SWARM GCS v2.1
          </span>
        </div>
      </div>

      {/* Center stats */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <Stat label="MISSION TIME" value={running ? fmt(stats.elapsed) : '--:--'} mono />
        <Stat label="ZONE" value="PARIS EST" />
        <Stat label="PROTOCOL" value="MAVLink 2.0" />
      </div>

      {/* Right side: pause button + link status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Pause / Resume button — only shown during active mission */}
        {running && (
          <button
            onClick={paused ? onResume : onPause}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: paused ? 'rgba(0,255,136,0.1)' : 'rgba(255,214,10,0.1)',
              border: `1px solid ${paused ? '#00ff88' : '#ffd60a'}`,
              borderRadius: 5,
              padding: '5px 14px',
              color: paused ? '#00ff88' : '#ffd60a',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: 2,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {paused ? (
              <>
                <span style={{ fontSize: 13 }}>▶</span> RESUME
              </>
            ) : (
              <>
                <PauseIcon /> PAUSE
              </>
            )}
          </button>
        )}

        {/* WS link indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: wsConnected ? '#00ff88' : '#ff2d55',
            boxShadow: wsConnected ? '0 0 8px #00ff88' : '0 0 8px #ff2d55',
            animation: wsConnected ? 'blink 2s infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: wsConnected ? '#00ff88' : '#ff2d55' }}>
            {wsConnected ? 'LINK ESTABLISHED' : 'NO SIGNAL'}
          </span>
        </div>
      </div>
    </header>
  )
}

function PauseIcon() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
      <rect x="0" y="0" width="3.5" height="12" rx="1" />
      <rect x="6.5" y="0" width="3.5" height="12" rx="1" />
    </svg>
  )
}

function Stat({ label, value, mono }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: mono ? 'var(--mono)' : 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}