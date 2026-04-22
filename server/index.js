require("dotenv").config();
const express    = require("express");
const https      = require("https");
const http       = require("http");
const fs         = require("fs");
const path       = require("path");
const { Server } = require("socket.io");
const cors       = require("cors");
const jwt        = require("jsonwebtoken");
const bcrypt     = require("bcryptjs");
const { randomUUID: uuidv4 } = require("crypto");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Secrets ────────────────────────────────────────────────
const JWT_SECRET     = process.env.JWT_SECRET     || "voicelink-jwt-secret-change-in-prod";
const SESSION_SECRET = process.env.SESSION_SECRET || "voicelink-session-secret-change-in-prod";
const JWT_EXPIRES    = "24h";
const SESSION_EXPIRES = "1h"; // short-lived session tokens for third-party use

// ─── In-memory stores ────────────────────────────────────────
const usersDB  = {};  // { username: { id, username, passwordHash } }
const rooms    = {};  // { roomId: { id, name, createdBy, participants: Set<socketId>, ownerId } }
const sockets  = {};  // { socketId: { userId, username } }
const apiKeys  = {};  // { apiKey: { id, name, ownerId, createdAt } }

// ─── SSL Certs ───────────────────────────────────────────────
const certPath = path.join(__dirname, "certs", "cert.pem");
const keyPath  = path.join(__dirname, "certs", "key.pem");

let server;
let useTLS = false;
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const credentials = { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
  server = https.createServer(credentials, app);
  useTLS = true;
  console.log("🔒 HTTPS mode enabled");
} else {
  server = http.createServer(app);
  console.log("⚠️  HTTP mode (no certs found)");
}

// ─── Auth Middleware (regular JWT) ───────────────────────────
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
};

// ─── API Key Middleware ───────────────────────────────────────
const apiKeyMiddleware = (req, res, next) => {
  const key = req.headers["x-api-key"] || req.query.apiKey;
  if (!key) return res.status(401).json({ error: "Missing X-Api-Key header" });
  const entry = apiKeys[key];
  if (!entry) return res.status(401).json({ error: "Invalid API key" });
  req.apiKeyEntry = entry;
  next();
};

// ═══════════════════════════════════════════════════════════
//  HEALTH
// ═══════════════════════════════════════════════════════════

app.get("/health", (req, res) =>
  res.json({ status: "ok", tls: useTLS, users: Object.keys(usersDB).length, rooms: Object.keys(rooms).length })
);

// ═══════════════════════════════════════════════════════════
//  AUTH — Register / Login / Verify
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 * Body: { username, password }
 * Returns: { token, user }
 */
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });
  if (usersDB[username])
    return res.status(409).json({ error: "Username already taken" });
  if (password.length < 4)
    return res.status(400).json({ error: "Password must be at least 4 characters" });

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  usersDB[username] = { id, username, passwordHash };

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({ token, user: { id, username } });
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });

  const user = usersDB[username];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, username } });
});

/**
 * GET /api/auth/verify
 * Header: Authorization: Bearer <token>
 * Returns: { valid: true, user }
 */
app.get("/api/auth/verify", authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ═══════════════════════════════════════════════════════════
//  ROOMS — Create / List / Get
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/rooms
 * Header: Authorization: Bearer <token>
 * Returns: { rooms: [...] }
 */
app.get("/api/rooms", authMiddleware, (req, res) => {
  const list = Object.values(rooms).map((r) => ({
    id: r.id, name: r.name, createdBy: r.createdBy,
    participantCount: r.participants.size,
  }));
  res.json({ rooms: list });
});

/**
 * POST /api/rooms
 * Header: Authorization: Bearer <token>
 * Body: { name }
 * Returns: { room }
 */
app.post("/api/rooms", authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const id = uuidv4();
  rooms[id] = { id, name, createdBy: req.user.username, ownerId: req.user.id, participants: new Set() };
  res.status(201).json({ room: { id, name, createdBy: req.user.username, participantCount: 0 } });
});

/**
 * GET /api/rooms/:id
 * Header: Authorization: Bearer <token>
 * Returns: { room }
 */
app.get("/api/rooms/:id", authMiddleware, (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ room: { id: room.id, name: room.name, createdBy: room.createdBy, participantCount: room.participants.size } });
});

// ═══════════════════════════════════════════════════════════
//  API KEYS — Generate / List / Revoke
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/keys
 * Header: Authorization: Bearer <token>
 * Body: { name }   (friendly label for the key)
 * Returns: { apiKey, id, name }
 *
 * Third-party developers use this key to generate session tokens.
 */
app.post("/api/keys", authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  const keyId  = uuidv4();
  const apiKey = `vl_${uuidv4().replace(/-/g, "")}`;
  apiKeys[apiKey] = { id: keyId, name, ownerId: req.user.id, ownerUsername: req.user.username, createdAt: new Date().toISOString() };
  res.status(201).json({ apiKey, id: keyId, name, createdAt: apiKeys[apiKey].createdAt });
});

/**
 * GET /api/keys
 * Header: Authorization: Bearer <token>
 * Returns: { keys: [...] } (without the actual key value)
 */
