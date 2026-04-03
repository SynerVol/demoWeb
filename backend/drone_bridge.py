"""
drone_bridge.py
---------------
Middle-ground between the pure simulation in main.py and the real
ArduPilot vehicle managed by drone_hardware.py.
 
How it works
────────────
• If dronekit connected (drone_hardware._connected is True):
    - A background thread continuously reads GLOBAL_POSITION_INT, battery,
      airspeed and attitude from the dronekit vehicle object.
    - goto_waypoint() sends a GUIDED-mode LocationGlobalRelative command.
    - get_telemetry() returns the live dict for that drone.
 
• If not connected (hardware absent / serial error):
    - get_telemetry() returns None → main.py falls back to its own
      interpolated simulation, nothing breaks.
    - goto_waypoint() is a no-op.
 
Integration in main.py (minimal changes)
─────────────────────────────────────────
Add at the top:
    import drone_bridge as bridge
 
In simulate_drone(), replace the inner loop block with:
 
    # ── real telemetry overlay ──────────────────────────────────────────────
    real = bridge.get_telemetry(drone_id)
    if real:
        drone["lat"]     = real["lat"]
        drone["lon"]     = real["lon"]
        drone["alt"]     = real["alt"]
        drone["battery"] = real["battery"]
        drone["speed"]   = real["speed"]
    else:
        # simulation interpolation (unchanged)
        drone["lat"] = cur_lat + (target_lat - cur_lat) * t
        drone["lon"] = cur_lon + (target_lon - cur_lon) * t
        drone["battery"] = max(20, 100 - (wp_i / total_wps) * 65)
        drone["speed"]   = round(random.uniform(7.5, 9.5), 1)
 
At each new waypoint (before the inner step loop), add:
    bridge.goto_waypoint(target_lat, target_lon, altitude)
 
No other changes needed.
 
Device note
───────────
docker-compose.yml already has device_cgroup_rules for ttyACM*.
Make sure you also have the `devices:` key:
 
    devices:
      - "/dev/ttyACM0:/dev/ttyACM0"
"""
 
import threading
import time
import logging
from typing import Optional
 
import drone_hardware as hw   # existing file — provides _vehicle, _connected
 
log = logging.getLogger("drone_bridge")
 
# ── Internal state ────────────────────────────────────────────────────────────
 
# Single real drone mapped to LEADER slot; others remain simulated.
_REAL_DRONE_ID = "Drone LEADER"
 
_telemetry: dict = {}          # latest telemetry dict (empty = not available)
_lock       = threading.Lock()
_poll_thread: Optional[threading.Thread] = None
_running    = False
 
 
# ── Telemetry polling thread ──────────────────────────────────────────────────
 
def _poll_loop(poll_hz: float = 5.0):
    """
    Reads live data from the dronekit vehicle at `poll_hz` Hz.
    Runs in a daemon thread started by init().
    """
    global _running
    interval = 1.0 / poll_hz
    log.info("drone_bridge poll loop started")
 
    while _running:
        vehicle = hw._vehicle          # may become None if disconnected
 
        if vehicle is None or not hw._connected:
            with _lock:
                _telemetry.clear()    # signal "no real data"
            time.sleep(interval)
            continue
 
        try:
            loc  = vehicle.location.global_relative_frame
            att  = vehicle.attitude
            bat  = vehicle.battery
            gnd  = vehicle.groundspeed
            mode = str(vehicle.mode.name) if vehicle.mode else "UNKNOWN"
            armed = bool(vehicle.armed)
 
            # Heading from attitude (yaw), convert radians → degrees
            import math
            heading = math.degrees(att.yaw) % 360 if att else 0.0
 
            telem = {
                "lat":      loc.lat  if loc  else 0.0,
                "lon":      loc.lon  if loc  else 0.0,
                "alt":      round(loc.alt, 1) if loc else 0.0,
                "battery":  round(bat.level or 0, 1),
                "speed":    round(gnd or 0.0, 1),
                "heading":  round(heading, 1),
                "mode":     mode,
                "armed":    armed,
                "status":   _map_status(mode, armed),
            }
 
            with _lock:
                _telemetry.update(telem)
 
        except Exception as exc:
            log.warning(f"Telemetry read error: {exc}")
            with _lock:
                _telemetry.clear()
 
        time.sleep(interval)
 
    log.info("drone_bridge poll loop stopped")
 
 
