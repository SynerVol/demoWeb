import os
import time
import asyncio
import logging
import shutil
from pathlib import Path
from fastapi import FastAPI
 import main  # To access broadcast and mission_state

log = logging.getLogger("detection_watcher")

# Configuration
DETECTION_DIR = Path("/detections")
# We need a place to serve files from so the browser can see them
# Usually, we copy them to a 'static' folder inside the backend
STATIC_DIR = Path("./static/detections") 

class DetectionWatcher:
    def __init__(self, app: FastAPI):
        self.app = app
        self.running = False
        # Ensure directories exist
        STATIC_DIR.mkdir(parents=True, exist_ok=True)

    async def watch_loop(self):
        """Periodically checks for new images in the shared volume."""
        self.running = True
        log.info(f"Watching {DETECTION_DIR} for new human detections...")
        
        while self.running:
            try:
                # List all image files
                files = [f for f in DETECTION_DIR.glob("*") if f.suffix.lower() in [".jpg", ".jpeg", ".png"]]
                
                for file_path in files:
                    await self.process_detection(file_path)
                
            except Exception as e:
                log.error(f"Error in detection watcher: {e}")
            
            await asyncio.sleep(2)  # Check every 2 seconds

    async def process_detection(self, file_path: Path):
        """Processes a single file: moves it to static, updates state, and notifies frontend."""
        filename = file_path.name
        destination = STATIC_DIR / filename

        # 1. Move/Copy the file to the web-accessible folder
        # Moving is better if you want to 'consume' the folder so it doesn't re-detect
        shutil.move(str(file_path), str(destination))

        # 2. Identify which drone was closest (optional logic)
        # For now, we'll label it as an external high-priority detection
        timestamp = int(time.time())
        detection_id = f"img_{timestamp}_{filename.split('.')[0]}"
        
        # 3. Create the event
        event = {
            "id": detection_id,
            "type": "IMAGE_DETECTION",
            "url": f"/static/detections/{filename}", # URL for the frontend
            "timestamp": timestamp,
            "label": "Human Detected",
        }

        # 4. Update global state in main.py
        import main
        main.mission_state["detections"].append(event)

        # 5. Broadcast to all connected WebSockets
        await main.broadcast({
            "type": "detection",
            "detection": event
        })
        
        log.info(f"New detection processed: {filename}")

    def stop(self):
        self.running = False

# Helper to start the watcher from main.py
async def start_detection_service(app: FastAPI):
    watcher = DetectionWatcher(app)
    asyncio.create_task(watcher.watch_loop())
