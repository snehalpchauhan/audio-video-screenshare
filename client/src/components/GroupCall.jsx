import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiLogOut, FiUsers } from "react-icons/fi";

// ─── Single video tile for a remote peer ─────────────────────
const PeerTile = ({ stream, username }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="peer-tile">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline className="peer-video" />
      ) : (
        <div className="peer-no-video">
          <div className="peer-avatar">{username?.charAt(0)?.toUpperCase()}</div>
          <p className="peer-username">{username}</p>
          <span className="connecting-label">Connecting...</span>
        </div>
      )}
      <div className="peer-name-label">{username}</div>
    </div>
  );
};

// ─── Local video tile ─────────────────────────────────────────
const LocalTile = ({ stream, username, muted, videoOff }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="peer-tile local-tile">
      {stream && !videoOff ? (
        <video ref={videoRef} autoPlay playsInline muted className="peer-video" />
      ) : (
        <div className="peer-no-video">
          <div className="peer-avatar">{username?.charAt(0)?.toUpperCase()}</div>
          <p className="peer-username">{username}</p>
        </div>
      )}
      <div className="peer-name-label">{username} (You)</div>
    </div>
  );
};

// ─── GroupCall component ──────────────────────────────────────
const GroupCall = () => {
  const { currentRoom, roomPeers, localRoomStream, username, leaveRoom } = useSocket();
  const [muted, setMuted]       = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const toggleMute = () => {
    if (localRoomStream) {
      localRoomStream.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
      setMuted(p => !p);
    }
  };

  const toggleVideo = () => {
    if (localRoomStream) {
      localRoomStream.getVideoTracks().forEach(t => (t.enabled = !t.enabled));
      setVideoOff(p => !p);
    }
  };

  if (!currentRoom) return null;

  const peerList = Object.entries(roomPeers);
  const totalTiles = peerList.length + 1; // +1 for local

  return (
    <div className="group-call-container">
      {/* Header */}
      <div className="group-call-header">
        <div className="room-info">
          <FiUsers size={16} />
          <span className="room-name">{currentRoom.roomName}</span>
          <span className="participant-count">{totalTiles} participant{totalTiles !== 1 ? "s" : ""}</span>
        </div>
        <div className="room-live-badge">● LIVE</div>
      </div>

      {/* Video Grid */}
      <div className={`video-grid grid-${Math.min(totalTiles, 4)}`}>
        {/* Local tile first */}
        <LocalTile
          stream={localRoomStream}
          username={username}
          muted={muted}
          videoOff={videoOff}
        />
        {/* Remote peers */}
        {peerList.map(([socketId, { stream, username: peerName }]) => (
          <PeerTile key={socketId} stream={stream} username={peerName} />
        ))}
      </div>

      {/* Controls */}
      <div className="group-call-controls">
        <button
          className={`ctrl-btn ${muted ? "active" : ""}`}
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <FiMicOff size={20} /> : <FiMic size={20} />}
        </button>

        <button
          className={`ctrl-btn ${videoOff ? "active" : ""}`}
          onClick={toggleVideo}
          title={videoOff ? "Turn on camera" : "Turn off camera"}
        >
          {videoOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
        </button>

        <button
          className="ctrl-btn leave-call"
          onClick={leaveRoom}
          title="Leave room"
        >
          <FiLogOut size={20} />
        </button>
      </div>
    </div>
  );
};

export default GroupCall;
