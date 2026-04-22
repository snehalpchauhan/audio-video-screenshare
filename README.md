# VoiceLink — Real-Time Chat + Audio/Video/Screen Share

A full-stack real-time communication app built with **Node.js**, **React**, **Socket.IO**, and **WebRTC**.

---

## ✨ Features

- 💬 **Global & Private Chat** — real-time text messaging
- 📹 **Video Calls** — 1-on-1 WebRTC peer-to-peer video calling
- 🎙️ **Audio-only Calls** — answer calls without video
- 🖥️ **Screen Share** — share your screen during a call
- 🔇 **Mute / Camera Toggle** — in-call media controls
- 👥 **Online Users Sidebar** — see who's online, click to DM or call
- 🔒 **HTTPS** — runs over HTTPS for camera/mic access on all devices
- 📱 **LAN accessible** — test from phone and desktop on same Wi-Fi

---

## 📁 Project Structure

```
Audio Video Web/
├── server/          ← Node.js + Express + Socket.IO (signaling server)
│   ├── index.js
│   ├── package.json
│   └── certs/       ← SSL certs (not committed — generate locally)
└── client/          ← React app
    ├── public/
    └── src/
        ├── components/
        │   ├── Chat.jsx
        │   ├── VideoCall.jsx
        │   ├── Sidebar.jsx
        │   └── Navbar.jsx
        ├── context/
        │   └── SocketContext.jsx   ← Socket.IO + WebRTC logic
        ├── App.js
        └── App.css
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v16+
- `openssl` (for SSL cert generation)

### 1. Install dependencies

```bash
# Server
cd server && npm install

# Client
cd client && npm install
```

### 2. Generate SSL certificate (required for camera/mic on LAN)

```bash
# Find your local IP first:
ipconfig getifaddr en0   # macOS

# Generate cert (replace 192.168.x.x with your IP)
mkdir -p server/certs
openssl req -x509 -newkey rsa:2048 \
  -keyout server/certs/key.pem \
  -out server/certs/cert.pem \
  -days 3650 -nodes \
  -subj "/CN=192.168.x.x" \
  -addext "subjectAltName=IP:192.168.x.x,IP:127.0.0.1,DNS:localhost"
```

### 3. Create client env file

Create `client/.env`:
```
HTTPS=true
SSL_CRT_FILE=../server/certs/cert.pem
SSL_KEY_FILE=../server/certs/key.pem
```

### 4. Start the app

```bash
# Terminal 1 — Server (HTTPS, port 5001)
cd server && node index.js

# Terminal 2 — Client (HTTPS, port 3000)
cd client && npm start
```

### 5. Access

| Device | URL |
|--------|-----|
| Desktop | https://localhost:3000 |
| Phone/LAN | https://192.168.x.x:3000 |

> **First time on phone:** Visit `https://192.168.x.x:5001/health` and accept the self-signed cert, then open the app.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Socket.IO Client, simple-peer |
| Backend | Node.js, Express, Socket.IO |
| Real-time video | WebRTC (via simple-peer) |
| Signaling | Socket.IO |
| Styling | Custom CSS (dark theme) |
| Security | HTTPS with self-signed SSL cert |

---

## 📊 Capacity

- **Concurrent users**: Hundreds (server only handles signaling, not media)
- **Call type**: 1-on-1 WebRTC (peer-to-peer, server not in media path)
- **Group calls**: Would require a media server (e.g. Mediasoup, Janus)

---

## 📄 License

MIT
