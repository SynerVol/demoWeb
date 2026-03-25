import React, { useState, useEffect, useRef } from 'react'
import {
  MapContainer, TileLayer, Polyline, Polygon,
  CircleMarker, Marker, useMapEvents, Tooltip
} from 'react-leaflet'
import L from 'leaflet'
import Sidebar    from './components/Sidebar.jsx'
import TopBar     from './components/TopBar.jsx'
import DroneMarker from './components/DroneMarker.jsx'
import AlertFeed  from './components/AlertFeed.jsx'

const WS_URL = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
  : 'ws://localhost:8000/ws'

const HOME = [48.81430786259582, 2.3951368389402865]
const DRONE_COLORS = { 'Drone LEADER': '#00FFFF', 'Drone FOLLOWER-1': '#FF6B35', 'Drone FOLLOWER-2': '#A855F7' }

// ── Home base icon ────────────────────────────────────────────────────────────
const homeIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;
    background:#ffd60a;
    border:2px solid #fff;
    border-radius:3px;
    transform:translate(-50%,-50%) rotate(45deg);
    box-shadow:0 0 10px #ffd60a88;
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// ── Search-center icon ────────────────────────────────────────────────────────
const targetIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:24px;height:24px;transform:translate(-50%,-50%)">
    <div style="position:absolute;inset:0;border:2px solid #ff2d55;border-radius:50%;animation:glow 2s infinite"></div>
    <div style="position:absolute;inset:8px;background:#ff2d55;border-radius:50%"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// ── Right-click handler component ────────────────────────────────────────────
