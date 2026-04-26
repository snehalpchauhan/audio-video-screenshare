import React from "react";
import { useSocket } from "../context/SocketContext";
import { FiGlobe, FiPhone, FiVideo, FiUsers, FiCpu } from "react-icons/fi";

const Sidebar = ({ selectedUser, setSelectedUser, activeView, setActiveView }) => {
  const { users, me, username, callUser } = useSocket();

  const otherUsers = users.filter((u) => u.socketId !== me);

  return (
    <aside className="sidebar">
      {/* My profile */}
      <div className="my-profile">
        <div className="avatar">{username?.charAt(0)?.toUpperCase() || "?"}</div>
        <div className="profile-info">
          <span className="my-name">{username}</span>
          <span className="status-badge online">● online</span>
        </div>
      </div>

      {/* Navigation */}
      <span className="sidebar-section-label">NAVIGATION</span>

      <button
        className={`sidebar-item ${activeView === "chat" && !selectedUser ? "active" : ""}`}
        onClick={() => { setActiveView("chat"); setSelectedUser(null); }}
      >
        <FiGlobe size={15} /> Global Chat
      </button>

      <button
        className={`sidebar-item ${activeView === "rooms" ? "active" : ""}`}
        onClick={() => { setActiveView("rooms"); setSelectedUser(null); }}
      >
        <FiUsers size={15} /> Group Call Rooms
      </button>

      <button
        className={`sidebar-item ${activeView === "developer" ? "active" : ""}`}
        onClick={() => { setActiveView("developer"); setSelectedUser(null); }}
      >
        <FiCpu size={15} /> Developer Portal
      </button>

      {/* Online users */}
      <span className="sidebar-section-label" style={{ marginTop: 12 }}>
        ONLINE — {otherUsers.length}
      </span>

      {otherUsers.length === 0 ? (
        <div className="no-users">
          <FiUsers size={22} />
          <span>No one else online</span>
        </div>
      ) : (
        otherUsers.map((user) => (
          <div
            key={user.socketId}
            className={`user-item ${selectedUser?.socketId === user.socketId ? "active" : ""}`}
          >
            <button
              className="user-info"
              onClick={() => { setSelectedUser(user); setActiveView("chat"); }}
            >
              <div className="avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-status">online</span>
              </div>
            </button>

            <div className="user-call-btns">
              <button
                className="call-icon-btn"
                title={`Video call ${user.name}`}
                onClick={() => callUser(user.socketId, user.name, true)}
              >
                <FiVideo size={14} />
              </button>
              <button
                className="call-icon-btn"
                title={`Audio call ${user.name}`}
                onClick={() => callUser(user.socketId, user.name, false)}
              >
                <FiPhone size={14} />
              </button>
            </div>
          </div>
        ))
      )}
    </aside>
  );
};

export default Sidebar;
