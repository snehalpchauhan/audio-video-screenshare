# VoiceLink — Real-Time Chat + Audio/Video/Screen Share

A full-stack real-time communication app built with **Node.js**, **React**, **Socket.IO**, and **WebRTC**.

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 💬 **Text Chat** | Global chat + private DMs |
| 📹 **1-on-1 Video Calls** | WebRTC peer-to-peer |
| 🎙️ **Audio-only Calls** | Answer without video |
| 🖥️ **Screen Share** | During 1-on-1 call (replaces camera) |
| 👥 **Group Video Calls** | Up to N participants, mesh WebRTC |
| 🔔 **Group Call Notifications** | All online users get a ring toast with 30s countdown |
| 🔇 **Mute / Camera Toggle** | In-call media controls |
| 🔐 **JWT Authentication** | Register / Login / 24h token |
| 🔑 **API Keys** | Generate keys to allow third-party integration |
| 🎟️ **Session Tokens** | Third-parties create tokens for guests to join calls |
| 📱 **LAN accessible** | Works on phone + desktop over same WiFi |
| 🔒 **HTTPS** | Camera/mic work on all devices |

---

## 📁 Project Structure

```
Audio Video Web/
├── server/          ← Node.js + Express + Socket.IO (signaling + REST API)
│   ├── index.js
│   ├── package.json
│   └── certs/       ← SSL certs (not committed — generate locally)
└── client/          ← React app
    ├── public/
    └── src/
        ├── components/
        │   ├── Chat.jsx                  ← Text chat UI
        │   ├── VideoCall.jsx             ← 1-on-1 video call overlay
        │   ├── GroupCall.jsx             ← Group video call (multi-stream grid)
        │   ├── GroupCallNotification.jsx ← Ring notification toast
        │   ├── Sidebar.jsx               ← Online users + navigation
        │   └── Navbar.jsx                ← Top bar + logout
        ├── context/
        │   └── SocketContext.jsx         ← Socket.IO + WebRTC logic
        ├── services/
        │   └── api.js                    ← REST API client (auth + rooms)
        ├── App.js                        ← Auth + routing + view switching
        └── App.css                       ← Global dark theme styles
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
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
# Find your local IP:
ipconfig getifaddr en0   # macOS

# Generate self-signed cert
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

## 🔔 Group Call Notification Flow

When a user starts a group call (joins a room first), **all other online users** automatically receive a notification toast:

```
Alice joins "Team Standup" room
      ↓
Server broadcasts group-call-started to ALL online users
      ↓
Bob sees: "📹 Alice started a group call in Team Standup"
           [Join (28s)]  [✕]
      ↓
Bob clicks Join → camera/mic opens → WebRTC mesh connects
      ↓
Alice and Bob see each other's video in a grid
```

- **30-second countdown** timer auto-dismisses if ignored
- **Progress bar** shrinks live showing time remaining
- Notification hidden if user is already in a call/room

---

## 🔑 Third-Party API Integration

Allow external systems to create video call sessions for their users.

### Step 1 — Get an API key
Register/login to VoiceLink → **API Keys** tab → Generate Key

### Step 2 — Create a session token (from your backend)

```bash
curl -X POST https://your-server:5001/api/sessions/token \
  -H "X-Api-Key: vl_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "participantName": "Alice",
    "roomName": "Team Standup",
    "permissions": { "video": true, "audio": true, "screen": true },
    "expiresIn": "1h"
  }'
```

**Response:**
```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiJ...",
  "roomId": "uuid",
  "roomName": "Team Standup",
  "joinUrl": "https://your-client:3000?sessionToken=eyJ...",
  "expiresAt": "2025-01-01T13:00:00Z",
  "permissions": { "video": true, "audio": true, "screen": true }
}
```

### Step 3 — Send the `joinUrl` to your user
They open it in a browser → automatically join the video call room.

### Step 4 (advanced) — Custom Socket.IO integration
```js
const socket = io("https://your-server:5001", {
  auth: { token: sessionToken }   // sessionToken from Step 2
});
// User is now authenticated and auto-joined to the room
```

---

## 📡 Full API Reference

### Auth (regular users)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register → JWT |
| POST | `/api/auth/login` | — | Login → JWT |
| GET | `/api/auth/verify` | Bearer JWT | Verify token |

### Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rooms` | Bearer JWT | List all rooms |
| POST | `/api/rooms` | Bearer JWT | Create room |
| GET | `/api/rooms/:id` | Bearer JWT | Get room info |

### API Keys

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/keys` | Bearer JWT | Generate API key |
| GET | `/api/keys` | Bearer JWT | List your API keys |
| DELETE | `/api/keys/:id` | Bearer JWT | Revoke API key |

### Third-Party Session Tokens

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/sessions/token` | X-Api-Key | Create session token for a guest |
| GET | `/api/sessions/verify` | X-Session-Token | Verify session token |

### WebSocket (Socket.IO)

Connect with:
```js
io("https://server:5001", { auth: { token: "<JWT or sessionToken>" } })
```

#### Events emitted by client:
| Event | Payload | Description |
|-------|---------|-------------|
| `get-users` | — | Get online users list |
| `send-message` | `{ message, to?, roomId? }` | Send chat message |
| `call-user` | `{ to, signal }` | Initiate 1-on-1 call |
| `answer-call` | `{ to, signal }` | Answer 1-on-1 call |
| `end-call` | `{ to }` | End 1-on-1 call |
| `join-room` | `roomId` | Join group call room |
| `room-signal` | `{ to, signal }` | WebRTC signal for group call |
| `leave-room` | `roomId` | Leave group call room |

#### Events emitted by server:
| Event | Description |
|-------|-------------|
| `me` | Your socket ID |
| `users` | Updated list of online users |
| `incoming-call` | Someone is calling you (1-on-1) |
| `call-accepted` | Your call was answered |
| `call-ended` | Call was ended by other party |
| `room-joined` | Successfully joined a room + existing participants |
| `user-joined-room` | Another user joined your room |
| `user-left-room` | A user left your room |
| `group-call-started` | 🔔 A user started a group call (ring notification) |
| `room-signal` | WebRTC signal from another room participant |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Socket.IO Client, simple-peer |
| Backend | Node.js, Express, Socket.IO |
| Real-time video | WebRTC (via simple-peer, mesh topology) |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| Signaling | Socket.IO |
| Styling | Custom CSS (dark theme, CSS variables) |
| Security | HTTPS with self-signed SSL cert |

---

## 📊 Architecture Notes

### Group Call (Mesh WebRTC)
Each participant connects directly to every other participant. The server only handles **signaling** (not media).

- ✅ Low latency (peer-to-peer)
- ✅ Server not in media path
- ⚠️ Scales to ~6 participants (mesh: N×(N-1)/2 connections)
- For larger groups (10+), use a media server (Mediasoup, Janus)

### Authentication
- Regular users: JWT (24h) — stored in localStorage
- Third-party guests: Session token (1h, signed with different secret) — passed as URL param

---

## 📄 License

MIT
