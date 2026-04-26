import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiLogOut, FiUsers, FiMonitor } from "react-icons/fi";

// ─── Single video tile for a remote peer ─────────────────────
const PeerTile = ({ stream, username, isSpotlight = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`peer-tile${isSpotlight ? " spotlight-tile" : ""}`}>
      {stream ? (
        <video ref={videoRef} autoPlay playsInline className="peer-video" />
      ) : (
        <div className="peer-no-video">
          <div className="peer-avatar">{username?.charAt(0)?.toUpperCase()}</div>
          <p className="peer-username">{username}</p>
          <span className="connecting-label">Connecting...</span>
        </div>
      )}
      <div className="peer-name-label">
        {username}
        {isSpotlight && (
          <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--accent)", opacity: 0.9 }}>
            <FiMonitor size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />
            Sharing screen
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Local video tile ─────────────────────────────────────────
const LocalTile = ({ stream, username, muted, videoOff, isSharingScreen, isSpotlight = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`peer-tile local-tile${isSpotlight ? " spotlight-tile" : ""}`}>
      {stream && (!videoOff || isSharingScreen) ? (
        <video ref={videoRef} autoPlay playsInline muted className="peer-video" />
      ) : (
        <div className="peer-no-video">
          <div className="peer-avatar">{username?.charAt(0)?.toUpperCase()}</div>
          <p className="peer-username">{username}</p>
        </div>
      )}
      <div className="peer-name-label">
        {username} (You)
        {isSharingScreen && (
          <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--accent)" }}>
            <FiMonitor size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />
            Sharing
          </span>
        )}
      </div>
    </div>
  );
};

// ─── GroupCall component ──────────────────────────────────────
const GroupCall = () => {
  const {
    currentRoom, roomPeers, localRoomStream, localGroupDisplayStream,
    isGroupSharingScreen, groupScreenSharerId,
    shareGroupScreen, stopGroupScreenShare,
    username, leaveRoom, me,
  } = useSocket();

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

  const peerList    = Object.entries(roomPeers);
  const totalTiles  = peerList.length + 1; // +1 for local

  // ── Spotlight logic ───────────────────────────────────────
  // If WE are sharing screen: local tile is spotlight
  // If a PEER is sharing screen: their tile is spotlight
  const anyScreenShare = isGroupSharingScreen || !!groupScreenSharerId;
  const localIsSpotlight  = isGroupSharingScreen;
  const spotlightSocketId = isGroupSharingScreen ? null : groupScreenSharerId;

  return (
    <div className="group-call-container">
      {/* Header */}
      <div className="group-call-header">
        <div className="room-info">
          <FiUsers size={16} />
          <span className="room-name">{currentRoom.roomName}</span>
          <span className="participant-count">{totalTiles} participant{totalTiles !== 1 ? "s" : ""}</span>
        </div>
        {anyScreenShare && (
          <div className="screen-share-active-badge">
            <FiMonitor size={13} /> Screen Sharing Active
          </div>
        )}
        <div className="room-live-badge">● LIVE</div>
      </div>

      {anyScreenShare ? (
        /* ── Spotlight layout: screen sharer center, others in strip ── */
        <div className="video-layout-spotlight">
          {/* Big spotlight tile */}
          {localIsSpotlight ? (
            <LocalTile
              stream={localGroupDisplayStream || localRoomStream}
              username={username}
              muted={muted}
              videoOff={videoOff}
              isSharingScreen={isGroupSharingScreen}
              isSpotlight
            />
          ) : (
            <PeerTile
              stream={roomPeers[spotlightSocketId]?.stream}
              username={roomPeers[spotlightSocketId]?.username}
              isSpotlight
            />
          )}
          {/* Small strip of other participants */}
          <div className="video-strip">
            {!localIsSpotlight && (
              <LocalTile
                stream={localGroupDisplayStream || localRoomStream}
                username={username}
                muted={muted}
                videoOff={videoOff}
                isSharingScreen={isGroupSharingScreen}
              />
            )}
            {peerList
              .filter(([sid]) => sid !== spotlightSocketId)
              .map(([socketId, { stream, username: peerName }]) => (
                <PeerTile key={socketId} stream={stream} username={peerName} />
              ))}
          </div>
        </div>
      ) : (
        /* ── Normal grid layout ── */
        <div className={`video-grid grid-${Math.min(totalTiles, 4)}`}>
          <LocalTile
            stream={localGroupDisplayStream || localRoomStream}
            username={username}
            muted={muted}
            videoOff={videoOff}
            isSharingScreen={isGroupSharingScreen}
          />
          {peerList.map(([socketId, { stream, username: peerName }]) => (
            <PeerTile key={socketId} stream={stream} username={peerName} />
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="group-call-controls">
        <button className={`ctrl-btn ${muted ? "active" : ""}`} onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}>
          {muted ? <FiMicOff size={20} /> : <FiMic size={20} />}
        </button>

        <button className={`ctrl-btn ${videoOff ? "active" : ""}`} onClick={toggleVideo}
          title={videoOff ? "Turn on camera" : "Turn off camera"}>
          {videoOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
        </button>

        <button
          className={`ctrl-btn ${isGroupSharingScreen ? "active screen-active" : ""}`}
          onClick={isGroupSharingScreen ? stopGroupScreenShare : shareGroupScreen}
          title={isGroupSharingScreen ? "Stop sharing screen" : "Share screen"}>
          <FiMonitor size={20} />
        </button>

        <button className="ctrl-btn leave-call" onClick={leaveRoom} title="Leave room">
          <FiLogOut size={20} />
        </button>
      </div>
    </div>
  );
};

export default GroupCall;
