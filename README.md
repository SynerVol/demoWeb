# SYNERVOL — Swarm Ground Control Station

Real-time drone swarm mission interface for firefighter search & rescue.

```
┌─────────────────────────────────────────────────────────────┐
│  Internet  ──►  Cloudflare Tunnel  ──►  Nginx  ──►  React  │
│                                             └──►  FastAPI  │
└─────────────────────────────────────────────────────────────┘
```

## Stack

| Layer        | Tech                              |
|--------------|-----------------------------------|
| Frontend     | React 18 + Vite + React-Leaflet   |
| Backend      | Python 3.11 + FastAPI + WebSocket |
| Reverse proxy| Nginx (inside frontend container) |
| Tunnel       | Cloudflare cloudflared            |
| Orchestration| Docker Compose                    |

---

## Quick Start

### 1. Configure your Cloudflare Tunnel

In the Cloudflare dashboard (Zero Trust → Networks → Tunnels):
- Create or open your tunnel
- Add a **Public Hostname** pointing to `http://frontend:80`
  - Service type: `HTTP`
  - URL: `frontend:80`
- Copy the tunnel **Token**

### 2. Set your token

```bash
cp .env.example .env
# Edit .env and paste your token:
# CLOUDFLARE_TUNNEL_TOKEN=eyJhI...
```

### 3. Build & launch

```bash
docker compose up --build -d
```

Your app is now live at your configured Cloudflare domain (HTTPS + WSS automatically).

---

## Local dev (no tunnel)

```bash
# Frontend dev server with HMR
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
```

---

## Features

- **3-drone boustrophedon swarm** — ALPHA-1, BETA-2, GAMMA-3
- **Live Google Satellite map** centered on Paris Est
- **Planned path** (dashed) + **real trail** drawn per drone
- **Random person detection events** → red dots on map + alert feed
- **Telemetry panel**: altitude, battery, speed, flight status
- **Abort mission** button
- **WebSocket** reconnects automatically on drop

---

## File structure

```
synervol/
├── docker-compose.yml
├── .env.example            ← copy to .env and add token
├── backend/
│   ├── Dockerfile
│   ├── main.py             ← FastAPI + drone simulation
│   └── requirements.txt
└── frontend/
    ├── Dockerfile          ← multi-stage: Vite build → Nginx
    ├── nginx.conf          ← reverse proxy for /api + /ws
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        └── components/
            ├── TopBar.jsx
            ├── Sidebar.jsx
            ├── DroneMarker.jsx
            └── AlertFeed.jsx
```
