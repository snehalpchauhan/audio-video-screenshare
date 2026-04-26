import React, { useState, useEffect } from "react";
import "./App.css";
import { SocketProvider, useSocket } from "./context/SocketContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import VideoCall from "./components/VideoCall";
import GroupCall from "./components/GroupCall";
import GroupCallNotification from "./components/GroupCallNotification";
import DeveloperPortal from "./components/DeveloperPortal";
import { FiVideo, FiLogIn, FiUserPlus, FiPlus, FiUsers, FiCode } from "react-icons/fi";
import {
  authAPI, roomsAPI,
  getToken, setToken, clearToken,
  getUser, setUser, clearUser,
} from "./services/api";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || `https://${window.location.hostname}:5001`;

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

// ─── Auth screen (Login / Register) ──────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = mode === "login"
        ? await authAPI.login(username.trim(), password)
        : await authAPI.register(username.trim(), password, {
            email: email.trim() || undefined,
            companyName: companyName.trim() || undefined,
          });
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
      <div className={`join-card${mode === "register" ? " join-card-register" : ""}`}>
        <div className="join-logo"><FiVideo size={32} /></div>
        <h1 className="join-title">VoiceLink</h1>
        <p className="join-subtitle">
          {mode === "login"
            ? "Sign in to your account"
            : "Create an account to access the Developer Portal, generate API keys, and embed audio/video in your product"}
        </p>
        {mode === "register" && (
          <div className="auth-dev-badge">
            <FiCode size={13} /> Developer account — API keys &amp; session tokens included
          </div>
        )}

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
          {mode === "register" && (
            <>
              <input
                className="join-input"
                type="email"
                placeholder="Work email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className="join-input"
                placeholder="Organization / product name (optional)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
              />
            </>
          )}
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
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setEmail("");
              setCompanyName("");
            }}
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
        .then((data) => {
          const u = data.user || storedUser;
          setUser_(u);
          setUser(u);
        })
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
            {activeView === "developer" && <DeveloperPortal />}
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
    fetch(`${SERVER_URL}/api/sessions/verify`, {
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
