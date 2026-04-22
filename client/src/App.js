import React, { useState, useEffect } from "react";
import "./App.css";
import { SocketProvider, useSocket } from "./context/SocketContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import VideoCall from "./components/VideoCall";
import GroupCall from "./components/GroupCall";
import GroupCallNotification from "./components/GroupCallNotification";
import { FiVideo, FiLogIn, FiUserPlus, FiKey, FiPlus, FiUsers, FiCopy, FiCheckCircle } from "react-icons/fi";
import {
  authAPI, roomsAPI,
  getToken, setToken, clearToken,
  getUser, setUser, clearUser,
} from "./services/api";

// ─── Main App shell (inside SocketProvider) ──────────────────
function AppShell() {
  const { setLoggedInUser, currentRoom } = useSocket();
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeView, setActiveView] = useState("chat"); // "chat" | "rooms" | "apikeys"

  return (
    <div className="app-container">
      <Navbar />
      {currentRoom ? (
        // Group call takes full screen
        <GroupCall />
      ) : (
        <div className="main-layout">
          <Sidebar
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            activeView={activeView}
            setActiveView={setActiveView}
          />
          <div className="content-area">
            {activeView === "chat" && <Chat selectedUser={selectedUser} />}
            {activeView === "rooms" && <RoomsView />}
            {activeView === "apikeys" && <ApiKeysView />}
          </div>
        </div>
      )}
      {/* 1-on-1 call overlay */}
      <VideoCall />
    </div>
  );
}

