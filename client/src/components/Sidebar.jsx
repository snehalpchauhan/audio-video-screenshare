import React from "react";
import { useSocket } from "../context/SocketContext";
import { FiVideo, FiPhone, FiMessageSquare, FiGlobe, FiUser } from "react-icons/fi";

const Sidebar = ({ selectedUser, setSelectedUser }) => {
  const { users, me, name, callUser, activeCall } = useSocket();

  // Exclude self from user list
  const otherUsers = users.filter((u) => u.socketId !== me);

  return (
    <div className="sidebar">
      {/* My profile */}
      <div className="my-profile">
        <div className="avatar my-avatar">{name?.charAt(0).toUpperCase()}</div>
        <div className="profile-info">
          <span className="my-name">{name}</span>
          <span className="status-badge online">● Online</span>
        </div>
      </div>

      <div className="sidebar-section-label">CHANNELS</div>

      {/* Global chat button */}
      <button
        className={`sidebar-item ${!selectedUser ? "active" : ""}`}
        onClick={() => setSelectedUser(null)}
      >
        <FiGlobe size={16} />
        <span>Global Chat</span>
      </button>

      <div className="sidebar-section-label">
        ONLINE — {otherUsers.length}
      </div>

      {/* Users list */}
      {otherUsers.length === 0 ? (
        <div className="no-users">
          <FiUser size={20} />
          <p>No one else online yet</p>
        </div>
      ) : (
        otherUsers.map((user) => (
          <div
            key={user.socketId}
            className={`user-item ${
              selectedUser?.socketId === user.socketId ? "active" : ""
            }`}
          >
            {/* User info (click to open DM) */}
            <button
              className="user-info"
              onClick={() => setSelectedUser(user)}
            >
              <div className="avatar user-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-status">● Active</span>
              </div>
            </button>

            {/* Call buttons */}
            <div className="user-call-btns">
              <button
                className="call-icon-btn"
                title={`Video call ${user.name}`}
                onClick={() => callUser(user.socketId, user.name, true)}
                disabled={!!activeCall}
              >
                <FiVideo size={15} />
              </button>
              <button
                className="call-icon-btn"
                title={`Audio call ${user.name}`}
                onClick={() => callUser(user.socketId, user.name, false)}
                disabled={!!activeCall}
              >
                <FiPhone size={15} />
              </button>
              <button
                className="call-icon-btn"
                title={`Message ${user.name}`}
                onClick={() => setSelectedUser(user)}
              >
                <FiMessageSquare size={15} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Sidebar;
