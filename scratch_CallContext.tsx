import React, { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import Peer from 'simple-peer';
import { useChat } from './ChatContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CallType = 'voice' | 'video';

interface CallContextType {
  stream: MediaStream | undefined;
  myVideo: React.MutableRefObject<HTMLVideoElement | null>;
  userVideo: React.MutableRefObject<HTMLVideoElement | null>;
  callUser: (idToCall: string, name: string, callType: CallType, avatar?: string) => void;
  answerCall: () => void;
  leaveCall: () => void;
  receivingCall: boolean;
  callerName: string;
  callerAvatar: string;
  callType: CallType;
  callAccepted: boolean;
  callEnded: boolean;
  isCalling: boolean;
  calleeName: string;
  calleeAvatar: string;
  callDuration: number; // seconds since call was accepted
  isMinimized: boolean;
  toggleMinimize: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useChat();

  // Pull real user info from localStorage (set by your auth flow)
  const getMe = () => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  };

  // ── State ──
  const [stream, setStream]               = useState<MediaStream>();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller]               = useState('');
  const [callerName, setCallerName]       = useState('');
  const [callerAvatar, setCallerAvatar]   = useState('');
  const [callerSignal, setCallerSignal]   = useState<Peer.SignalData | undefined>(undefined);
  const [callId, setCallId]               = useState('');
  const [callType, setCallType]           = useState<CallType>('video');
  const [callAccepted, setCallAccepted]   = useState(false);
  const [callEnded, setCallEnded]         = useState(false);
  const [isCalling, setIsCalling]         = useState(false);
  const [calleeName, setCalleeName]       = useState('');
  const [calleeId, setCalleeId]           = useState('');
  const [calleeAvatar, setCalleeAvatar]   = useState('');
  const [callDuration, setCallDuration]   = useState(0);
  const [isMinimized, setIsMinimized]     = useState(false);

  // ── Refs ──
  const myVideo        = useRef<HTMLVideoElement | null>(null);
  const userVideo      = useRef<HTMLVideoElement | null>(null);
  const connectionRef  = useRef<Peer.Instance | null>(null);
  const callStartRef   = useRef<number>(0);
  const durationTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset all state cleanly (no page reload) ──
  const resetCallState = useCallback(() => {
    setReceivingCall(false);
    setCallAccepted(false);
    setCallEnded(true);
    setIsCalling(false);
    setCallDuration(0);
    setIsMinimized(false);
    callStartRef.current = 0;

    if (durationTimer.current) { clearInterval(durationTimer.current); durationTimer.current = null; }
    if (ringTimeout.current)   { clearTimeout(ringTimeout.current);   ringTimeout.current   = null; }

    // Stop all media tracks
    stream?.getTracks().forEach(t => t.stop());
    connectionRef.current?.destroy();
    connectionRef.current = null;

    // Brief delay then clear callEnded flag so modals dismiss properly
    setTimeout(() => setCallEnded(false), 500);
  }, [stream]);

  // ── Duration timer ──
  const startDurationTimer = useCallback(() => {
    callStartRef.current = Date.now();
    durationTimer.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
  }, []);

  // ── Incoming call socket listener ──
  useEffect(() => {
    if (!socket) return;

    socket.on('incoming-call', (data: {
      from: string; callerName: string; callerAvatar: string;
      signal: Peer.SignalData; callId: string; callType: CallType;
    }) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerName(data.callerName);
      setCallerAvatar(data.callerAvatar || '');
      setCallerSignal(data.signal);
      setCallId(data.callId);
      setCallType(data.callType || 'video');
    });

    socket.on('call-rejected', () => {
      resetCallState();
    });

    socket.on('call-cancelled', () => {
      resetCallState();
    });

    socket.on('call-ended', () => {
      resetCallState();
    });

    socket.on('call-delivered', (data: { callId: string }) => {
      setCallId(data.callId);
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-rejected');
      socket.off('call-cancelled');
      socket.off('call-ended');
      socket.off('call-delivered');
    };
  }, [socket, resetCallState]);

  const toggleMinimize = () => setIsMinimized(prev => !prev);

  // ── Initiate a call ──
  const callUser = async (idToCall: string, name: string, type: CallType = 'video', avatar = '') => {
    const me = getMe();
    try {
      setIsCalling(true);
      setCalleeName(name);
      setCalleeId(idToCall);
      setCalleeAvatar(avatar);
      setCallType(type);

      const constraints = type === 'voice' ? { video: false, audio: true } : { video: true, audio: true };
      const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });

      peer.on('signal', (signalData) => {
        socket?.emit('call-user', {
          userToCall: idToCall,
          signalData,
          from: me._id || '',
          callerName: me.fullName || 'Unknown',
          callerAvatar: me.avatar || '',
          callType: type,
        });
      });

      peer.on('stream', (userStream) => {
        if (userVideo.current) userVideo.current.srcObject = userStream;
      });

      socket?.on('call-accepted', (signal: Peer.SignalData) => {
        setCallAccepted(true);
        setIsCalling(false);
        peer.signal(signal);
        startDurationTimer();
      });

      // 30-second ring timeout → auto cancel as missed
      ringTimeout.current = setTimeout(() => {
        if (!callAccepted) {
          socket?.emit('cancel-call', { callId, to: idToCall });
          resetCallState();
        }
      }, 30_000);

      connectionRef.current = peer;
    } catch {
      setIsCalling(false);
    }
  };

  // ── Answer an incoming call ──
  const answerCall = async () => {
    setCallAccepted(true);
    setReceivingCall(false);
    try {
      const constraints = callType === 'voice' ? { video: false, audio: true } : { video: true, audio: true };
      const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });

      peer.on('signal', (signalData) => {
        socket?.emit('answer-call', { to: caller, signal: signalData, callId });
      });

      peer.on('stream', (userStream) => {
        if (userVideo.current) userVideo.current.srcObject = userStream;
      });

      if (callerSignal) peer.signal(callerSignal);
      connectionRef.current = peer;
      startDurationTimer();
    } catch { /* permission denied */ }
  };

  // ── Leave / end call ──
  const leaveCall = () => {
    const durationSecs = callStartRef.current
      ? Math.floor((Date.now() - callStartRef.current) / 1000)
      : 0;

    if (callAccepted) {
      // Normal end — save duration
      socket?.emit('end-call', { to: caller || calleeId, callId, duration: durationSecs });
    } else if (isCalling) {
      // Caller cancels before answer
      socket?.emit('cancel-call', { callId, to: calleeId });
    } else if (receivingCall) {
      // Receiver rejects
      socket?.emit('reject-call', { callId, to: caller });
    }

    resetCallState();
  };

  return (
    <CallContext.Provider value={{
      stream, myVideo, userVideo,
      callUser, answerCall, leaveCall,
      receivingCall, callerName, callerAvatar,
      callType, callAccepted, callEnded,
      isCalling, calleeName, calleeAvatar,
      callDuration, isMinimized, toggleMinimize
    }}>
      {children}
    </CallContext.Provider>
  );
};
