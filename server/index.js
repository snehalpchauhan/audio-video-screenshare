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
const db         = require("./db");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Secrets ────────────────────────────────────────────────
const JWT_SECRET      = process.env.JWT_SECRET      || "voicelink-jwt-secret-change-in-prod";
const SESSION_SECRET  = process.env.SESSION_SECRET  || "voicelink-session-secret-change-in-prod";
const JWT_EXPIRES     = "24h";
const SESSION_EXPIRES = "1h";

// ─── In-memory session state (ephemeral — reset on restart) ──
const sockets          = {};  // { socketId: { userId, username } }
const roomParticipants = {};  // { roomId: Set<socketId> }

// ─── Helper: deduplicated user list (one entry per username) ──
// When a user has multiple tabs open, they appear only ONCE.
// The socket shown is the first registered one (stable across tab opens).
const getUniqueUsers = (excludeSocketId = null) => {
  const seen = new Set();
  const list = [];
  for (const [socketId, u] of Object.entries(sockets)) {
    if (!seen.has(u.username)) {
      seen.add(u.username);
      list.push({ socketId, name: u.username });
    }
  }
  return excludeSocketId ? list.filter(u => u.socketId !== excludeSocketId) : list;
};

// ─── SSL Certs (optional — reverse proxy handles TLS in prod) ─
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
  console.log("⚠️  HTTP mode (Apache/reverse proxy handles TLS)");
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
const apiKeyMiddleware = async (req, res, next) => {
  const key = req.headers["x-api-key"] || req.query.apiKey;
  if (!key) return res.status(401).json({ error: "Missing X-Api-Key header" });
  try {
    const result = await db.query("SELECT * FROM api_keys WHERE api_key = $1", [key]);
    if (!result.rows[0]) return res.status(401).json({ error: "Invalid API key" });
    req.apiKeyEntry = result.rows[0];
    next();
  } catch (err) {
    console.error("DB error in apiKeyMiddleware:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  HEALTH
// ═══════════════════════════════════════════════════════════

app.get("/health", async (req, res) => {
  try {
    const usersCount = await db.query("SELECT COUNT(*) FROM users");
    const roomsCount = await db.query("SELECT COUNT(*) FROM rooms");
    res.json({
      status: "ok",
      tls: useTLS,
      users: parseInt(usersCount.rows[0].count),
      rooms: parseInt(roomsCount.rows[0].count),
    });
  } catch {
    res.json({ status: "ok", tls: useTLS, db: "error" });
  }
});

// ═══════════════════════════════════════════════════════════
//  AUTH — Register / Login / Verify
// ═══════════════════════════════════════════════════════════

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

app.post("/api/auth/register", async (req, res) => {
  const { username, password, email, companyName } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });
  if (password.length < 4)
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  const emailTrim = typeof email === "string" ? email.trim() : "";
  const companyTrim = typeof companyName === "string" ? companyName.trim().slice(0, 255) : "";
  if (emailTrim && !EMAIL_RE.test(emailTrim))
    return res.status(400).json({ error: "Invalid email address" });
  try {
    const exists = await db.query("SELECT id FROM users WHERE username = $1", [username]);
    if (exists.rows[0]) return res.status(409).json({ error: "Username already taken" });
    if (emailTrim) {
      const emailTaken = await db.query("SELECT id FROM users WHERE email = $1", [emailTrim]);
      if (emailTaken.rows[0]) return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await db.query(
      "INSERT INTO users (id, username, password_hash, email, company_name) VALUES ($1, $2, $3, $4, $5)",
      [id, username, passwordHash, emailTrim || null, companyTrim || null]
    );
    const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({
      token,
      user: { id, username, email: emailTrim || null, companyName: companyTrim || null },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({
      token,
      user: {
        id: user.id,
        username,
        email: user.email || null,
        companyName: user.company_name || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/auth/verify", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, username, email, company_name FROM users WHERE id = $1",
      [req.user.id]
    );
    const u = result.rows[0];
    if (!u) return res.status(401).json({ error: "User not found" });
    res.json({
      valid: true,
      user: {
        id: u.id,
        username: u.username,
        email: u.email || null,
        companyName: u.company_name || null,
      },
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
//  ROOMS — Create / List / Get
// ═══════════════════════════════════════════════════════════

app.get("/api/rooms", authMiddleware, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM rooms ORDER BY created_at DESC");
    const list = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdBy: r.created_by,
      participantCount: roomParticipants[r.id]?.size || 0,
    }));
    res.json({ rooms: list });
  } catch (err) {
    console.error("List rooms error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/rooms", authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const id = uuidv4();
    await db.query(
      "INSERT INTO rooms (id, name, created_by, owner_id) VALUES ($1, $2, $3, $4)",
      [id, name, req.user.username, req.user.id]
    );
    res.status(201).json({ room: { id, name, createdBy: req.user.username, participantCount: 0 } });
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/rooms/:id", authMiddleware, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM rooms WHERE id = $1", [req.params.id]);
    const room = result.rows[0];
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json({
      room: {
        id: room.id,
        name: room.name,
        createdBy: room.created_by,
        participantCount: roomParticipants[room.id]?.size || 0,
      },
    });
  } catch (err) {
    console.error("Get room error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
//  API KEYS — Generate / List / Revoke
// ═══════════════════════════════════════════════════════════

app.post("/api/keys", authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const keyId  = uuidv4();
    const apiKey = `vl_${uuidv4().replace(/-/g, "")}`;
    await db.query(
      "INSERT INTO api_keys (id, api_key, name, owner_id, owner_username) VALUES ($1, $2, $3, $4, $5)",
      [keyId, apiKey, name, req.user.id, req.user.username]
    );
    const row = await db.query("SELECT created_at FROM api_keys WHERE id = $1", [keyId]);
    res.status(201).json({ apiKey, id: keyId, name, createdAt: row.rows[0].created_at });
  } catch (err) {
    console.error("Create API key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/keys", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, api_key, name, created_at FROM api_keys WHERE owner_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    const myKeys = result.rows.map((k) => ({
      id: k.id,
      name: k.name,
      createdAt: k.created_at,
      keyPreview: `${k.api_key.slice(0, 8)}...`,
    }));
    res.json({ keys: myKeys });
  } catch (err) {
    console.error("List keys error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/keys/:id", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM api_keys WHERE id = $1 AND owner_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Key not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete key error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
//  SESSION TOKENS — Third-party API
// ═══════════════════════════════════════════════════════════

app.post("/api/sessions/token", apiKeyMiddleware, async (req, res) => {
  const { participantName, roomId, roomName, permissions = {}, expiresIn } = req.body;
  if (!participantName)
    return res.status(400).json({ error: "participantName is required" });

  try {
    let targetRoomId = roomId;
    let targetRoomName;

    if (targetRoomId) {
      const result = await db.query("SELECT * FROM rooms WHERE id = $1", [targetRoomId]);
      if (!result.rows[0]) return res.status(404).json({ error: "Room not found" });
      targetRoomName = result.rows[0].name;
    } else {
      targetRoomId = uuidv4();
      targetRoomName = roomName || `Room-${targetRoomId.slice(0, 6)}`;
      await db.query(
        "INSERT INTO rooms (id, name, created_by, owner_id) VALUES ($1, $2, $3, $4)",
        [targetRoomId, targetRoomName, req.apiKeyEntry.owner_username, req.apiKeyEntry.owner_id]
      );
    }

    const expiry = expiresIn || SESSION_EXPIRES;
    const payload = {
      id: uuidv4(),
      username: participantName,
      roomId: targetRoomId,
      isSessionToken: true,
      permissions: {
        video:  permissions.video  !== false,
        audio:  permissions.audio  !== false,
        screen: permissions.screen !== false,
      },
      apiKeyId: req.apiKeyEntry.id,
    };

    const sessionToken = jwt.sign(payload, SESSION_SECRET, { expiresIn: expiry });
    const decoded  = jwt.decode(sessionToken);
    const expiresAt = new Date(decoded.exp * 1000).toISOString();

    const proto = useTLS ? "https" : "http";
    const host  = req.get("host") || `localhost:5001`;
    const clientHost = host.replace(":5001", "");

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
  } catch (err) {
    console.error("Session token error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
// ═══════════════════════════════════════════════════════════

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));

  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch { /* try session token */ }

  try {
    const session = jwt.verify(token, SESSION_SECRET);
    socket.user = {
      id: session.id,
      username: session.username,
      isSessionToken: true,
      roomId: session.roomId,
      permissions: session.permissions,
    };
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

  // ── One socket per user: disconnect any stale sockets for this user ──
  // This handles browser reconnects, multiple tabs, hot-reloads, etc.
  Object.entries(sockets).forEach(([existingId, u]) => {
    if (u.username === username) {
      console.log(`⚡ Replacing stale socket for ${username}: ${existingId}`);
      const staleSocket = io.sockets.sockets.get(existingId);
      if (staleSocket) staleSocket.disconnect(true);
      delete sockets[existingId];
    }
  });

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
    // Send deduplicated list — each username appears exactly once
    socket.emit("users", getUniqueUsers(socket.id));
    socket.broadcast.emit("users", getUniqueUsers());
  });

  // ─── Text Chat ────────────────────────────────────────────
  socket.on("send-message", ({ to, message, fromName, roomId: msgRoomId }) => {
    const payload = { message, from: socket.id, fromName: username, timestamp: Date.now() };
    if (msgRoomId) socket.to(msgRoomId).emit("receive-message", { ...payload, roomId: msgRoomId });
    else if (to)   io.to(to).emit("receive-message", payload);
    else           socket.broadcast.emit("receive-message", payload);
  });

  // ─── 1-on-1 WebRTC Signaling ──────────────────────────────
  socket.on("call-user", ({ to, signal, videoCall }) => {
    io.to(to).emit("incoming-call", {
      from: socket.id, signal, fromName: username,
      videoCall: videoCall !== false, // pass through so callee knows call type
    });
  });
  socket.on("answer-call", ({ to, signal }) => io.to(to).emit("call-accepted", signal));
  socket.on("reject-call", ({ to })         => io.to(to).emit("call-rejected"));
  socket.on("end-call",    ({ to })         => io.to(to).emit("call-ended"));

  // ─── Group Call: Join Room ────────────────────────────────
  socket.on("join-room", async (roomId) => {
    try {
      const result = await db.query("SELECT * FROM rooms WHERE id = $1", [roomId]);
      if (!result.rows[0]) { socket.emit("room-error", "Room not found"); return; }
      const room = result.rows[0];

      if (!roomParticipants[roomId]) roomParticipants[roomId] = new Set();
      socket.join(roomId);
      roomParticipants[roomId].add(socket.id);

      const existingParticipants = [...roomParticipants[roomId]]
        .filter(sid => sid !== socket.id)
        .map(sid => ({ socketId: sid, username: sockets[sid]?.username }));

      socket.emit("room-joined", { roomId, roomName: room.name, participants: existingParticipants });
      socket.to(roomId).emit("user-joined-room", { socketId: socket.id, username });

      // Notify ALL online users when first person starts a group call
      if (existingParticipants.length === 0) {
        socket.broadcast.emit("group-call-started", {
          roomId,
          roomName: room.name,
          callerName: username,
          callerSocketId: socket.id,
        });
      }

      console.log(`👥 ${username} joined room: ${room.name}`);
    } catch (err) {
      console.error("join-room error:", err);
      socket.emit("room-error", "Server error joining room");
    }
  });

  // ─── Group Call: Mesh Signaling ───────────────────────────
  socket.on("room-signal", ({ to, signal, roomId }) => {
    io.to(to).emit("room-signal", { from: socket.id, fromName: username, signal, roomId });
  });

  // ─── Group Call: Screen Share Status ─────────────────────
  // Relay to all other participants in the room so they can update layout
  socket.on("room-screenshare-status", ({ roomId, sharing }) => {
    socket.to(roomId).emit("room-screenshare-status", { socketId: socket.id, sharing });
  });

  // ─── Group Call: Leave Room ───────────────────────────────
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    if (roomParticipants[roomId]) {
      roomParticipants[roomId].delete(socket.id);
      socket.to(roomId).emit("user-left-room", { socketId: socket.id, username });
      console.log(`👋 ${username} left room ${roomId}`);
    }
  });

  // ─── Disconnect ───────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`❌ ${username} disconnected`);
    Object.entries(roomParticipants).forEach(([roomId, participants]) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        socket.to(roomId).emit("user-left-room", { socketId: socket.id, username });
      }
    });
    delete sockets[socket.id];
    // Broadcast deduplicated list after disconnect
    io.emit("users", getUniqueUsers());
    socket.broadcast.emit("user-disconnected", socket.id);
  });
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
server.listen(PORT, "0.0.0.0", () => {
  const proto = useTLS ? "https" : "http";
  console.log(`\n🚀 VoiceLink Server — ${proto}://0.0.0.0:${PORT}`);
  console.log(`📦 Database: ${process.env.DB_NAME || "voicelink"}@${process.env.DB_HOST || "localhost"}\n`);
});
