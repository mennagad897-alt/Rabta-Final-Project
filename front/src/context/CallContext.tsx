import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Peer from 'simple-peer';
import { useChat } from './ChatContext';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    activeCallNotification?: Notification | null;
  }
}

export type CallType = 'voice' | 'video';

export interface GroupPeer {
  peerId: string;
  stream?: MediaStream;
}

const getMediaStream = async (type: CallType): Promise<MediaStream> => {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(
      type === 'voice'
        ? { video: false, audio: true }
        : { video: true, audio: true }
    );
  } catch (err: any) {
    console.warn('Initial getUserMedia failed, trying fallback:', err);
    if (type === 'video') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        toast.error('Video source unavailable, falling back to audio.');
      } catch (fallbackErr: any) {
        console.error('Audio fallback also failed:', fallbackErr);
        toast.error('Could not access microphone or camera.');
        stream = new MediaStream();
      }
    } else {
      toast.error('Could not access microphone.');
      stream = new MediaStream();
    }
  }

  // Explicitly ensure the audio track is enabled right after the stream is obtained
  stream.getAudioTracks().forEach(track => track.enabled = true);

  return stream;
};

interface CallContextType {
  stream?: MediaStream;
  myVideo: React.MutableRefObject<HTMLVideoElement | null>;
  userVideo: React.MutableRefObject<HTMLVideoElement | null>;
  remoteAudio: React.MutableRefObject<HTMLAudioElement | null>;
  
  callUser: (idToCall: string, name: string, type?: CallType, avatar?: string, chatId?: string) => void;
  answerCall: () => void;
  
  callGroup: (groupId: string, name: string, type?: CallType) => void;
  answerGroupCall: () => void;
  isGroupCall: boolean;
  groupPeers: GroupPeer[];

  leaveCall: () => void;

  receivingCall: boolean;
  callerName: string;
  callerAvatar: string;
  callType: CallType;
  callAccepted: boolean;
  /** True once the call session is active (e.g. accepted / media path live). */
  callActive: boolean;
  callEnded: boolean;
  isCalling: boolean;
  calleeName: string;
  calleeAvatar: string;
  callDuration: number;
  isMinimized: boolean;
  toggleMinimize: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useChat();

