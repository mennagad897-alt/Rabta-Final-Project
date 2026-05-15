import React, { useState, useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';

const PeerVideo = ({ stream }: { stream?: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video playsInline autoPlay ref={ref} className="w-full h-full object-cover" />;
};

// Formats seconds → "MM:SS"
const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const VideoCallRoom = () => {
  const {
    callAccepted, callEnded,
    myVideo, userVideo,
    remoteAudio,
    leaveCall, stream,
    callType, callerName, calleeName,
    callDuration,
    isMinimized, toggleMinimize,
    isGroupCall, groupPeers
  } = useCall();

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  if (!callAccepted || callEnded) return null;

  const isVoice = callType === 'voice';
  const remoteName = callerName || calleeName || 'User';

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
    }
  };

  const toggleCamera = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (stream) {
      const video = stream.getVideoTracks()[0];
      if (video) { video.enabled = !video.enabled; setIsCameraOff(!video.enabled); }
    }
  };

  const handleEndCall = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    leaveCall();
  };

  // ── Minimized (PiP) View ──
  if (isMinimized) {
    return (
      <div
        onClick={toggleMinimize}
        className="fixed bottom-6 right-6 w-72 h-48 bg-gray-900 rounded-2xl shadow-2xl z-[1000] overflow-hidden border border-white/10 cursor-pointer group hover:ring-2 hover:ring-[#7C3AED] transition-all animate-in slide-in-from-bottom-5"
      >
        {isVoice ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#171717] to-[#262626]">
            {/* Remote audio playback (must be autoPlay and NOT muted) */}
            <audio playsInline autoPlay ref={remoteAudio} className="hidden" />
            {/* Keep remote stream attached for any video-track cases */}
            <video playsInline autoPlay ref={userVideo} className="hidden" />
            <div className="w-16 h-16 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-2xl font-bold shadow-lg animate-pulse">
              {remoteName.charAt(0).toUpperCase()}
            </div>
            <p className="text-white text-sm mt-3 font-semibold truncate px-4">{remoteName}</p>
            <p className="text-green-400 text-xs font-mono">{formatDuration(callDuration)}</p>
          </div>
        ) : (
          <>
            <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 w-16 h-24 bg-black rounded-lg overflow-hidden border border-white/20">
              <video playsInline muted ref={myVideo} autoPlay className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`} />
              {isCameraOff && <div className="w-full h-full flex items-center justify-center bg-gray-800"><span className="material-icons-round text-gray-500 text-lg">videocam_off</span></div>}
            </div>
          </>
        )}

        {/* Minimized Overlay Controls (visible on hover) */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <button onClick={toggleMinimize} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 backdrop-blur-sm transition-colors" title="Expand">
            <span className="material-icons-round text-lg">open_in_full</span>
          </button>
          <button onClick={handleEndCall} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 shadow-lg transition-colors" title="End Call">
            <span className="material-icons-round text-lg">call_end</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Maximized (Full Screen) View ──
  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in zoom-in-95 duration-300">

      {/* ── Top bar: timer + remote name + Minimize ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
          <span className="text-white font-semibold text-lg">{remoteName}</span>
          <span className="text-green-400 font-mono text-sm font-bold tracking-widest">{formatDuration(callDuration)}</span>
        </div>
        <button
          onClick={toggleMinimize}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-colors flex items-center justify-center"
          title="Minimize Call"
        >
          <span className="material-icons-round text-xl">close_fullscreen</span>
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 relative w-full overflow-hidden flex items-center justify-center p-6 mt-16 mb-28">
        {isGroupCall ? (
          <div className="relative w-full max-w-7xl h-full">
            <div className={`grid gap-4 w-full h-full ${groupPeers.length === 0 ? 'grid-cols-1' : groupPeers.length === 1 ? 'grid-cols-2' : groupPeers.length <= 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <div className="bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
                <video playsInline muted ref={myVideo} autoPlay className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`} />
                {isCameraOff && <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500"><span className="material-icons-round text-5xl">videocam_off</span></div>}
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-xs">You</div>
              </div>
              {groupPeers.map(peer => (
                <div key={peer.peerId} className="bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
                  <PeerVideo stream={peer.stream} />
                  <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-xs">Participant</div>
                </div>
              ))}
            </div>
          </div>
        ) : isVoice ? (
          // Voice-only UI: large avatar + animated rings
          <div className="flex flex-col items-center gap-6">
            {/* Remote audio playback (must be autoPlay and NOT muted) */}
            <audio playsInline autoPlay ref={remoteAudio} className="hidden" />
            {/* Keep remote stream attached for any video-track cases */}
            <video playsInline autoPlay ref={userVideo} className="hidden" />
            <div className="relative">
              <div className="absolute -inset-12 rounded-full bg-[#7C3AED]/20 animate-ping" />
              <div className="absolute -inset-6 rounded-full bg-[#7C3AED]/30 animate-pulse" />
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] relative z-10 flex items-center justify-center text-white text-6xl font-bold shadow-2xl border-4 border-[#7C3AED]/50">
                {remoteName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        ) : (
          // Video UI: remote full-screen + local PiP
          <div className="relative w-full max-w-6xl h-full bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
            {stream && (
              <div className="absolute bottom-6 right-6 w-48 h-64 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-transform hover:scale-105">
                <video playsInline muted ref={myVideo} autoPlay className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`} />
                {isCameraOff && (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500">
                    <span className="material-icons-round text-5xl">videocam_off</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Control bar ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6 px-8 py-4 bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 ${isMuted ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <span className="material-icons-round text-2xl">{isMuted ? 'mic_off' : 'mic'}</span>
        </button>

        <button
          onClick={handleEndCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95"
          title="End Call"
        >
          <span className="material-icons-round text-3xl">call_end</span>
        </button>

        {!isVoice && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 ${isCameraOff ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            <span className="material-icons-round text-2xl">{isCameraOff ? 'videocam_off' : 'videocam'}</span>
          </button>
        )}
      </div>
    </div>
  );
};