from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import math
import json
import random
import time
from typing import List, Dict, Any
import threading
import drone_hardware as hw


app = FastAPI(title="SYNERVOL Drone Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Start real drone thread ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Runs in a thread so it doesn't block the event loop during the 10s timeout
    threading.Thread(target=hw.connect, daemon=True).start()


# ── FIXED HOME (takeoff / landing point, never changes) ───────────────────────
HOME_LAT = 48.81430786259582
HOME_LON = 2.3951368389402865

DRONE_CONFIGS = [
    {"id": "Drone LEADER", "color": "#00FFFF", "sector": 0},   # West third
    {"id": "Drone FOLLOWER-1",  "color": "#FF6B35", "sector": 1},   # Centre third
    {"id": "Drone FOLLOWER-2", "color": "#A855F7", "sector": 2},   # East third
]

# ── GLOBAL STATE ──────────────────────────────────────────────────────────────
mission_state: Dict[str, Any] = {
    "running": False,
    "drones": {},
    "detections": [],
    "pending_detections": [],   # pre-placed, not yet triggered
    "waypoints": {},
    "start_time": None,
    "paused": False,
}
connected_clients: List[WebSocket] = []


# ── GEOMETRY ──────────────────────────────────────────────────────────────────
def offset_coords(lat: float, lon: float, dNorth: float, dEast: float):
    """Offset a lat/lon by metres North and East."""
    R = 6378137.0
    dLat = dNorth / R * (180 / math.pi)
    dLon = dEast  / (R * math.cos(math.pi * lat / 180)) * (180 / math.pi)
    return lat + dLat, lon + dLon


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    """Approximate distance in metres between two lat/lon points."""
    R = 6378137.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def boustrophedon_sector(center_lat, center_lon, radius, sector_idx,
                         altitude=15, fov=60, overlap=0.2):
    """
    Lawnmower waypoints clipped to one of 3 vertical sectors of a circle.
    Sectors split the circle into equal West / Centre / East bands.

    Coordinate frame  (relative to circle centre, in metres):
        Y = North-South   (rows of the scan pattern)
        X = West-East     (sector split axis)

    Sector 0  ALPHA-1  x ∈ [-r,  -r/3]
    Sector 1  BETA-2   x ∈ [-r/3, r/3]
    Sector 2  GAMMA-3  x ∈ [ r/3,   r]
    """
    sector_width = (2 * radius) / 3
    x_sec_min = -radius + sector_idx * sector_width
    x_sec_max = x_sec_min + sector_width

    footprint = 4 * altitude * math.tan(math.radians(fov / 2))
    spacing   = footprint * (1 - overlap)

    waypoints = []
    y         = -radius
    direction = 1

    while y <= radius:
        # Circle chord at this y
        x_chord = math.sqrt(max(0.0, radius**2 - y**2))
        # Clip sector bounds to the chord
        x_min = max(x_sec_min, -x_chord)
        x_max = min(x_sec_max,  x_chord)

        if x_max - x_min >= 0.5:   # only emit if meaningful width
            if direction == 1:
                p1 = offset_coords(center_lat, center_lon, y, x_min)
                p2 = offset_coords(center_lat, center_lon, y, x_max)
            else:
                p1 = offset_coords(center_lat, center_lon, y, x_max)
                p2 = offset_coords(center_lat, center_lon, y, x_min)
            waypoints.append({"lat": p1[0], "lon": p1[1]})
            waypoints.append({"lat": p2[0], "lon": p2[1]})
            direction *= -1

        y += spacing

    return waypoints


def circle_polygon(lat, lon, radius, steps=72):
    """Return a closed polygon approximating the search circle."""
    pts = []
    for i in range(steps + 1):
        angle = 2 * math.pi * i / steps
        p = offset_coords(lat, lon, radius * math.cos(angle), radius * math.sin(angle))
        pts.append({"lat": p[0], "lon": p[1]})
    return pts


def sector_chord_line(center_lat, center_lon, radius, x_offset):
    """
    Returns the two endpoints of a vertical chord at East-offset = x_offset.
    Used to draw sector boundary lines on the map.
    """
    y_span = math.sqrt(max(0.0, radius**2 - x_offset**2))
    p1 = offset_coords(center_lat, center_lon, -y_span, x_offset)
    p2 = offset_coords(center_lat, center_lon,  y_span, x_offset)
    return [{"lat": p1[0], "lon": p1[1]}, {"lat": p2[0], "lon": p2[1]}]


def place_detections(center_lat, center_lon, radius, count):
    """
    Pre-place `count` detection spots randomly inside the search circle.
    Each spot is assigned to the drone whose sector contains it.
    Returns a list of pending-detection dicts (not yet broadcast).
    """
    pending = []
    for _ in range(count):
        # Uniform random point inside circle (not too close to edge)
        for _attempt in range(50):
            angle = random.uniform(0, 2 * math.pi)
            r     = radius * math.sqrt(random.uniform(0.05, 0.80))
            dN    = r * math.cos(angle)
            dE    = r * math.sin(angle)
            # Assign sector by East-offset
            if   dE < -radius / 3:  sector, drone_id = 0, "Drone LEADER"
            elif dE <  radius / 3:  sector, drone_id = 1, "Drone FOLLOWER-1"
            else:                   sector, drone_id = 2, "Drone FOLLOWER-2"
            lat, lon = offset_coords(center_lat, center_lon, dN, dE)
            pending.append({
                "id":         f"det_{int(time.time()*1000)}_{drone_id}_{len(pending)}",
                "lat":        lat,
                "lon":        lon,
                "drone_id":   drone_id,
                "confidence": random.randint(72, 98),
                "triggered":  False,
            })
            break
    return pending
    

# ── PAUSE HELPER ─────────────────────────────────────────────────────────────
async def wait_if_paused():
    """Suspend coroutine while mission is paused, without blocking the event loop."""
    while mission_state.get("paused") and mission_state.get("running"):
        await asyncio.sleep(0.1)


# ── BROADCAST ─────────────────────────────────────────────────────────────────
async def broadcast(data: Dict[str, Any]):
    dead = []
    msg  = json.dumps(data)
    for ws in connected_clients:
        try:    await ws.send_text(msg)
        except: dead.append(ws)
    for ws in dead:
        connected_clients.remove(ws)


# ── DRONE SIMULATION ──────────────────────────────────────────────────────────
async def simulate_drone(drone_cfg: dict, waypoints: list):
    drone_id = drone_cfg["id"]
    color    = drone_cfg["color"]

    if not waypoints:
        return

    # All drones take off from the fixed HOME position
    home_lat, home_lon = HOME_LAT, HOME_LON

    mission_state["drones"][drone_id] = {
        "id":       drone_id,
        "color":    color,
        "lat":      home_lat,
        "lon":      home_lon,
        "alt":      0,
        "status":   "TAKEOFF",
        "battery":  100,
        "speed":    0,
        "wp_index": 0,
        "traveled": [],
    }

    # ── Takeoff ───────────────────────────────────────────────────────────────
    for alt in range(0, 16):
        if not mission_state["running"]: break
        mission_state["drones"][drone_id]["alt"] = alt
        await broadcast({"type": "drone_update", "drone": mission_state["drones"][drone_id]})
        await asyncio.sleep(0.10)

    mission_state["drones"][drone_id]["status"] = "SCANNING"
    cur_lat, cur_lon = home_lat, home_lon
    total_wps = len(waypoints)

    # ── Fly each waypoint ─────────────────────────────────────────────────────
    for wp_i, wp in enumerate(waypoints):
        if not mission_state["running"]: break

        mission_state["drones"][drone_id]["wp_index"] = wp_i
        target_lat, target_lon = wp["lat"], wp["lon"]
        steps = 30

        for step in range(steps + 1):
            if not mission_state["running"]: break
            t   = step / steps
            lat = cur_lat + (target_lat - cur_lat) * t
            lon = cur_lon + (target_lon - cur_lon) * t

            drone = mission_state["drones"][drone_id]
            drone["lat"]     = lat
            drone["lon"]     = lon
            drone["battery"] = max(20, 100 - (wp_i / total_wps) * 65)
            drone["speed"]   = round(random.uniform(7.5, 9.5), 1)
            drone["traveled"].append({"lat": lat, "lon": lon})

            await broadcast({"type": "drone_update", "drone": drone})

            # ── Check proximity to pre-placed detections ───────────────────
            for det in mission_state["pending_detections"]:
                if det["triggered"] or det["drone_id"] != drone_id:
                    continue
                dist = haversine_m(lat, lon, det["lat"], det["lon"])
                if dist < 25:          # within 25 m → trigger
                    det["triggered"] = True
                    event = {
                        "id":         det["id"],
                        "lat":        det["lat"],
                        "lon":        det["lon"],
                        "drone_id":   drone_id,
                        "confidence": det["confidence"],
                        "timestamp":  int(time.time()),
                    }
                    mission_state["detections"].append(event)
                    await broadcast({"type": "detection", "detection": event})

            await wait_if_paused()
            await asyncio.sleep(0.045)

        cur_lat, cur_lon = target_lat, target_lon

    # ── RTL back to HOME ──────────────────────────────────────────────────────
    mission_state["drones"][drone_id]["status"] = "RTL"
    await broadcast({"type": "drone_update", "drone": mission_state["drones"][drone_id]})

    steps = 50
    for step in range(steps + 1):
        #if not mission_state["running"]: return
        t   = step / steps
        lat = cur_lat + (home_lat - cur_lat) * t
        lon = cur_lon + (home_lon - cur_lon) * t
        mission_state["drones"][drone_id]["lat"] = lat
        mission_state["drones"][drone_id]["lon"] = lon
        mission_state["drones"][drone_id]["traveled"].append({"lat": lat, "lon": lon})
        await broadcast({"type": "drone_update", "drone": mission_state["drones"][drone_id]})
        await wait_if_paused()
        await asyncio.sleep(0.04)

    mission_state["drones"][drone_id]["status"] = "LANDED"
    mission_state["drones"][drone_id]["speed"]  = 0
    await broadcast({"type": "drone_update", "drone": mission_state["drones"][drone_id]})

    # Reset mission when every drone has landed
    all_landed = all(d["status"] == "LANDED" for d in mission_state["drones"].values())
    if all_landed:
        mission_state["running"] = False
        hw.stop_motors()
        await broadcast({"type": "mission_stop"})


# ── API ───────────────────────────────────────────────────────────────────────
@app.get("/api/config")
def get_config():
    return {"home": {"lat": HOME_LAT, "lon": HOME_LON}, "drones": DRONE_CONFIGS}


@app.post("/api/mission/start")
async def start_mission(body: dict):
    global mission_state
    if mission_state["running"]:
        return {"status": "already_running"}

    radius     = float(body.get("radius", 80))
    altitude   = float(body.get("altitude", 15))
    center_lat = float(body.get("center_lat", HOME_LAT))
    center_lon = float(body.get("center_lon", HOME_LON))

    # Pre-place 1-3 person detections
    num_detections = random.randint(1, 3)
    pending        = place_detections(center_lat, center_lon, radius, num_detections)

    mission_state = {
        "running":             True,
        "paused":              False,
        "drones":              {},
        "detections":          [],
        "pending_detections":  pending,
        "waypoints":           {},
        "start_time":          time.time(),
    }

    # Sector boundary lines for UI (x = ±radius/3)
    chord_west   = sector_chord_line(center_lat, center_lon, radius, -radius / 3)
    chord_east   = sector_chord_line(center_lat, center_lon, radius,  radius / 3)

    # Generate per-sector boustrophedon paths
    for cfg in DRONE_CONFIGS:
        wps = boustrophedon_sector(center_lat, center_lon, radius, cfg["sector"], altitude)
        mission_state["waypoints"][cfg["id"]] = wps

    await broadcast({
        "type":        "mission_start",
        "radius":      radius,
        "altitude":    altitude,
        "center_lat":  center_lat,
        "center_lon":  center_lon,
        "circle":      circle_polygon(center_lat, center_lon, radius),
        "waypoints":   mission_state["waypoints"],
        "sector_lines": [chord_west, chord_east],
    })

    for cfg in DRONE_CONFIGS:
        asyncio.create_task(simulate_drone(cfg, mission_state["waypoints"][cfg["id"]]))

    hw.start_motors()
    return {"status": "started", "radius": radius, "detections_planted": num_detections}


@app.post("/api/mission/stop")
async def stop_mission():
    mission_state["running"] = False
    hw.stop_motors()
    await broadcast({"type": "mission_stop"})
    return {"status": "stopped"}


@app.get("/api/mission/state")
def get_state():
    return mission_state

@app.post("/api/mission/pause")
async def pause_mission():
    mission_state["paused"] = True
    await broadcast({"type": "mission_paused"})
    return {"status": "paused"}


@app.post("/api/mission/resume")
async def resume_mission():
    mission_state["paused"] = False
    await broadcast({"type": "mission_resumed"})
    return {"status": "resumed"}

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.append(ws)
    await ws.send_text(json.dumps({"type": "state", "state": {
        "running":    mission_state["running"],
        "drones":     mission_state["drones"],
        "detections": mission_state["detections"],
    }}))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in connected_clients:
            connected_clients.remove(ws)

@app.get("/api/hardware")
def hardware_status():
    return hw.status()
