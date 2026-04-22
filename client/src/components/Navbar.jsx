import React from "react";
import { FiVideo, FiWifi, FiLogOut } from "react-icons/fi";
import { getUser } from "../services/api";

const Navbar = ({ onLogout }) => {
  const user = getUser();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <FiVideo size={22} className="brand-icon" />
        <span className="brand-name">VoiceLink</span>
      </div>

      <div className="navbar-right">
        <div className="navbar-status">
          <FiWifi size={14} className="wifi-icon" />
          <span>{user?.username || "Connected"}</span>
        </div>
        {onLogout && (
          <button className="logout-btn" onClick={onLogout} title="Sign out">
            <FiLogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
