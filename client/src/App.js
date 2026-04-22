import React, { useState } from "react";
import { useSocket } from "./context/SocketContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import VideoCall from "./components/VideoCall";
import { FiLogIn, FiMessageSquare } from "react-icons/fi";
import "./App.css";

function App() {
  const { joined, joinRoom } = useSocket();
  const [inputName, setInputName] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = inputName.trim();
    if (!trimmed) return;
    joinRoom(trimmed);
  };

  // ─── Join Screen ────────────────────────────────────────
  if (!joined) {
    return (
      <div className="join-screen">
        <div className="join-card">
          <div className="join-logo">
            <FiMessageSquare size={40} />
          </div>
          <h1 className="join-title">VoiceLink</h1>
          <p className="join-subtitle">
            Chat, audio & video calls — all in one place
          </p>
          <form className="join-form" onSubmit={handleJoin}>
            <input
              type="text"
              className="join-input"
              placeholder="Enter your name..."
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              autoFocus
              maxLength={30}
            />
            <button
              type="submit"
              className="join-btn"
              disabled={!inputName.trim()}
            >
              <FiLogIn size={18} />
              <span>Join Now</span>
            </button>
          </form>
          <p className="join-hint">
            No account needed. Just enter your name and start chatting!
          </p>
        </div>
      </div>
    );
  }

  // ─── Main App ────────────────────────────────────────────
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-layout">
        <Sidebar
          selectedUser={selectedUser}
          setSelectedUser={setSelectedUser}
        />
        <div className="content-area">
          <Chat selectedUser={selectedUser} />
        </div>
      </div>
      {/* Video call overlay renders on top */}
      <VideoCall />
    </div>
  );
}

export default App;