app.get("/api/keys", authMiddleware, (req, res) => {
  const myKeys = Object.entries(apiKeys)
    .filter(([, v]) => v.ownerId === req.user.id)
    .map(([key, v]) => ({
      id: v.id, name: v.name, createdAt: v.createdAt,
      keyPreview: `${key.slice(0, 8)}...`, // show only prefix
    }));
  res.json({ keys: myKeys });
});

/**
 * DELETE /api/keys/:id
 * Header: Authorization: Bearer <token>
 * Returns: { success: true }
 */
app.delete("/api/keys/:id", authMiddleware, (req, res) => {
  const entry = Object.entries(apiKeys).find(([, v]) => v.id === req.params.id && v.ownerId === req.user.id);
  if (!entry) return res.status(404).json({ error: "Key not found" });
  delete apiKeys[entry[0]];
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════
//  SESSION TOKENS — Third-party API
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/sessions/token
 * Header: X-Api-Key: <your_api_key>
 * Body: {
 *   participantName: string,     // display name for the user
 *   roomId?: string,             // optional: join an existing room
 *   roomName?: string,           // optional: create a new room on-the-fly
 *   permissions?: {              // optional, defaults to all true
 *     video: bool,
 *     audio: bool,
 *     screen: bool,
 *   },
 *   expiresIn?: string           // optional, default "1h"
 * }
 * Returns: {
 *   sessionToken: string,        // JWT to use with Socket.IO auth
 *   roomId: string,
 *   roomName: string,
 *   joinUrl: string,             // direct URL to open in browser
 *   expiresAt: string
 * }
 *
 * Usage example:
 *   curl -X POST https://your-server:5001/api/sessions/token \
 *     -H "X-Api-Key: vl_abc123..." \
 *     -H "Content-Type: application/json" \
 *     -d '{ "participantName": "Alice", "roomName": "Team Standup" }'
 */
app.post("/api/sessions/token", apiKeyMiddleware, (req, res) => {
  const { participantName, roomId, roomName, permissions = {}, expiresIn } = req.body;

  if (!participantName)
    return res.status(400).json({ error: "participantName is required" });

  // Resolve or create the room
  let targetRoomId = roomId;
  let targetRoomName;

  if (targetRoomId) {
    if (!rooms[targetRoomId])
      return res.status(404).json({ error: "Room not found" });
    targetRoomName = rooms[targetRoomId].name;
  } else {
    // Auto-create room
    targetRoomId = uuidv4();
    targetRoomName = roomName || `Room-${targetRoomId.slice(0, 6)}`;
    rooms[targetRoomId] = {
      id: targetRoomId, name: targetRoomName,
      createdBy: req.apiKeyEntry.ownerUsername,
      ownerId: req.apiKeyEntry.ownerId,
      participants: new Set(),
    };
  }

  const expiry = expiresIn || SESSION_EXPIRES;
  const payload = {
    id: uuidv4(),                            // unique session id
    username: participantName,
    roomId: targetRoomId,
    isSessionToken: true,                    // marks it as a third-party session token
    permissions: {
      video:  permissions.video  !== false,  // default true
      audio:  permissions.audio  !== false,
      screen: permissions.screen !== false,
    },
    apiKeyId: req.apiKeyEntry.id,
  };

  const sessionToken = jwt.sign(payload, SESSION_SECRET, { expiresIn: expiry });

  // Compute expiry timestamp
  const decoded = jwt.decode(sessionToken);
  const expiresAt = new Date(decoded.exp * 1000).toISOString();

  const proto = useTLS ? "https" : "http";
  const host  = req.get("host") || `localhost:5001`;
  const clientHost = host.replace(":5001", ":3000"); // point to React app

  res.status(201).json({
    sessionToken,
    roomId: targetRoomId,
    roomName: targetRoomName,
    permissions: payload.permissions,
    expiresAt,
    joinUrl: `${proto}://${clientHost}?sessionToken=${sessionToken}`,
    socketUrl: `${proto}://${host}`,
    usage: {
      description: "Pass sessionToken to Socket.IO auth to join the room",
      example: `io("${proto}://${host}", { auth: { token: "<sessionToken>" } })`,
    },
  });
});

/**
 * GET /api/sessions/verify
 * Header: X-Session-Token: <session_token>
 * Returns: { valid: true, session: { username, roomId, permissions, expiresAt } }
 */
app.get("/api/sessions/verify", (req, res) => {
  const token = req.headers["x-session-token"];
  if (!token) return res.status(400).json({ error: "Missing X-Session-Token header" });
  try {
    const decoded = jwt.verify(token, SESSION_SECRET);
    res.json({
      valid: true,
      session: {
        username: decoded.username,
        roomId: decoded.roomId,
        permissions: decoded.permissions,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      },
    });
  } catch {
    res.status(401).json({ valid: false, error: "Token expired or invalid" });
  }
});

// ═══════════════════════════════════════════════════════════
//  SOCKET.IO — AUTH MIDDLEWARE
//  Accepts both regular JWT (users) and session tokens (third-party)
// ═══════════════════════════════════════════════════════════

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));

  // Try regular JWT first
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch { /* try session token */ }

  // Try session token (third-party)
  try {
    const session = jwt.verify(token, SESSION_SECRET);
    socket.user = { id: session.id, username: session.username, isSessionToken: true, roomId: session.roomId, permissions: session.permissions };
    return next();
  } catch {
    return next(new Error("Invalid or expired token"));
  }
});

