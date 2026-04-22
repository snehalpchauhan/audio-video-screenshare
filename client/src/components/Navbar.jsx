import React from "react";
import { FiMessageSquare, FiWifi } from "react-icons/fi";

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <FiMessageSquare size={22} className="brand-icon" />
        <span className="brand-name">VoiceLink</span>
      </div>
      <div className="navbar-status">
        <FiWifi size={16} className="wifi-icon" />
        <span>Connected</span>
      </div>
    </nav>
  );
};

export default Navbar;
