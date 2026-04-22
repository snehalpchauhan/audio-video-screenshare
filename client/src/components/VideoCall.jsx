import React, { useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import {
  FiPhoneOff,
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiPhone,
  FiX,
  FiMonitor,
} from "react-icons/fi";

const VideoCall = () => {
  const {
    callState,
    activeCall,
    callAccepted,
    stream,
    remoteStream,
    myVideo,
    remoteVideo,
    isSharingScreen,
    answerCall,
    rejectCall,
    endCall,
    shareScreen,
    stopScreenShare,
  } = useSocket();

  const [muted, setMuted] = React.useState(false);
  const [videoOff, setVideoOff] = React.useState(false);

  // Attach local stream to video element
  useEffect(() => {
    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
    }
  }, [stream, myVideo]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideo.current && remoteStream) {
      remoteVideo.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideo]);

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setMuted((prev) => !prev);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setVideoOff((prev) => !prev);
    }
  };

  const isInCall = callAccepted && !callState.isReceivingCall;
  const showIncoming = callState.isReceivingCall;

  return (
    <>
      {/* ─── Incoming Call Banner ─────────────────────────────── */}
      {showIncoming && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-card">
            <div className="caller-avatar">
              {callState.fromName?.charAt(0).toUpperCase()}
            </div>
            <h3>{callState.fromName}</h3>
            <p>Incoming video call...</p>
            <div className="call-actions">
              <button
                className="btn-answer"
                onClick={() => answerCall(true)}
                title="Answer with video"
              >
                <FiVideo />
                <span>Video</span>
              </button>
              <button
                className="btn-answer-audio"
                onClick={() => answerCall(false)}
                title="Answer audio only"
              >
                <FiPhone />
                <span>Audio</span>
              </button>
              <button
                className="btn-reject"
                onClick={rejectCall}
                title="Reject"
              >
                <FiX />
                <span>Reject</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Active Call UI ──────────────────────────────────── */}
      {(isInCall || (activeCall && !callState.isReceivingCall)) && (
        <div className="call-container">
          {/* Remote video (large) */}
          <div className="remote-video-wrap">
            {remoteStream ? (
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                className="remote-video"
              />
            ) : (
              <div className="waiting-remote">
                <div className="pulse-ring"></div>
                <div className="caller-avatar large">
                  {activeCall?.peerName?.charAt(0).toUpperCase()}
                </div>
                <p>Connecting with {activeCall?.peerName}...</p>
              </div>
            )}
          </div>

          {/* Local video (PiP) */}
          <div className="local-video-wrap">
            <video
              ref={myVideo}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
            {videoOff && !isSharingScreen && (
              <div className="video-off-overlay">
                <FiVideoOff size={24} />
              </div>
            )}
            {isSharingScreen && (
              <div className="screen-share-badge">
                <FiMonitor size={12} /> Sharing screen
              </div>
            )}
          </div>

          {/* Call info bar */}
          <div className="call-info-bar">
            <span className="call-peer-name">{activeCall?.peerName}</span>
            {callAccepted && <span className="call-live-badge">● LIVE</span>}
          </div>

          {/* Controls */}
          <div className="call-controls">
            <button
              className={`ctrl-btn ${muted ? "active" : ""}`}
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <FiMicOff size={20} /> : <FiMic size={20} />}
            </button>

            <button
              className="ctrl-btn end-call"
              onClick={endCall}
              title="End call"
            >
              <FiPhoneOff size={22} />
            </button>

            <button
              className={`ctrl-btn ${videoOff ? "active" : ""}`}
              onClick={toggleVideo}
              title={videoOff ? "Turn on camera" : "Turn off camera"}
            >
              {videoOff ? <FiVideoOff size={20} /> : <FiVideo size={20} />}
            </button>

            <button
              className={`ctrl-btn ${isSharingScreen ? "active screen-active" : ""}`}
              onClick={isSharingScreen ? stopScreenShare : shareScreen}
              title={isSharingScreen ? "Stop sharing" : "Share screen"}
            >
              <FiMonitor size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoCall;
