import React from 'react'

function fmt(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export default function TopBar({ wsConnected, running, stats }) {
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
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="#00c8ff" strokeWidth="1.5" fill="rgba(0,200,255,0.06)" />
          <circle cx="14" cy="14" r="4" fill="#00c8ff" opacity="0.9" />
          <line x1="14" y1="2" x2="14" y2="10" stroke="#00c8ff" strokeWidth="1" opacity="0.5" />
          <line x1="14" y1="18" x2="14" y2="26" stroke="#00c8ff" strokeWidth="1" opacity="0.5" />
          <line x1="2" y1="8" x2="10" y2="12" stroke="#00c8ff" strokeWidth="1" opacity="0.5" />
          <line x1="18" y1="16" x2="26" y2="20" stroke="#00c8ff" strokeWidth="1" opacity="0.5" />
          <line x1="26" y1="8" x2="18" y2="12" stroke="#00c8ff" strokeWidth="1" opacity="0.5" />
          <line x1="10" y1="16" x2="2" y2="20" stroke="#00c8ff" strokeWidth="1" opacity="0.5" />
        </svg>
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

      {/* Status */}
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
    </header>
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
