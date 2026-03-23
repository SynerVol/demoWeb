import React from 'react'

export default function AlertFeed({ alerts }) {
  if (alerts.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 6,
      pointerEvents: 'none',
      maxWidth: 360,
      width: '90%',
    }}>
      {alerts.slice(0, 3).map((alert, i) => (
        <div key={alert.id} style={{
          background: 'rgba(255,45,85,0.12)',
          border: '1px solid rgba(255,45,85,0.5)',
          borderLeft: '3px solid #ff2d55',
          borderRadius: 6,
          padding: '10px 14px',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease',
          opacity: 1 - i * 0.25,
          transform: `scale(${1 - i * 0.03})`,
          transformOrigin: 'bottom center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#ff2d55',
              boxShadow: '0 0 8px #ff2d55',
              animation: 'blink 1s infinite',
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: '#ff2d55', letterSpacing: 1 }}>
                ⚠ {alert.text}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {alert.time}
              </div>
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 18,
            fontWeight: 700,
            color: alert.confidence > 85 ? '#ff2d55' : '#ffd60a',
            marginLeft: 12,
          }}>
            {alert.confidence}%
          </div>
        </div>
      ))}
    </div>
  )
}
