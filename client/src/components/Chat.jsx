import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { FiSend, FiGlobe, FiLock } from "react-icons/fi";

const Chat = ({ selectedUser }) => {
  const { sendMessage, messages, me } = useSocket();
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  // Filter messages for current chat (global or private)
  const filteredMessages = selectedUser
    ? messages.filter(
        (m) =>
          (m.from === me && m.to === selectedUser.socketId) ||
          (m.from === selectedUser.socketId && m.type === "received")
      )
    : messages.filter((m) => !m.to);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages]);

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed, selectedUser ? selectedUser.socketId : null);
    setInput("");
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        {selectedUser ? (
          <>
            <FiLock size={14} className="header-icon" />
            <span>Private chat with <strong>{selectedUser.name}</strong></span>
          </>
        ) : (
          <>
            <FiGlobe size={14} className="header-icon" />
            <span><strong>Global Chat</strong></span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="messages-list">
        {filteredMessages.length === 0 && (
          <div className="no-messages">
            <span>No messages yet. Say hello! 👋</span>
          </div>
        )}
        {filteredMessages.map((msg, idx) => {
          const isMine = msg.from === me;
          return (
            <div
              key={idx}
              className={`message-bubble ${isMine ? "sent" : "received"}`}
            >
              {!isMine && (
                <div className="msg-sender">{msg.fromName}</div>
              )}
              <div className="msg-content">{msg.message}</div>
              <div className="msg-time">{formatTime(msg.timestamp)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            selectedUser
              ? `Message ${selectedUser.name}...`
              : "Message everyone..."
          }
          autoComplete="off"
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!input.trim()}
          title="Send"
        >
          <FiSend size={18} />
        </button>
      </form>
    </div>
  );
};

export default Chat;
