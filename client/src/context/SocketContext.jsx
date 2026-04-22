import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer";

const SocketContext = createContext();

// Dynamically use whatever host the browser is connecting to
// → works on localhost (desktop) AND 192.168.x.x (phone on same WiFi)
// Uses https:// because camera/mic requires a secure context
const SERVER_URL = `https://${window.location.hostname}:5001`;

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [me, setMe] = useState("");
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  // Call state
  const [callState, setCallState] = useState({
    isReceivingCall: false,
    from: "",
    fromName: "",
    signal: null,
  });
  const [activeCall, setActiveCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const myVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);

  // Refs to avoid stale closures inside callbacks/event handlers
  const streamRef = useRef(null);           // current camera stream
  const screenStreamRef = useRef(null);     // current screen stream
  const isSharingRef = useRef(false);

  // Keep streamRef in sync with state
  const updateStream = (s) => {
    streamRef.current = s;
    setStream(s);
  };

  // ─── Connect to server ────────────────────────────────────
  useEffect(() => {
    const s = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current = s;
    setSocket(s);

    s.on("me", (id) => setMe(id));
    s.on("users", (userList) => setUsers(userList));
    s.on("receive-message", ({ message, from, fromName }) => {
      setMessages((prev) => [
        ...prev,
        { message, from, fromName, type: "received", timestamp: Date.now() },
      ]);
    });

    s.on("incoming-call", ({ from, signal, fromName }) => {
      setCallState({ isReceivingCall: true, from, fromName, signal });
    });

    s.on("call-accepted", (signal) => {
      setCallAccepted(true);
      if (peerRef.current) peerRef.current.signal(signal);
    });

    s.on("call-rejected", () => {
      alert("Call was rejected.");
      cleanupCall();
    });

    s.on("call-ended", () => cleanupCall());

    s.on("user-disconnected", (id) => {
      if (activeCall && activeCall.peerId === id) cleanupCall();
    });

    return () => s.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupCall = () => {
    setCallAccepted(false);
    setCallEnded(true);
    setActiveCall(null);
    setRemoteStream(null);
    setIsSharingScreen(false);
    isSharingRef.current = false;

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      updateStream(null);
    }
    setCallState({ isReceivingCall: false, from: "", fromName: "", signal: null });
  };

  // ─── Join room ────────────────────────────────────────────
  const joinRoom = (userName) => {
    setName(userName);
    socketRef.current.emit("join", userName);
    setJoined(true);
  };

  // ─── Send message ─────────────────────────────────────────
  const sendMessage = (message, to = null) => {
    const payload = { message, from: me, fromName: name };
    if (to) payload.to = to;
    socketRef.current.emit("send-message", payload);
    setMessages((prev) => [
      ...prev,
      { message, from: me, fromName: name, type: "sent", to, timestamp: Date.now() },
    ]);
  };

  // ─── Get camera/mic stream ────────────────────────────────
  const getMediaStream = async (video = true, audio = true) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video, audio });
      updateStream(mediaStream);
      if (myVideo.current) myVideo.current.srcObject = mediaStream;
      return mediaStream;
    } catch (err) {
      console.error("Failed to get media stream:", err);
      alert("Could not access camera/microphone. Please grant permissions.");
      return null;
    }
  };

  // ─── Call a user ──────────────────────────────────────────
  const callUser = async (peerId, peerName, videoCall = true) => {
    const mediaStream = await getMediaStream(videoCall, true);
    if (!mediaStream) return;

    setActiveCall({ peerId, peerName });
    setCallEnded(false);

    const peer = new Peer({ initiator: true, trickle: false, stream: mediaStream });

    peer.on("signal", (signal) => {
      socketRef.current.emit("call-user", { to: peerId, from: me, signal, fromName: name });
    });

    peer.on("stream", (remote) => {
      setRemoteStream(remote);
      if (remoteVideo.current) remoteVideo.current.srcObject = remote;
    });

    peer.on("close", () => cleanupCall());
    peer.on("error", (err) => { console.error("Peer error:", err); cleanupCall(); });

    peerRef.current = peer;
  };

  // ─── Answer a call ────────────────────────────────────────
  const answerCall = async (videoCall = true) => {
    const mediaStream = await getMediaStream(videoCall, true);
    if (!mediaStream) return;

    setCallAccepted(true);
    setActiveCall({ peerId: callState.from, peerName: callState.fromName });
    setCallEnded(false);

    const peer = new Peer({ initiator: false, trickle: false, stream: mediaStream });

    peer.on("signal", (signal) => {
      socketRef.current.emit("answer-call", { to: callState.from, signal });
    });

    peer.on("stream", (remote) => {
      setRemoteStream(remote);
      if (remoteVideo.current) remoteVideo.current.srcObject = remote;
    });

    peer.on("close", () => cleanupCall());
    peer.on("error", (err) => { console.error("Peer error:", err); cleanupCall(); });

    peer.signal(callState.signal);
    peerRef.current = peer;
    setCallState((prev) => ({ ...prev, isReceivingCall: false }));
  };

  // ─── Reject call ──────────────────────────────────────────
  const rejectCall = () => {
    socketRef.current.emit("reject-call", { to: callState.from });
    setCallState({ isReceivingCall: false, from: "", fromName: "", signal: null });
  };

  // ─── Screen Share ─────────────────────────────────────────
  const shareScreen = async () => {
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });

      screenStreamRef.current = sStream;
      setIsSharingScreen(true);
      isSharingRef.current = true;

      const screenVideoTrack = sStream.getVideoTracks()[0];

      // Use simple-peer's replaceTrack (official API) to send screen to remote
      if (peerRef.current && streamRef.current) {
        const camVideoTrack = streamRef.current.getVideoTracks()[0];
        if (camVideoTrack) {
          // simple-peer official: replaceTrack(oldTrack, newTrack, stream)
          peerRef.current.replaceTrack(camVideoTrack, screenVideoTrack, streamRef.current);
        }
      }

      // Show screen preview locally
      if (myVideo.current) myVideo.current.srcObject = sStream;

      // When user clicks browser's native "Stop sharing" button
      screenVideoTrack.addEventListener("ended", () => {
        stopScreenShare();
      });
    } catch (err) {
      console.error("Screen share error:", err);
      setIsSharingScreen(false);
      isSharingRef.current = false;
    }
  };

  const stopScreenShare = () => {
    const sStream = screenStreamRef.current;
    const camStream = streamRef.current;

    if (!sStream) return;

    const screenVideoTrack = sStream.getVideoTracks()[0];

    // Stop all screen capture tracks
    sStream.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsSharingScreen(false);
    isSharingRef.current = false;

    // Restore camera track on remote peer
    if (peerRef.current && camStream) {
      const camVideoTrack = camStream.getVideoTracks()[0];
      if (screenVideoTrack && camVideoTrack) {
        peerRef.current.replaceTrack(screenVideoTrack, camVideoTrack, camStream);
      }
      // Restore local preview
      if (myVideo.current) myVideo.current.srcObject = camStream;
    }
  };

  // ─── End call ─────────────────────────────────────────────
  const endCall = () => {
    if (activeCall) socketRef.current.emit("end-call", { to: activeCall.peerId });
    cleanupCall();
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        me,
        users,
        messages,
        name,
        joined,
        callState,
        activeCall,
        callAccepted,
        callEnded,
        stream,
        remoteStream,
        isSharingScreen,
        myVideo,
        remoteVideo,
        joinRoom,
        sendMessage,
        callUser,
        answerCall,
        rejectCall,
        endCall,
        shareScreen,
        stopScreenShare,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
