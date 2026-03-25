import threading
import time
import logging

log = logging.getLogger("drone_hw")

# Try importing dronekit — not installed = hardware disabled
try:
    import collections, collections.abc
    collections.MutableMapping = collections.abc.MutableMapping
    collections.Iterable = collections.abc.Iterable
    import dronekit as dk
    from pymavlink import mavutil
    HAS_DRONEKIT = True
except ImportError:
    HAS_DRONEKIT = False
    log.warning("dronekit not installed — hardware disabled")

SERIAL_PORT  = "/dev/ttyACM0"
BAUD_RATE    = 57600
MOTOR_PWM    = 1200          # very slow spin, props-off safe
MOTOR_COUNT  = 4
REFRESH_S    = 1.8           # re-send motor test every N seconds (cmd has 2s timeout)

_vehicle     = None
_motor_thread: threading.Thread | None = None
_spinning    = False
_connected   = False


# ── Connection ────────────────────────────────────────────────────────────────
def connect():
    """Try to connect once. Silently no-ops if hardware absent."""
    global _vehicle, _connected
    if not HAS_DRONEKIT:
        return
    try:
        log.info(f"Connecting to physical drone on {SERIAL_PORT}…")
        _vehicle = dk.connect(SERIAL_PORT, wait_ready=False,
                              baud=BAUD_RATE, heartbeat_timeout=10)
        _vehicle.wait_heartbeat()
        # Disable arming checks — motor test without props
        _vehicle.parameters['ARMING_CHECK'] = 0
        _connected = True
        log.info("Physical drone connected ✓")
    except Exception as e:
        _vehicle    = None
        _connected  = False
        log.warning(f"Physical drone not available ({e}) — continuing without hardware")


# ── Motor helpers ─────────────────────────────────────────────────────────────
def _send_motor_test(motor_id: int, pwm: int, duration: float):
    if not _vehicle:
        return
    try:
        msg = _vehicle.message_factory.command_long_encode(
            0, 0,
            mavutil.mavlink.MAV_CMD_DO_MOTOR_TEST,
            0,
            motor_id,                                    # motor number (1-based)
            mavutil.mavlink.MOTOR_TEST_THROTTLE_PWM,     # use raw PWM
            pwm,                                         # PWM value
            duration,                                    # duration seconds
            MOTOR_COUNT,                                 # motor count
            0, 0
        )
        _vehicle.send_mavlink(msg)
        _vehicle.flush()
    except Exception as e:
        log.warning(f"Motor test send failed: {e}")


def _spin_all(pwm: int, duration: float):
    for motor_id in range(1, MOTOR_COUNT + 1):
        _send_motor_test(motor_id, pwm, duration)


# ── Continuous spin loop (runs in background thread) ─────────────────────────
def _motor_loop():
    """Keep re-sending motor test commands while _spinning is True.
    MAV_CMD_DO_MOTOR_TEST stops automatically after its duration expires,
    so we re-send slightly before that to maintain continuous spin."""
    global _spinning
    log.info("Motor loop started")
    while _spinning:
        _spin_all(MOTOR_PWM, REFRESH_S + 0.5)   # command duration > sleep interval
        time.sleep(REFRESH_S)
    # Send a zero-PWM command to make sure motors stop
    _spin_all(1000, 0.5)
    log.info("Motor loop stopped")


# ── Public API (called from main.py) ─────────────────────────────────────────
def start_motors():
    global _spinning, _motor_thread
    if not _connected:
        return
    if _spinning:
        return
    _spinning     = True
    _motor_thread = threading.Thread(target=_motor_loop, daemon=True)
    _motor_thread.start()
    log.info("Motors spinning")


def stop_motors():
    global _spinning
    if not _connected:
        return
    _spinning = False
    log.info("Motors stopping")


def status() -> dict:
    return {
        "connected": _connected,
        "spinning":  _spinning,
        "port":      SERIAL_PORT if _connected else None,
    }
