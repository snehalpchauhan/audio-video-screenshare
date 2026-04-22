require("dotenv").config();
const express = require("express");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Load SSL certs (for HTTPS / WSS) ────────────────────────
const certPath = path.join(__dirname, "certs", "cert.pem");
const keyPath  = path.join(__dirname, "certs", "key.pem");

let server;
let useTLS = false;
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const credentials = {
    cert: fs.readFileSync(certPath),
    key:  fs.readFileSync(keyPath),
  };
  server = https.createServer(credentials, app);
  useTLS = true;
  console.log("🔒 HTTPS mode enabled");
} else {
  server = http.createServer(app);
  console.log("⚠️  HTTP mode (no certs found)");
}

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store connected users: { socketId -> { name, socketId } }
const users = {};

io.on("connection", (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // ─── User joins ─────────────────────────────────────────
  socket.on("join", (name) => {
    users[socket.id] = { name, socketId: socket.id };
    console.log(`👤 ${name} joined (${socket.id})`);

    // Tell everyone the updated user list
    io.emit("users", Object.values(users));

    // Tell the new user their own socket id
    socket.emit("me", socket.id);
  });

  // ─── Text Chat ──────────────────────────────────────────
  socket.on("send-message", ({ to, message, from, fromName }) => {
    if (to) {
      io.to(to).emit("receive-message", { message, from, fromName });
    } else {
      socket.broadcast.emit("receive-message", { message, from, fromName });
    }
  });

  // ─── WebRTC Signaling ────────────────────────────────────
  socket.on("call-user", ({ to, from, signal, fromName }) => {
    io.to(to).emit("incoming-call", { from, signal, fromName });
  });

  socket.on("answer-call", ({ to, signal }) => {
    io.to(to).emit("call-accepted", signal);
  });

  socket.on("reject-call", ({ to }) => {
    io.to(to).emit("call-rejected");
  });

  socket.on("end-call", ({ to }) => {
    io.to(to).emit("call-ended");
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { candidate });
  });

  // ─── Disconnect ──────────────────────────────────────────
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      console.log(`❌ ${user.name} disconnected`);
    }
    delete users[socket.id];
    io.emit("users", Object.values(users));
    socket.broadcast.emit("user-disconnected", socket.id);
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", tls: useTLS }));

const PORT = process.env.PORT || 5001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on https://0.0.0.0:${PORT}`);
});
