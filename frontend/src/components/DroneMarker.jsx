import React from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'

export default function DroneMarker({ drone }) {
  const icon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:32px;height:32px;transform:translate(-50%,-50%)">
        <div style="
          position:absolute;inset:0;
          border-radius:50%;
          border:1.5px solid ${drone.color};
          background:${drone.color}18;
          animation:${drone.status === 'SCANNING' ? 'glow 2s infinite' : 'none'};
        "></div>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%">
          <circle cx="16" cy="16" r="4" fill="${drone.color}" opacity="0.95"/>
          <line x1="16" y1="4" x2="16" y2="12" stroke="${drone.color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="16" y1="20" x2="16" y2="28" stroke="${drone.color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="4" y1="16" x2="12" y2="16" stroke="${drone.color}" stroke-width="2" stroke-linecap="round"/>
          <line x1="20" y1="16" x2="28" y2="16" stroke="${drone.color}" stroke-width="2" stroke-linecap="round"/>
          <circle cx="6" cy="6" r="2.5" fill="${drone.color}" opacity="0.7"/>
          <circle cx="26" cy="6" r="2.5" fill="${drone.color}" opacity="0.7"/>
          <circle cx="6" cy="26" r="2.5" fill="${drone.color}" opacity="0.7"/>
          <circle cx="26" cy="26" r="2.5" fill="${drone.color}" opacity="0.7"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

  return (
    <Marker position={[drone.lat, drone.lon]} icon={icon}>
      <Tooltip permanent direction="top" offset={[0, -18]}
        className="drone-tooltip"
      >
        <div style={{
          background: 'rgba(5,10,15,0.92)',
          border: `1px solid ${drone.color}55`,
          borderRadius: 4,
          padding: '3px 8px',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: drone.color,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
        }}>
          {drone.id} · {drone.alt?.toFixed ? drone.alt.toFixed(0) : drone.alt}m
        </div>
      </Tooltip>
    </Marker>
  )
}