def _map_status(mode: str, armed: bool) -> str:
    """Map ArduPilot mode → frontend status string."""
    if not armed:
        return "LANDED"
    return {
        "RTL":    "RTL",
        "LAND":   "LANDED",
        "AUTO":   "SCANNING",
        "GUIDED": "SCANNING",
    }.get(mode, "TAKEOFF")
 
 
# ── Public API ────────────────────────────────────────────────────────────────
 
def init(poll_hz: float = 5.0):
    """
    Start the background polling thread.
    Call once at startup (e.g. alongside hw.connect()).
    Safe to call even when hardware is absent — the thread will idle.
    """
    global _poll_thread, _running
    if _poll_thread and _poll_thread.is_alive():
        return   # already running
    _running     = True
    _poll_thread = threading.Thread(
        target=_poll_loop, args=(poll_hz,), daemon=True, name="bridge-poll"
    )
    _poll_thread.start()
    log.info("drone_bridge initialised")
 
 
def shutdown():
    """Stop the polling thread cleanly."""
    global _running
    _running = False
 
 
def get_telemetry(drone_id: str) -> Optional[dict]:
    """
    Return the latest real telemetry dict for `drone_id`, or None if:
      • hardware not connected, OR
      • drone_id is not the real drone (FOLLOWER drones stay simulated).
 
    The returned dict has keys: lat, lon, alt, battery, speed, heading,
    mode, armed, status — matching the fields main.py already broadcasts.
    """
    if drone_id != _REAL_DRONE_ID:
        return None          # only LEADER is real; followers stay simulated
    if not hw._connected:
        return None
    with _lock:
        if not _telemetry:
            return None      # poll thread hasn't received data yet
        return dict(_telemetry)
 
 
def goto_waypoint(lat: float, lon: float, alt: float = 15.0):
    """
    Command the real drone to fly to (lat, lon, alt) in GUIDED mode.
    No-op when hardware is absent or drone_id isn't the real slot.
    """
    if not hw._connected or hw._vehicle is None:
        return
    try:
        from dronekit import LocationGlobalRelative   # type: ignore
        from pymavlink import mavutil                 # type: ignore
 
        vehicle = hw._vehicle
 
        # Switch to GUIDED if not already
        if str(vehicle.mode.name) not in ("GUIDED", "AUTO"):
            vehicle.mode = __import__("dronekit").VehicleMode("GUIDED")
            _wait_for_mode(vehicle, "GUIDED", timeout=3.0)
 
        target = LocationGlobalRelative(lat, lon, alt)
        vehicle.simple_goto(target)
        log.debug(f"goto_waypoint → lat={lat:.6f} lon={lon:.6f} alt={alt}m")
 
    except Exception as exc:
        log.warning(f"goto_waypoint failed: {exc}")
 
 
def abort(rtl: bool = True):
    """
    Command the real drone to RTL (or LAND).
    Called from main.py's stop_mission / abort handler.
    """
    if not hw._connected or hw._vehicle is None:
        return
    try:
        mode_name = "RTL" if rtl else "LAND"
        hw._vehicle.mode = __import__("dronekit").VehicleMode(mode_name)
        log.warning(f"drone_bridge: sent {mode_name} to real drone")
    except Exception as exc:
        log.warning(f"abort command failed: {exc}")
 
 
def status() -> dict:
    """Extended status combining drone_hardware + bridge state."""
    with _lock:
        telem_copy = dict(_telemetry)
    return {
        **hw.status(),
        "real_drone_id": _REAL_DRONE_ID,
        "telemetry":     telem_copy or None,
        "poll_active":   bool(_poll_thread and _poll_thread.is_alive()),
    }
 
 
# ── Internal helpers ──────────────────────────────────────────────────────────
 
def _wait_for_mode(vehicle, mode_name: str, timeout: float = 5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if str(vehicle.mode.name) == mode_name:
            return
        time.sleep(0.1)
    log.warning(f"Timed out waiting for mode {mode_name}")