// ═══════════════════════════════════════════════════════════
//  SOCKET.IO — EVENTS
// ═══════════════════════════════════════════════════════════

io.on("connection", (socket) => {
  const { id: userId, username } = socket.user;
  sockets[socket.id] = { userId, username };
  console.log(`🔌 ${username} connected (${socket.id})`);

  socket.emit("me", socket.id);

  // Auto-join room if session token specifies one
  if (socket.user.isSessionToken && socket.user.roomId) {
    socket.emit("auto-join-room", {
      roomId: socket.user.roomId,
      permissions: socket.user.permissions,
    });
  }

  // ─── User list ────────────────────────────────────────────
  socket.on("get-users", () => {
    const userList = Object.entries(sockets)
      .filter(([sid]) => sid !== socket.id)
      .map(([socketId, u]) => ({ socketId, name: u.username }));
    socket.emit("users", userList);
    socket.broadcast.emit("users",
      Object.entries(sockets).map(([socketId, u]) => ({ socketId, name: u.username }))
    );
  });

  // ─── Text Chat ────────────────────────────────────────────
  socket.on("send-message", ({ to, message, fromName, roomId: msgRoomId }) => {
    const payload = { message, from: socket.id, fromName: username, timestamp: Date.now() };
    if (msgRoomId) socket.to(msgRoomId).emit("receive-message", { ...payload, roomId: msgRoomId });
    else if (to)   io.to(to).emit("receive-message", payload);
    else           socket.broadcast.emit("receive-message", payload);
  });

  // ─── 1-on-1 WebRTC Signaling ──────────────────────────────
  socket.on("call-user",    ({ to, signal })       => io.to(to).emit("incoming-call",  { from: socket.id, signal, fromName: username }));
  socket.on("answer-call",  ({ to, signal })       => io.to(to).emit("call-accepted", signal));
  socket.on("reject-call",  ({ to })               => io.to(to).emit("call-rejected"));
  socket.on("end-call",     ({ to })               => io.to(to).emit("call-ended"));

  // ─── Group Call: Join Room ────────────────────────────────
  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) { socket.emit("room-error", "Room not found"); return; }

    socket.join(roomId);
    rooms[roomId].participants.add(socket.id);

    const existingParticipants = [...rooms[roomId].participants]
      .filter(sid => sid !== socket.id)
      .map(sid => ({ socketId: sid, username: sockets[sid]?.username }));

    socket.emit("room-joined", { roomId, roomName: rooms[roomId].name, participants: existingParticipants });
    socket.to(roomId).emit("user-joined-room", { socketId: socket.id, username });
    console.log(`👥 ${username} joined room: ${rooms[roomId].name}`);
  });

  // ─── Group Call: Mesh Signaling ───────────────────────────
  socket.on("room-signal", ({ to, signal, roomId }) => {
    io.to(to).emit("room-signal", { from: socket.id, fromName: username, signal, roomId });
  });

  // ─── Group Call: Leave Room ───────────────────────────────
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId].participants.delete(socket.id);
      socket.to(roomId).emit("user-left-room", { socketId: socket.id, username });
      console.log(`👋 ${username} left room: ${rooms[roomId].name}`);
    }
  });

  // ─── Disconnect ───────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`❌ ${username} disconnected`);
    Object.entries(rooms).forEach(([roomId, room]) => {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        socket.to(roomId).emit("user-left-room", { socketId: socket.id, username });
      }
    });
    delete sockets[socket.id];
    io.emit("users", Object.entries(sockets).map(([socketId, u]) => ({ socketId, name: u.username })));
    socket.broadcast.emit("user-disconnected", socket.id);
  });
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
server.listen(PORT, "0.0.0.0", () => {
  const proto = useTLS ? "https" : "http";
  console.log(`\n🚀 VoiceLink Server — ${proto}://0.0.0.0:${PORT}\n`);
  console.log("📡 REST API");
  console.log("  POST   /api/auth/register          → register user");
  console.log("  POST   /api/auth/login             → login → JWT");
  console.log("  GET    /api/auth/verify            → verify JWT [auth]");
  console.log("  GET    /api/rooms                  → list rooms [auth]");
  console.log("  POST   /api/rooms                  → create room [auth]");
  console.log("  GET    /api/rooms/:id              → get room [auth]");
  console.log("  POST   /api/keys                   → generate API key [auth]");
  console.log("  GET    /api/keys                   → list API keys [auth]");
  console.log("  DELETE /api/keys/:id               → revoke API key [auth]");
  console.log("\n🔑 Third-Party API (use X-Api-Key header)");
  console.log("  POST   /api/sessions/token         → create session token");
  console.log("  GET    /api/sessions/verify        → verify session token");
  console.log("\n🔌 WebSocket: connect with { auth: { token } }");
});