  /** Incoming (callee) ring — only started from `incomingCall` / incoming group. */
  const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
  /** Outgoing (caller) ring-back — `/dialtone.mp3` in `public/` optional; ref cleared if missing. */
  const outgoingRingtoneRef = useRef<HTMLAudioElement | null>(null);
  const [stream, setStream]               = useState<MediaStream>();
  const [remoteStream, setRemoteStream]   = useState<MediaStream>();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller]               = useState('');
  const [callerName, setCallerName]       = useState('');
  const [callerAvatar, setCallerAvatar]   = useState('');
  const [callerSignal, setCallerSignal]   = useState<Peer.SignalData>();
  
  const [callAccepted, setCallAccepted]   = useState(false);
  const [callActive, setCallActive]       = useState(false);
  const [callEnded, setCallEnded]         = useState(false);
  const [isCalling, setIsCalling]         = useState(false);
  const [callType, setCallType]           = useState<CallType>('video');
  const [callId, setCallId]               = useState('');
  const [activeChatId, setActiveChatId]   = useState(''); // chat room to emit summary to
  
  const [calleeId, setCalleeId]           = useState('');
  const [calleeName, setCalleeName]       = useState('');
  const [calleeAvatar, setCalleeAvatar]   = useState('');
  const [callDuration, setCallDuration]   = useState(0);
  const [isMinimized, setIsMinimized]     = useState(false);
  
  // Group state
  const [isGroupCall, setIsGroupCall]     = useState(false);
  const [groupPeers, setGroupPeers]       = useState<GroupPeer[]>([]);

  const myVideo        = useRef<HTMLVideoElement | null>(null);
  const userVideo      = useRef<HTMLVideoElement | null>(null);
  const remoteAudio    = useRef<HTMLAudioElement | null>(null);
  const peerRef        = useRef<Peer.Instance | null>(null);
  const connectionRef  = useRef<Peer.Instance | null>(null);
  const peersRef       = useRef<Array<{ peerId: string, peer: Peer.Instance }>>([]);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimer  = useRef<NodeJS.Timeout | null>(null);
  const callStartRef   = useRef<number>(0);
  /** Latest call id (for cancel payload); kept in ref for timeout closure. */
  const callIdRef = useRef('');
  /** Outgoing 1:1 callee id or outgoing group id — for timeout cancel payloads. */
  const outgoingTargetRef = useRef('');

  const getMe = () => JSON.parse(localStorage.getItem('user') || '{}');

  const callAcceptedRef = useRef(false);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const lastIncomingCallIdRef = useRef<string | null>(null);
  const lastIncomingCallAtRef = useRef<number>(0);

  useEffect(() => { callAcceptedRef.current = callAccepted; }, [callAccepted]);
  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);

  const clearOutgoingTimeout = useCallback(() => {
    if (ringTimeoutRef.current != null) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const incoming = new Audio('/ringtone.mp3');
    incomingRingtoneRef.current = incoming;

    const outgoing = new Audio('/dialtone.mp3');
    const onOutgoingError = () => {
      outgoing.pause();
      outgoing.src = '';
      if (outgoingRingtoneRef.current === outgoing) outgoingRingtoneRef.current = null;
    };
    outgoing.addEventListener('error', onOutgoingError, { once: true });
    outgoingRingtoneRef.current = outgoing;

    return () => {
      clearOutgoingTimeout();
      incoming.pause();
      incoming.currentTime = 0;
      incoming.loop = false;
      if (incomingRingtoneRef.current === incoming) incomingRingtoneRef.current = null;

      outgoing.removeEventListener('error', onOutgoingError);
      outgoing.pause();
      outgoing.currentTime = 0;
      outgoing.loop = false;
      if (outgoingRingtoneRef.current === outgoing) outgoingRingtoneRef.current = null;
    };
  }, [clearOutgoingTimeout]);

  /** Bind local/remote WebRTC streams only once the in-call UI is mounted (`callAccepted` + VideoCallRoom refs). */
  useEffect(() => {
    if (!callAccepted || callEnded) {
      if (myVideo.current) myVideo.current.srcObject = null;
      if (userVideo.current) userVideo.current.srcObject = null;
      if (remoteAudio.current) remoteAudio.current.srcObject = null;
      return;
    }
    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
      myVideo.current.play?.().catch((err: unknown) => console.warn('Local video play blocked:', err));
    }
    if (!remoteStream) return;
    if (callType === 'voice') {
      const el = remoteAudio.current;
      if (el) {
        el.srcObject = remoteStream;
        el.play?.().catch((err: unknown) => console.warn('Remote audio play blocked:', err));
      }
    } else {
      const el = userVideo.current;
      if (el) {
        el.srcObject = remoteStream;
        el.play?.().catch((err: unknown) => console.warn('Remote video play blocked:', err));
      }
    }
  }, [callAccepted, callEnded, stream, remoteStream, callType]);

  useEffect(() => {
    if (!callAccepted || callEnded) return;
    callStartRef.current = Date.now();
    if (durationTimer.current) clearInterval(durationTimer.current);
    durationTimer.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    };
  }, [callAccepted, callEnded]);

  const stopIncomingRingtone = useCallback(() => {
    const el = incomingRingtoneRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
      el.loop = false;
    }
  }, []);

  const stopOutgoingRingtone = useCallback(() => {
    const el = outgoingRingtoneRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
      el.loop = false;
    }
  }, []);

  const stopAllCallSounds = useCallback(() => {
    stopIncomingRingtone();
    stopOutgoingRingtone();
  }, [stopIncomingRingtone, stopOutgoingRingtone]);

  const playIncomingRingtone = useCallback(() => {
    const el = incomingRingtoneRef.current;
    if (!el) return;
    el.loop = true;
    el.currentTime = 0;
    el.play().catch((err: unknown) => console.warn('Incoming ring autoplay blocked:', err));
  }, []);

  const playOutgoingRingtone = useCallback(() => {
    const el = outgoingRingtoneRef.current;
    if (!el) return;
    el.loop = true;
    el.currentTime = 0;
    el.play().catch((err: unknown) => console.warn('Outgoing ring autoplay blocked:', err));
  }, []);

  const closeCallNotification = useCallback(() => {
    if (window.activeCallNotification) {
      window.activeCallNotification.close();
      window.activeCallNotification = null;
    }
  }, []);

  const destroyPeer = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }
    peerRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    const current = streamRef.current;
    if (!current) return;
    current.getTracks().forEach(track => track.stop());
    streamRef.current = undefined;
    setStream(undefined);
    setRemoteStream(undefined);
    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
  }, [myVideo, userVideo, remoteAudio]);

  const resetCallState = useCallback(() => {
    setCallActive(false);
    setCallEnded(true);
    setIsCalling(false);
    setReceivingCall(false); // CRITICAL: Stop ringing immediately
    setCallDuration(0);
    setIsMinimized(false);
    setIsGroupCall(false);
    callStartRef.current = 0;
    stopAllCallSounds();
    closeCallNotification();

    if (durationTimer.current) { clearInterval(durationTimer.current); durationTimer.current = null; }
    clearOutgoingTimeout();

    stopStream();
    destroyPeer();
    
    peersRef.current.forEach(({ peer }) => peer.destroy());
    peersRef.current = [];
    setGroupPeers([]);

    setTimeout(() => {
      setCallAccepted(false);
      setCallActive(false);
      setCallEnded(false);
      setCaller('');
      setCallerName('');
      setCallerAvatar('');
      setCallId('');
      setCalleeId('');
      setCalleeName('');
      setCalleeAvatar('');
      setCallerSignal(undefined);
    }, 1000);
  }, [clearOutgoingTimeout, closeCallNotification, destroyPeer, stopAllCallSounds, stopStream]);

  const triggerNotification = useCallback((title: string, body: string, icon: string = '/logo.png') => {
    if ('Notification' in window && Notification.permission === 'granted') {
      // Clean up any existing notification first
      closeCallNotification();
      
      window.activeCallNotification = new Notification(title, { 
        body, 
        icon, 
        tag: 'rabta-incoming-call', // CRITICAL: Prevents duplicates
        requireInteraction: true 
      });
      window.activeCallNotification.onclick = () => {
        window.focus();
        closeCallNotification();
      };
    } else {
      console.warn('Notification permission not granted.');
    }
  }, [closeCallNotification]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingRing = (data: any) => {
      console.log('⚡ Fast Ring caught by frontend', data);
      setReceivingCall(true);
      setCaller(data.from); setCallerName(data.callerName);
      setCallerAvatar(data.callerAvatar || ''); 
      setCallType(data.callType || 'video');
      setIsGroupCall(false);
      if (data.chatId) setActiveChatId(data.chatId);
      
      triggerNotification('Incoming Call', `User ${data.callerName} is calling you...`, data.callerAvatar || '/logo.png');
    };

    const handleIncomingCall = (data: any) => {
      // Dedupe: backend may emit multiple aliases, or effect may race in dev
      const callIdKey = String(data?.callId || '');
      const now = Date.now();
      if (callIdKey && lastIncomingCallIdRef.current === callIdKey && (now - lastIncomingCallAtRef.current) < 1000) {
        return;
      }
      if (callIdKey) {
        lastIncomingCallIdRef.current = callIdKey;
        lastIncomingCallAtRef.current = now;
      }

      console.log('Heavy WebRTC Signal caught by frontend', data);
      setReceivingCall(true);
      setCaller(data.from);
      setCallerName(data.name || data.callerName || 'Unknown');
      setCallType(data.type || data.callType || 'video');
      if (data.callerAvatar) setCallerAvatar(data.callerAvatar);
      setCallerSignal(data.signal);
      setCallId(data.callId);
      if (data.chatId) setActiveChatId(data.chatId);
      
      playIncomingRingtone();

      // If the user already clicked "Accept" while waiting for this heavy signal:
      if (callAcceptedRef.current && connectionRef.current) {
        connectionRef.current.signal(data.signal);
      }
    };

    const handleIncomingGroupCall = (data: any) => {
      setReceivingCall(true); setCaller(data.groupId); setCallerName(data.callerName + ' (Group)');
      setCallId(data.callId); setCallType(data.callType || 'video');
      setIsGroupCall(true);
      setActiveChatId(data.groupId); // ✅ group chatId = groupId
      
      playIncomingRingtone();
      triggerNotification('Incoming Group Call', `User ${data.callerName} is calling the group...`, '/logo.png');
    };

    const handleUserOffline = () => {
      toast.error('The user is currently offline');
      clearOutgoingTimeout();
      stopAllCallSounds();
      setIsCalling(false);
    };

    const handleCallAccepted = (data: any) => {
      clearOutgoingTimeout(); // CRITICAL: Clear timeout immediately

      setCallAccepted(true);
      setCallActive(true);

      if (callAcceptedRef.current) return;

      console.log('🟢 FRONTEND: Received callAccepted from server!');
      if (!data?.signal) data = { signal: data };
      const signal = data.signal as Peer.SignalData;

      setCallEnded(false);
      callAcceptedRef.current = true;
      setIsCalling(false);
      stopAllCallSounds();

      const peer = peerRef.current ?? connectionRef.current;
      if (peer && !peer.destroyed) {
        try {
          peer.signal(signal);
          console.log('🟢 Signaled peer (caller answer SDP)');
        } catch (err) {
          console.error('🔴 Ignored peer signal error:', err);
        }
      } else {
        console.warn('🟡 Ignored callAccepted: Peer is already destroyed or missing.');
      }
    };

    socket.on('incoming-ring', handleIncomingRing);
    // Canonical incoming call event (avoid double-fire)
    socket.on('incomingCall', handleIncomingCall);
    socket.on('incoming-group-call', handleIncomingGroupCall);

    socket.on('call-rejected', resetCallState);
    socket.on('call-cancelled', resetCallState);
    socket.on('call-ended', resetCallState);
    socket.on('call-delivered', (data: { callId: string }) => setCallId(data.callId));
    socket.on('userOffline', handleUserOffline);
    socket.on('user-offline', handleUserOffline);

    socket.on('callAccepted', handleCallAccepted);
    socket.on('call-accepted', handleCallAccepted);

    // Mesh WebRTC Handlers
    socket.on('all-users-in-group', (usersInRoom: string[]) => {
      const peers: GroupPeer[] = [];
      usersInRoom.forEach(userId => {
        const peer = createPeer(userId, socket.id || '', stream!);
        peersRef.current.push({ peerId: userId, peer });
        peers.push({ peerId: userId });
      });
      setGroupPeers(peers);
    });

    socket.on('user-joined-group', (payload: any) => {
      // If we are the caller and this is the first person to join, mark session active (timer via callAccepted effect)
      if (isCalling && !callAccepted) {
        clearOutgoingTimeout();
        setCallAccepted(true);
        setCallActive(true);
        setIsCalling(false);
      }
      
      const peer = addPeer(payload.signal, payload.callerID, stream!);
      peersRef.current.push({ peerId: payload.callerID, peer });
      setGroupPeers(users => [...users, { peerId: payload.callerID }]);
    });

    socket.on('receiving-returned-signal', (payload: any) => {
      const item = peersRef.current.find(p => p.peerId === payload.id);
      item?.peer.signal(payload.signal);
    });

    socket.on('user-left-group', (userId: string) => {
      const peerObj = peersRef.current.find(p => p.peerId === userId);
      if (peerObj) peerObj.peer.destroy();
      peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
      setGroupPeers(users => users.filter(u => u.peerId !== userId));
    });

    return () => {
      socket.off('incoming-ring', handleIncomingRing);
      socket.off('incomingCall', handleIncomingCall);
      socket.off('incoming-group-call', handleIncomingGroupCall);

      socket.off('call-rejected', resetCallState);
      socket.off('call-cancelled', resetCallState);
      socket.off('call-ended', resetCallState);
      socket.off('call-delivered');
      socket.off('userOffline', handleUserOffline);
      socket.off('user-offline', handleUserOffline);

      socket.off('callAccepted', handleCallAccepted);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('all-users-in-group'); socket.off('user-joined-group');
      socket.off('receiving-returned-signal'); socket.off('user-left-group');
    };
  }, [clearOutgoingTimeout, playIncomingRingtone, resetCallState, socket, stopAllCallSounds, triggerNotification]);

  const toggleMinimize = () => setIsMinimized(prev => !prev);

  function createPeer(userToSignal: string, callerID: string, currentStream: MediaStream) {
    const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });
    peer.on('signal', signal => {
      socket?.emit('sending-group-signal', { userToSignal, callerID, signal });
    });
    peer.on('stream', userStream => {
      setGroupPeers(users => users.map(u => u.peerId === userToSignal ? { ...u, stream: userStream } : u));
    });
    return peer;
  }

  function addPeer(incomingSignal: any, callerID: string, currentStream: MediaStream) {
    const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });
    peer.on('signal', signal => {
      socket?.emit('returning-group-signal', { signal, callerID });
    });
    peer.on('stream', userStream => {
      setGroupPeers(users => users.map(u => u.peerId === callerID ? { ...u, stream: userStream } : u));
    });
    peer.signal(incomingSignal);
    return peer;
  }

  const callUser = async (idToCall: string, name: string, type: CallType = 'video', avatar = '', chatId?: string) => {
    const me = getMe();
    try {
      clearOutgoingTimeout();
      // Prevent WebRTC "abort" collisions from previous peers
      destroyPeer();
      setCallEnded(false);
      setCallActive(false);
      setIsCalling(true); setCalleeName(name); setCalleeId(idToCall);
      setCalleeAvatar(avatar); setCallType(type); setIsGroupCall(false);
      if (chatId) setActiveChatId(chatId); // ✅ store for leaveCall

      outgoingTargetRef.current = idToCall;

      // ⚡ IMMEDIATE FAST RING EMISSION
      socket?.emit('start-ringing', {
        to: idToCall,
        from: me._id || me.id || '',
        callerName: me.fullName || 'Unknown',
        callerAvatar: me.avatar || '',
        callType: type,
        chatId
      });

      playOutgoingRingtone();

      const RING_MS = 30_000;
      ringTimeoutRef.current = setTimeout(() => {
        console.log('Call timed out. No answer.');
        socket?.emit('cancel-call', { callId: callIdRef.current || '', to: outgoingTargetRef.current });
        resetCallState();
      }, RING_MS);

      const currentStream = await getMediaStream(type);
      setStream(currentStream);

      const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });
      peer.on('signal', signalData => {
        socket?.emit('callUser', {
          userToCall: idToCall,
          signal: signalData,
          from: me._id || me.id || '',
          name: me.fullName || 'Unknown',
          callerAvatar: me.avatar || '',
          type,
          chatId
        });
      });
      peer.on('stream', userStream => setRemoteStream(userStream));

      connectionRef.current = peer;
      peerRef.current = peer;
    } catch (err) {
      clearOutgoingTimeout();
      stopAllCallSounds();
      setIsCalling(false);
      console.error('Media Error:', err);
    }
  };

  const callGroup = async (groupId: string, name: string, type: CallType = 'video') => {
    const me = getMe();
    try {
      clearOutgoingTimeout();
      // Prevent WebRTC "abort" collisions from previous peers
      destroyPeer();
      setIsCalling(true); setCallAccepted(false); setCallActive(false); setCalleeName(name); setCalleeId(groupId);
      setCallType(type); setIsGroupCall(true);
      setActiveChatId(groupId); // ✅ for group calls, chatId === groupId

      outgoingTargetRef.current = groupId;

      const RING_MS = 30_000;
      ringTimeoutRef.current = setTimeout(() => {
        console.log('Call timed out. No answer.');
        const gid = outgoingTargetRef.current;
        socket?.emit('leave-group-room', { groupId: gid });
        resetCallState();
      }, RING_MS);

      const currentStream = await getMediaStream(type);
      setStream(currentStream);

      socket?.emit('start-group-call', { groupId, callerId: me._id || me.id || '', callerName: me.fullName || 'Unknown', callType: type });
      socket?.emit('join-group-room', { groupId, isCaller: true });

      playOutgoingRingtone();
    } catch (err) {
      console.error('Media Error:', err);
      stopAllCallSounds();
      resetCallState();
    }
  };

  const answerCall = async () => {
    clearOutgoingTimeout();
    setCallEnded(false);
    setCallAccepted(true);
    setCallActive(true);
    callAcceptedRef.current = true;
    setReceivingCall(false);
    stopAllCallSounds();
    closeCallNotification();
    try {
      // Prevent WebRTC "abort" collisions from previous peers
      destroyPeer();
      const currentStream = await getMediaStream(callType);
      setStream(currentStream);

      const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });
      peer.on('signal', signalData => {
        socket?.emit('answerCall', { to: caller, signal: signalData, callId });
        socket?.emit('answer-call', { to: caller, signal: signalData, callId });
        socket?.emit('callAccepted', { to: caller, signal: signalData, callId });
      });
      peer.on('stream', userStream => setRemoteStream(userStream));

      if (callerSignal) peer.signal(callerSignal);
      connectionRef.current = peer;
      peerRef.current = peer;
    } catch (err) {
      console.error('Media Error:', err);
    }
  };

  const answerGroupCall = async () => {
    clearOutgoingTimeout();
    setCallEnded(false);
    setCallAccepted(true);
    setCallActive(true);
    callAcceptedRef.current = true;
    setReceivingCall(false);
    stopAllCallSounds();
    closeCallNotification();
    try {
      // Prevent WebRTC "abort" collisions from previous peers
      destroyPeer();
      const currentStream = await getMediaStream(callType);
      setStream(currentStream);

      socket?.emit('join-group-room', { groupId: caller, callId, isCaller: false }); // 'caller' stores groupId in group calls
    } catch (err) {
      console.error('Media Error:', err);
    }
  };

  const leaveCall = () => {
    clearOutgoingTimeout(); // forcefully clear it
    const me = getMe();
    const durationSecs = callStartRef.current ? Math.floor((Date.now() - callStartRef.current) / 1000) : 0;
    
    // Determine final status
    const finalStatus = durationSecs > 0 ? 'completed' : 'missed';
    
    // Ensure we have a valid caller ID
    const callerId = me._id || me.id;

    const targetUserId = isGroupCall ? (calleeId || caller) : (caller || calleeId);

    // Build ONE unified payload just like the Group logic
    const unifiedCallData = {
      to: targetUserId, // CRITICAL: Ensure backend knows exactly who to forward this to
      callId: callId || "", // We still pass callId for DB lookup
      caller: callerId,
      receiver: targetUserId, // Extracted ID
      receiverModel: isGroupCall ? 'Group' : 'User',
      chatId: activeChatId,
      type: callType || 'video',
      status: finalStatus,
      duration: durationSecs
    };

    if (isGroupCall) {
      socket?.emit('leave-group-room', { groupId: calleeId || caller });
    }

    if (callAccepted) {
      console.log("FINAL EMITTING CALL DATA (ENDED):", JSON.stringify(unifiedCallData, null, 2));
      socket?.emit('end-call', unifiedCallData);
    } else if (isCalling) {
      console.log("FINAL EMITTING CALL DATA (CANCELLED):", JSON.stringify(unifiedCallData, null, 2));
      socket?.emit('cancel-call', unifiedCallData);
    } else if (receivingCall && !isGroupCall) {
      unifiedCallData.status = 'rejected';
      console.log("FINAL EMITTING CALL DATA (REJECTED):", JSON.stringify(unifiedCallData, null, 2));
      socket?.emit('reject-call', unifiedCallData);
    }

    setActiveChatId('');
    resetCallState();
  };

  return (
    <CallContext.Provider value={{
      stream, myVideo, userVideo, remoteAudio, callUser, answerCall, callGroup, answerGroupCall, isGroupCall, groupPeers, leaveCall,
      receivingCall, callerName, callerAvatar, callType, callAccepted, callActive, callEnded,
      isCalling, calleeName, calleeAvatar, callDuration, isMinimized, toggleMinimize
    }}>
      {children}
    </CallContext.Provider>
  );
};
