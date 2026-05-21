import React from 'react';
import { useCall } from '../../context/CallContext';

export const OutgoingCallModal = () => {
  const { isCalling, callAccepted, calleeName, calleeAvatar, callType, leaveCall } = useCall();

  if (!isCalling || callAccepted) return null;

  const isVideo = callType === 'video';

  return (
    <div className="fixed inset-0 z-[1000] bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex flex-col items-center justify-center text-white animate-in fade-in duration-300">

      {/* Pulsing avatar */}
      <div className="relative mb-6">
        <div className="absolute -inset-6 rounded-full bg-[#7C3AED]/20 animate-ping" />
        <div className="absolute -inset-3 rounded-full bg-[#7C3AED]/30 animate-pulse" />
        {calleeAvatar ? (
          <img
            src={calleeAvatar}
            alt={calleeName}
            className="w-32 h-32 rounded-full object-cover relative z-10 border-4 border-[#7C3AED]/60 shadow-2xl"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] relative z-10 border-4 border-[#7C3AED]/60 shadow-2xl flex items-center justify-center text-4xl font-bold">
            {calleeName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + status */}
      <h2 className="text-2xl font-bold mb-2 tracking-tight">{calleeName}</h2>
      <p className="text-purple-300 animate-pulse flex items-center gap-2 text-sm font-medium mb-12">
        <span className="material-icons-round text-base">{isVideo ? 'videocam' : 'call'}</span>
        Ringing...
      </p>

      {/* Cancel */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={leaveCall}
          className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95"
          title="Cancel Call"
        >
          <span className="material-icons-round text-3xl">call_end</span>
        </button>
        <span className="text-xs text-red-300 font-medium">Cancel</span>
      </div>
    </div>
  );
};