import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import { getToken } from "../services/api";

const SocketContext = createContext();
const SERVER_URL = `https://${window.location.hostname}:5001`;

export const SocketProvider = ({ children }) => {
  const [socket, setSocket]         = useState(null);
  const [me, setMe]                 = useState("");
  const [users, setUsers]           = useState([]);
  const [messages, setMessages]     = useState([]);
  const [username, setUsername]     = useState("");

  // ── 1-on-1 call state ─────────────────────────────────────
  const [callState, setCallState]   = useState({ isReceivingCall: false, from: "", fromName: "", signal: null });
  const [activeCall, setActiveCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [stream, setStream]         = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  // ── Group call state ───────────────────────────────────────
  const [currentRoom, setCurrentRoom]   = useState(null);   // { roomId, roomName }
  const [roomPeers, setRoomPeers]       = useState({});     // { socketId: { peer, stream, username } }
  const [localRoomStream, setLocalRoomStream] = useState(null);

  // Refs
  const myVideo        = useRef(null);
  const remoteVideo    = useRef(null);
  const peerRef        = useRef(null);
  const socketRef      = useRef(null);
  const streamRef      = useRef(null);
  const screenStreamRef= useRef(null);
  const roomPeersRef   = useRef({});      // mirror of roomPeers (for callbacks)
  const localRoomStreamRef = useRef(null);

  const updateStream = (s) => { streamRef.current = s; setStream(s); };
  const updateRoomPeers = (fn) => {
    setRoomPeers((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      roomPeersRef.current = next;
      return next;
    });
  };

  // ── Connect to Socket.IO with JWT ──────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) return; // no token → wait until logged in

    const s = io(SERVER_URL, {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = s;
    setSocket(s);

    s.on("connect_error", (err) => console.error("Socket connect error:", err.message));
    s.on("me", (id) => { setMe(id); s.emit("get-users"); });
    s.on("users", (list) => setUsers(list));

    s.on("receive-message", (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: "received" }]);
    });

    // ── 1-on-1 signaling ──
    s.on("incoming-call", ({ from, signal, fromName }) => {
      setCallState({ isReceivingCall: true, from, fromName, signal });
    });
    s.on("call-accepted", (signal) => {
      setCallAccepted(true);
      if (peerRef.current) peerRef.current.signal(signal);
    });
    s.on("call-rejected", () => { alert("Call was rejected."); cleanupCall(); });
    s.on("call-ended", () => cleanupCall());
    s.on("user-disconnected", (id) => {
      if (activeCall?.peerId === id) cleanupCall();
    });

    // ── Group call signaling ──
    s.on("room-joined", ({ roomId, roomName, participants }) => {
      setCurrentRoom({ roomId, roomName });
      // For each existing participant, initiate a peer connection (we are the new joiner)
      participants.forEach(({ socketId, username: peerUsername }) => {
        createRoomPeer(socketId, peerUsername, true, s);
      });
    });

    s.on("user-joined-room", ({ socketId, username: peerUsername }) => {
      // Existing participant: wait for the new joiner to initiate
      createRoomPeer(socketId, peerUsername, false, s);
    });

    s.on("room-signal", ({ from, fromName, signal }) => {
      const entry = roomPeersRef.current[from];
      if (entry?.peer) {
        entry.peer.signal(signal);
      } else {
        // Peer not yet created (race condition) — create it now as non-initiator
        createRoomPeer(from, fromName, false, s, signal);
      }
    });

    s.on("user-left-room", ({ socketId }) => {
      destroyRoomPeer(socketId);
    });

    s.on("room-error", (msg) => alert(`Room error: ${msg}`));

    return () => {
      s.disconnect();
      cleanupRoomPeers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]); // re-connect when username changes (i.e. after login)

  // ── Create a peer connection for group call ────────────────
  const createRoomPeer = (peerId, peerUsername, initiator, s, existingSignal = null) => {
    const lStream = localRoomStreamRef.current;
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: lStream || undefined,
    });

    peer.on("signal", (signal) => {
      s.emit("room-signal", { to: peerId, signal });
    });

    peer.on("stream", (remStream) => {
      updateRoomPeers((prev) => ({
        ...prev,
        [peerId]: { ...prev[peerId], stream: remStream },
      }));
    });

    peer.on("close", () => destroyRoomPeer(peerId));
    peer.on("error", (err) => {
      console.error(`Peer error [${peerUsername}]:`, err);
      destroyRoomPeer(peerId);
    });

    if (existingSignal) peer.signal(existingSignal);

    updateRoomPeers((prev) => ({
      ...prev,
      [peerId]: { peer, stream: null, username: peerUsername },
    }));
  };

  const destroyRoomPeer = (peerId) => {
    const entry = roomPeersRef.current[peerId];
    if (entry?.peer) entry.peer.destroy();
    updateRoomPeers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const cleanupRoomPeers = () => {
    Object.values(roomPeersRef.current).forEach(({ peer }) => peer?.destroy());
    roomPeersRef.current = {};
    setRoomPeers({});
  };

  // ── 1-on-1 cleanup ────────────────────────────────────────
  const cleanupCall = () => {
    setCallAccepted(false);
    setActiveCall(null);
    setRemoteStream(null);
    setIsSharingScreen(false);
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); updateStream(null); }
    setCallState({ isReceivingCall: false, from: "", fromName: "", signal: null });
  };

  // ── Send message ─────────────────────────────────────────
  const sendMessage = (message, to = null, roomId = null) => {
    const payload = { message, from: me, fromName: username, timestamp: Date.now() };
    if (roomId) payload.roomId = roomId;
    if (to) payload.to = to;
    socketRef.current?.emit("send-message", payload);
    setMessages((prev) => [...prev, { ...payload, type: "sent", to, roomId }]);
  };

  // ── Get camera/mic stream ─────────────────────────────────
  const getMediaStream = async (video = true, audio = true) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video, audio });
      updateStream(s);
      if (myVideo.current) myVideo.current.srcObject = s;
      return s;
    } catch (err) {
      console.error(err);
      alert("Could not access camera/microphone. Please grant permissions.");
      return null;
    }
  };

  // ── 1-on-1: Call user ────────────────────────────────────
  const callUser = async (peerId, peerName, videoCall = true) => {
    const mediaStream = await getMediaStream(videoCall, true);
    if (!mediaStream) return;
    setActiveCall({ peerId, peerName });

    const peer = new Peer({ initiator: true, trickle: false, stream: mediaStream });
    peer.on("signal", (signal) => {
      socketRef.current.emit("call-user", { to: peerId, signal, fromName: username });
    });
    peer.on("stream", (remote) => {
      setRemoteStream(remote);
      if (remoteVideo.current) remoteVideo.current.srcObject = remote;
    });
    peer.on("close", () => cleanupCall());
    peer.on("error", () => cleanupCall());
    peerRef.current = peer;
  };

  // ── 1-on-1: Answer call ──────────────────────────────────
  const answerCall = async (videoCall = true) => {
    const mediaStream = await getMediaStream(videoCall, true);
    if (!mediaStream) return;
    setCallAccepted(true);
    setActiveCall({ peerId: callState.from, peerName: callState.fromName });

    const peer = new Peer({ initiator: false, trickle: false, stream: mediaStream });
    peer.on("signal", (signal) => {
      socketRef.current.emit("answer-call", { to: callState.from, signal });
    });
    peer.on("stream", (remote) => {
      setRemoteStream(remote);
      if (remoteVideo.current) remoteVideo.current.srcObject = remote;
    });
    peer.on("close", () => cleanupCall());
    peer.on("error", () => cleanupCall());
    peer.signal(callState.signal);
    peerRef.current = peer;
    setCallState((prev) => ({ ...prev, isReceivingCall: false }));
  };

  const rejectCall = () => {
    socketRef.current.emit("reject-call", { to: callState.from });
    setCallState({ isReceivingCall: false, from: "", fromName: "", signal: null });
  };

  const endCall = () => {
    if (activeCall) socketRef.current.emit("end-call", { to: activeCall.peerId });
    cleanupCall();
  };

  // ── Screen Share (1-on-1) ────────────────────────────────
  const shareScreen = async () => {
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
      screenStreamRef.current = sStream;
      setIsSharingScreen(true);
      const screenTrack = sStream.getVideoTracks()[0];
      if (peerRef.current && streamRef.current) {
        const camTrack = streamRef.current.getVideoTracks()[0];
        if (camTrack) peerRef.current.replaceTrack(camTrack, screenTrack, streamRef.current);
      }
      if (myVideo.current) myVideo.current.srcObject = sStream;
      screenTrack.addEventListener("ended", () => stopScreenShare());
    } catch (err) {
      console.error("Screen share error:", err);
      setIsSharingScreen(false);
    }
  };

  const stopScreenShare = () => {
    const sStream = screenStreamRef.current;
    if (!sStream) return;
    const screenTrack = sStream.getVideoTracks()[0];
    sStream.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsSharingScreen(false);
    if (peerRef.current && streamRef.current) {
      const camTrack = streamRef.current.getVideoTracks()[0];
      if (screenTrack && camTrack) peerRef.current.replaceTrack(screenTrack, camTrack, streamRef.current);
      if (myVideo.current) myVideo.current.srcObject = streamRef.current;
    }
  };

  // ── Group Call: Join Room ────────────────────────────────
  const joinRoom = async (roomId) => {
    try {
      const lStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localRoomStreamRef.current = lStream;
      setLocalRoomStream(lStream);
      socketRef.current.emit("join-room", roomId);
    } catch (err) {
      console.error("Could not get media for room:", err);
      alert("Camera/mic access required to join a room call.");
    }
  };

  // ── Group Call: Leave Room ────────────────────────────────
  const leaveRoom = () => {
    if (currentRoom) {
      socketRef.current.emit("leave-room", currentRoom.roomId);
    }
    cleanupRoomPeers();
    if (localRoomStreamRef.current) {
      localRoomStreamRef.current.getTracks().forEach(t => t.stop());
      localRoomStreamRef.current = null;
    }
    setLocalRoomStream(null);
    setCurrentRoom(null);
  };

  // ── Set username after login ──────────────────────────────
  const setLoggedInUser = (name) => setUsername(name);

  return (
    <SocketContext.Provider value={{
      socket, me, users, messages, username,
      // 1-on-1
      callState, activeCall, callAccepted, stream, remoteStream, isSharingScreen,
      myVideo, remoteVideo,
      callUser, answerCall, rejectCall, endCall,
      shareScreen, stopScreenShare,
      sendMessage,
      // group call
      currentRoom, roomPeers, localRoomStream,
      joinRoom, leaveRoom,
      // auth helper
      setLoggedInUser,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