function RightClickHandler({ onRightClick, disabled }) {
  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault()
      if (!disabled) onRightClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function App() {
  const [drones,       setDrones]       = useState({})
  const [detections,   setDetections]   = useState([])
  const [circlePoints, setCirclePoints] = useState([])
  const [sectorLines,  setSectorLines]  = useState([])   // [[p1,p2],[p1,p2]]
  const [waypointsMap, setWaypointsMap] = useState({})
  const [running,      setRunning]      = useState(false)
  const [radius,       setRadius]       = useState(80)
  const [altitude,     setAltitude]     = useState(15)
  const [alerts,       setAlerts]       = useState([])
  const [stats,        setStats]        = useState({ elapsed: 0 })
  const [wsConnected,  setWsConnected]  = useState(false)
  // Search area center (right-click to move; defaults to HOME)
  const [searchCenter, setSearchCenter] = useState(HOME)

  const wsRef        = useRef(null)
  const startTimeRef = useRef(null)
  const timerRef     = useRef(null)

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen  = () => setWsConnected(true)
      ws.onclose = () => { setWsConnected(false); setTimeout(connect, 2000) }

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)

        if (msg.type === 'state') {
          setDrones(msg.state.drones || {})
          setDetections(msg.state.detections || [])
          setRunning(msg.state.running)
        }

        if (msg.type === 'mission_start') {
          setRunning(true)
          setDrones({})
          setDetections([])
          setAlerts([])
          setCirclePoints(msg.circle.map(p => [p.lat, p.lon]))
          setSectorLines(msg.sector_lines.map(line => line.map(p => [p.lat, p.lon])))
          const wm = {}
          for (const [id, wps] of Object.entries(msg.waypoints))
            wm[id] = wps.map(p => [p.lat, p.lon])
          setWaypointsMap(wm)
          startTimeRef.current = Date.now()
        }

        if (msg.type === 'mission_stop') {
          setRunning(false)
          clearInterval(timerRef.current)
        }

        if (msg.type === 'drone_update') {
          const d = msg.drone
          setDrones(prev => ({ ...prev, [d.id]: d }))
          /*setDrones(prev => {
            const updated = { ...prev, [d.id]: d }
            // Auto-reset when every drone has landed
            const allLanded =
              Object.keys(updated).length === 3 &&
              Object.values(updated).every(dr => dr.status === 'LANDED')
            if (allLanded) setRunning(false)
            return updated
          })*/

        }

        if (msg.type === 'detection') {
          const det = msg.detection
          setDetections(prev => [...prev, det])
          setAlerts(prev => [{
            id:         det.id,
            text:       `${det.drone_id} — PERSON DETECTED`,
            confidence: det.confidence,
            time:       new Date().toLocaleTimeString(),
          }, ...prev.slice(0, 9)])
        }
      }
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  // ── Mission timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000)
        setStats({ elapsed })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  // ── API calls ──────────────────────────────────────────────────────────────
  const startMission = async () => {
    await fetch('/api/mission/start', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        radius,
        altitude,
        center_lat: searchCenter[0],
        center_lon: searchCenter[1],
      }),
    })
  }

  const stopMission = () => fetch('/api/mission/stop', { method: 'POST' })

  const handleRightClick = (coords) => {
    setSearchCenter(coords)
    // Clear previous mission overlay when zone changes
    setCirclePoints([])
    setSectorLines([])
    setWaypointsMap({})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar wsConnected={wsConnected} running={running} stats={stats} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          running={running}
          radius={radius}     setRadius={setRadius}
          altitude={altitude} setAltitude={setAltitude}
          drones={drones}
          detections={detections}
          onStart={startMission}
          onStop={stopMission}
          searchCenter={searchCenter}
        />

        {/* MAP */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={HOME}
            zoom={16}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&s=Ga"
              maxZoom={22}
            />

            {/* Right-click handler */}
            <RightClickHandler onRightClick={handleRightClick} disabled={running} />

            {/* HOME base marker */}
            <Marker position={HOME} icon={homeIcon}>
              <Tooltip permanent direction="top" offset={[0, -12]}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#ffd60a' }}>
                  HOME BASE
                </span>
              </Tooltip>
            </Marker>

            {/* Search-center target marker (only if different from HOME) */}
            {(searchCenter[0] !== HOME[0] || searchCenter[1] !== HOME[1]) && (
              <Marker position={searchCenter} icon={targetIcon}>
                <Tooltip permanent direction="top" offset={[0, -14]}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#ff2d55' }}>
                    SEARCH AREA
                  </span>
                </Tooltip>
              </Marker>
            )}

            {/* Zone circle */}
            {circlePoints.length > 0 && (
              <Polygon
                positions={circlePoints}
                pathOptions={{
                  color: '#ff2d55', fillColor: '#ff2d55',
                  fillOpacity: 0.06, weight: 1.5, dashArray: '6 4',
                }}
              />
            )}

            {/* Sector divider lines */}
            {sectorLines.map((line, i) => (
              <Polyline
                key={`sector-${i}`}
                positions={line}
                pathOptions={{ color: '#ffffff', opacity: 0.25, weight: 1, dashArray: '4 8' }}
              />
            ))}

            {/* Planned waypoint paths (dashed, per drone color) */}
            {Object.entries(waypointsMap).map(([id, wps]) => (
              <Polyline
                key={`plan-${id}`}
                positions={wps}
                pathOptions={{
                  color: DRONE_COLORS[id] || '#fff',
                  opacity: 0.18, weight: 1, dashArray: '3 7',
                }}
              />
            ))}

            {/* Actual traveled paths */}
            {Object.values(drones).map(d =>
              d.traveled?.length > 1 && (
                <Polyline
                  key={`trail-${d.id}`}
                  positions={d.traveled.map(p => [p.lat, p.lon])}
                  pathOptions={{ color: d.color, opacity: 0.75, weight: 2 }}
                />
              )
            )}

            {/* Drone markers */}
            {Object.values(drones).map(d => (
              <DroneMarker key={d.id} drone={d} />
            ))}

            {/* Detection markers */}
            {detections.map(det => (
              <DetectionMarker key={det.id} detection={det} />
            ))}
          </MapContainer>

          {/* Hint when no zone set */}
          {!running && searchCenter[0] === HOME[0] && (
            <div style={{
              position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000, background: 'rgba(5,10,15,0.85)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
              padding: '8px 18px', backdropFilter: 'blur(8px)',
              fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.4)',
              letterSpacing: 1, pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              RIGHT-CLICK MAP TO SET SEARCH AREA CENTER
            </div>
          )}

          {/* Detection count badge */}
          {detections.length > 0 && (
            <div style={{
              position: 'absolute', top: 16, right: 16, zIndex: 1000,
              background: 'rgba(5,10,15,0.92)', border: '1px solid rgba(255,45,85,0.4)',
              borderRadius: 8, padding: '10px 16px', backdropFilter: 'blur(8px)',
              fontFamily: 'var(--sans)',
            }}>
              <div style={{ color: '#ff2d55', fontSize: 11, letterSpacing: 2, marginBottom: 2 }}>
                DETECTIONS
              </div>
              <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                {detections.length}
              </div>
            </div>
          )}

          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </div>
  )
}

// ── Detection marker with pulse rings ─────────────────────────────────────────
function DetectionMarker({ detection }) {
  return (
    <>
      <CircleMarker
        center={[detection.lat, detection.lon]}
        radius={14}
        pathOptions={{ color: '#ff2d55', fillColor: '#ff2d55', fillOpacity: 0.12, weight: 1.5 }}
      />
      <CircleMarker
        center={[detection.lat, detection.lon]}
        radius={5}
        pathOptions={{ color: '#ff2d55', fillColor: '#ff2d55', fillOpacity: 1, weight: 0 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: '#ff2d55' }}>
            {detection.confidence}% · {detection.drone_id}
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  )
}
