import React, { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { FiUsers, FiVideo, FiX } from "react-icons/fi";
import { startRingtone, stopRingtone } from "../utils/ringtone";

const TIMEOUT_SECS = 30;

const GroupCallNotification = () => {
  const { incomingGroupCall, joinRoom, dismissGroupCall, currentRoom } = useSocket();
  const [countdown, setCountdown] = useState(TIMEOUT_SECS);

  // ── Ring tone when group call starts ──────────────────────
  useEffect(() => {
    if (incomingGroupCall && !currentRoom) {
      startRingtone();
      return () => stopRingtone();
    }
  }, [incomingGroupCall, currentRoom]);

  // Reset countdown when a new notification arrives
  useEffect(() => {
    if (!incomingGroupCall) { setCountdown(TIMEOUT_SECS); return; }
    setCountdown(TIMEOUT_SECS);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          dismissGroupCall();
          return TIMEOUT_SECS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingGroupCall]);

  // Don't show if no notification, or user is already in a call/room
  if (!incomingGroupCall || currentRoom) return null;

  const { callerName, roomName, roomId } = incomingGroupCall;
  const progress = (countdown / TIMEOUT_SECS) * 100;

  return (
    <div className="group-call-notification" role="alert" aria-live="assertive">
      {/* Pulsing ring */}
      <div className="gcn-ring" />

      <div className="gcn-icon-wrap">
        <FiUsers size={22} />
      </div>

      <div className="gcn-body">
        <p className="gcn-title">
          <strong>{callerName}</strong> started a group call
        </p>
        <p className="gcn-room">📹 {roomName}</p>
      </div>

      <div className="gcn-actions">
        <button
          className="gcn-btn gcn-join"
          onClick={() => joinRoom(roomId)}
        >
          <FiVideo size={15} />
          Join ({countdown}s)
        </button>
        <button
          className="gcn-btn gcn-dismiss"
          onClick={dismissGroupCall}
          title="Dismiss"
        >
          <FiX size={15} />
        </button>
      </div>

      {/* Countdown progress bar */}
      <div className="gcn-progress-bar">
        <div
          className="gcn-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default GroupCallNotification;