// ─── Rooms view ───────────────────────────────────────────────
function RoomsView() {
  const { joinRoom } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchRooms = async () => {
    try {
      const data = await roomsAPI.list();
      setRooms(data.rooms);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await roomsAPI.create(newRoomName.trim());
      setNewRoomName("");
      fetchRooms();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rooms-view">
      <div className="view-header">
        <FiUsers size={18} />
        <h2>Group Call Rooms</h2>
      </div>

      {/* Create room form */}
      <form className="create-room-form" onSubmit={createRoom}>
        <input
          className="join-input"
          placeholder="New room name..."
          value={newRoomName}
          onChange={e => setNewRoomName(e.target.value)}
          autoComplete="off"
        />
        <button className="join-btn create-btn" type="submit" disabled={creating || !newRoomName.trim()}>
          <FiPlus size={16} />
          {creating ? "Creating..." : "Create"}
        </button>
      </form>

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <p className="muted-text">Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <div className="empty-state">
          <FiUsers size={40} />
          <p>No rooms yet. Create one above!</p>
        </div>
      ) : (
        <div className="rooms-list">
          {rooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-card-info">
                <span className="room-card-name">{room.name}</span>
                <span className="room-card-meta">
                  Created by {room.createdBy} · {room.participantCount} in call
                </span>
              </div>
              <button className="btn-join-room" onClick={() => joinRoom(room.id)}>
                <FiVideo size={14} /> Join
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── API Keys view ────────────────────────────────────────────
function ApiKeysView() {
  const [keys, setKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null); // show generated key once
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Session token generator state
  const [sessionForm, setSessionForm] = useState({ participantName: "", roomName: "", apiKey: "" });
  const [sessionResult, setSessionResult] = useState(null);
  const [genError, setGenError] = useState("");

  const fetchKeys = async () => {
    try {
      const data = await authAPI.verify(); // just to stay in sync
      const kData = await fetch(
        `https://${window.location.hostname}:5001/api/keys`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const kJson = await kData.json();
      setKeys(kJson.keys || []);
    } catch {}
  };

  useEffect(() => { fetchKeys(); }, []);

  const createKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true); setError("");
    try {
      const res = await fetch(
        `https://${window.location.hostname}:5001/api/keys`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ name: newKeyName.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewKey(data.apiKey);
      setNewKeyName("");
      fetchKeys();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateSessionToken = async (e) => {
    e.preventDefault();
    setGenError(""); setSessionResult(null);
    try {
      const res = await fetch(
        `https://${window.location.hostname}:5001/api/sessions/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": sessionForm.apiKey },
          body: JSON.stringify({
            participantName: sessionForm.participantName,
            roomName: sessionForm.roomName || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionResult(data);
    } catch (e) {
      setGenError(e.message);
    }
  };

  return (
    <div className="apikeys-view">
      <div className="view-header">
        <FiKey size={18} />
        <h2>API Keys & Third-Party Integration</h2>
      </div>

      {/* How it works */}
      <div className="api-explainer">
        <h3>How Third-Party Integration Works</h3>
        <ol>
          <li>Generate an <strong>API Key</strong> below</li>
          <li>Your backend calls <code>POST /api/sessions/token</code> with the API key</li>
          <li>Server returns a <strong>session token</strong> + <code>joinUrl</code></li>
          <li>Send the <code>joinUrl</code> to your users — they open it and join the call directly</li>
          <li>Or use the <code>sessionToken</code> with Socket.IO for a custom integration</li>
        </ol>
        <div className="code-block">
          <code>
            {`curl -X POST https://your-server:5001/api/sessions/token \\
  -H "X-Api-Key: vl_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"participantName":"Alice","roomName":"Team Call"}'`}
          </code>
        </div>
      </div>

      {/* Create new API key */}
      <h3 className="section-title">Your API Keys</h3>
      <form className="create-room-form" onSubmit={createKey}>
        <input
          className="join-input"
          placeholder="Key name (e.g. My App)"
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          autoComplete="off"
        />
        <button className="join-btn create-btn" type="submit" disabled={creating || !newKeyName.trim()}>
          <FiPlus size={16} />
          {creating ? "Generating..." : "Generate Key"}
        </button>
      </form>

      {error && <p className="error-msg">{error}</p>}

      {/* Show new key once */}
      {newKey && (
        <div className="new-key-banner">
          <span className="key-label">🔑 Copy your key now — it won't be shown again:</span>
          <div className="key-display">
            <code>{newKey}</code>
            <button className="copy-btn" onClick={() => copyKey(newKey)}>
              {copied ? <FiCheckCircle size={16} /> : <FiCopy size={16} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length > 0 && (
        <div className="keys-list">
          {keys.map(k => (
            <div key={k.id} className="key-card">
              <div>
                <span className="key-name">{k.name}</span>
                <span className="key-preview">{k.keyPreview}</span>
              </div>
              <span className="key-date">{new Date(k.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Session Token Generator (try it out) */}
      <h3 className="section-title" style={{ marginTop: 32 }}>Try It — Generate Session Token</h3>
      <form className="session-form" onSubmit={generateSessionToken}>
        <input className="join-input" placeholder="API Key (vl_...)" value={sessionForm.apiKey}
          onChange={e => setSessionForm(p => ({ ...p, apiKey: e.target.value }))} />
        <input className="join-input" placeholder="Participant name" value={sessionForm.participantName}
          onChange={e => setSessionForm(p => ({ ...p, participantName: e.target.value }))} />
        <input className="join-input" placeholder="Room name (or leave blank to auto-create)"
          value={sessionForm.roomName}
          onChange={e => setSessionForm(p => ({ ...p, roomName: e.target.value }))} />
        <button className="join-btn" type="submit" disabled={!sessionForm.apiKey || !sessionForm.participantName}>
          Generate Session Token
        </button>
      </form>

      {genError && <p className="error-msg">{genError}</p>}

      {sessionResult && (
        <div className="session-result">
          <p className="result-label">✅ Session token created! Expires: {new Date(sessionResult.expiresAt).toLocaleTimeString()}</p>
          <div className="result-item">
            <span>Join URL:</span>
            <a href={sessionResult.joinUrl} target="_blank" rel="noreferrer" className="join-link">
              {sessionResult.joinUrl}
            </a>
            <button className="copy-btn" onClick={() => copyKey(sessionResult.joinUrl)}>
              <FiCopy size={14} /> Copy
            </button>
          </div>
          <div className="result-item">
            <span>Room:</span>
            <code>{sessionResult.roomName} ({sessionResult.roomId})</code>
          </div>
          <div className="result-item">
            <span>Permissions:</span>
            <code>{JSON.stringify(sessionResult.permissions)}</code>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auth screen (Login / Register) ──────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = mode === "login"
        ? await authAPI.login(username.trim(), password)
        : await authAPI.register(username.trim(), password);
      setToken(data.token);
      setUser(data.user);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-logo"><FiVideo size={32} /></div>
        <h1 className="join-title">VoiceLink</h1>
        <p className="join-subtitle">
          {mode === "login" ? "Sign in to start chatting & calling" : "Create your account"}
        </p>

        {error && <p className="error-msg">{error}</p>}

        <form className="join-form" onSubmit={submit}>
          <input
            className="join-input"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <input
            className="join-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          <button
            className="join-btn"
            type="submit"
            disabled={loading || !username.trim() || !password}
          >
            {mode === "login" ? <FiLogIn size={18} /> : <FiUserPlus size={18} />}
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="join-hint">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            className="link-btn"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────
export default function App() {
  const [user, setUser_] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sessionTokenJoin, setSessionTokenJoin] = useState(null);

  useEffect(() => {
    // Check for session token in URL (third-party join)
    const params = new URLSearchParams(window.location.search);
    const sessionToken = params.get("sessionToken");
    if (sessionToken) {
      setSessionTokenJoin(sessionToken);
      setChecking(false);
      return;
    }

    // Check stored token
    const token = getToken();
    const storedUser = getUser();
    if (token && storedUser) {
      authAPI.verify()
        .then(() => setUser_(storedUser))
        .catch(() => { clearToken(); clearUser(); })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const handleAuth = (userData) => {
    setUser_(userData);
    // Force page reload to reconnect socket with new token
    window.location.reload();
  };

  const handleLogout = () => {
    clearToken(); clearUser();
    window.location.reload();
  };

  if (checking) {
    return (
      <div className="join-screen">
        <div style={{ color: "var(--text-2)", fontSize: "1rem" }}>Loading...</div>
      </div>
    );
  }

  // Third-party session token join
  if (sessionTokenJoin) {
    return (
      <SocketProvider>
        <SessionTokenJoin token={sessionTokenJoin} />
      </SocketProvider>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <SocketProvider>
      <AppShellWithLogout onLogout={handleLogout} />
    </SocketProvider>
  );
}

// ─── App shell with logout wired in ──────────────────────────
function AppShellWithLogout({ onLogout }) {
  const { setLoggedInUser, currentRoom } = useSocket();
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeView, setActiveView] = useState("chat");
  const user = getUser();

  useEffect(() => {
    if (user) setLoggedInUser(user.username);
  }, [user, setLoggedInUser]);

  return (
    <div className="app-container">
      <Navbar onLogout={onLogout} />
      {currentRoom ? (
        <GroupCall />
      ) : (
        <div className="main-layout">
          <Sidebar
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            activeView={activeView}
            setActiveView={setActiveView}
          />
          <div className="content-area">
            {activeView === "chat" && <Chat selectedUser={selectedUser} />}
            {activeView === "rooms" && <RoomsView />}
            {activeView === "apikeys" && <ApiKeysView />}
          </div>
        </div>
      )}
      <VideoCall />
      {/* Group call ring notification — shown to all online users */}
      <GroupCallNotification />
    </div>
  );
}

// ─── Session Token Join (third-party embed) ───────────────────
function SessionTokenJoin({ token }) {
  const { setLoggedInUser, joinRoom, currentRoom } = useSocket();
  const [status, setStatus] = useState("loading");
  const [info, setInfo] = useState(null);

  useEffect(() => {
    // Decode and auto-join room from session token
    const SERVER = `https://${window.location.hostname}:5001`;
    fetch(`${SERVER}/api/sessions/verify`, {
      headers: { "X-Session-Token": token },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInfo(data.session);
          setLoggedInUser(data.session.username);
          setStatus("joining");
          // Store the session token temporarily for socket auth
          localStorage.setItem("vl_token", token);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "ready" && info && !currentRoom) {
      setTimeout(() => joinRoom(info.roomId), 1000);
    }
  }, [status, info, currentRoom, joinRoom]);

  if (status === "error") {
    return (
      <div className="join-screen">
        <div className="join-card">
          <h2 style={{ color: "var(--red)" }}>Invalid or Expired Link</h2>
          <p className="join-subtitle">This session token has expired or is invalid.</p>
        </div>
      </div>
    );
  }

  if (currentRoom) {
    return <GroupCall />;
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-logo"><FiVideo size={32} /></div>
        <h2 className="join-title">Joining Call...</h2>
        {info && (
          <p className="join-subtitle">
            Welcome, <strong>{info.username}</strong>! Connecting to call...
          </p>
        )}
      </div>
    </div>
  );
}
