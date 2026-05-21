import React from 'react';
import { useCall } from '../../context/CallContext';

export const IncomingCallModal = () => {
  const { receivingCall, callAccepted, callerName, callerAvatar, callType, answerCall, answerGroupCall, isGroupCall, leaveCall } = useCall();

  if (!receivingCall || callAccepted) return null;

  const isVideo = callType === 'video';

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e2e] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-300">

        {/* Top: animated ring + avatar */}
        <div className="pt-10 pb-6 flex flex-col items-center text-center px-6">
          <div className="relative mb-5">
            <div className="absolute -inset-3 bg-[#7C3AED] rounded-full animate-ping opacity-30" />
            <div className="absolute -inset-1.5 bg-[#7C3AED]/40 rounded-full animate-pulse" />
            {callerAvatar ? (
              <img
                src={callerAvatar}
                alt={callerName}
                className="w-24 h-24 rounded-full object-cover relative z-10 border-4 border-white dark:border-[#1e1e2e] shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] relative z-10 border-4 border-white dark:border-[#1e1e2e] shadow-xl flex items-center justify-center text-white text-3xl font-bold">
                {callerName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <h3 className="text-2xl font-bold text-[#171717] dark:text-white mb-1">{callerName || 'Unknown'}</h3>
          <p className="text-[#7C3AED] dark:text-[#8B5CF6] font-medium flex items-center gap-2 text-sm">
            <span className={`material-icons-round text-base ${isVideo ? '' : 'animate-bounce'}`}>
              {isVideo ? 'videocam' : 'call'}
            </span>
            Incoming {isVideo ? 'Video' : 'Voice'} Call...
          </p>
        </div>

        {/* Bottom: action buttons */}
        <div className="flex bg-gray-50 dark:bg-[#171717] p-6 gap-10 justify-center border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={leaveCall}
              className="w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
              title="Decline"
            >
              <span className="material-icons-round text-2xl">call_end</span>
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={isGroupCall ? answerGroupCall : answerCall}
              className="w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 animate-pulse"
              title="Accept"
            >
              <span className="material-icons-round text-2xl">{isVideo ? 'videocam' : 'call'}</span>
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};