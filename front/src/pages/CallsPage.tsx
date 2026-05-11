import React, { useState, useEffect, useCallback } from 'react';
import type { AxiosResponse } from 'axios';
import axiosInstance from '../api/axiosInstance';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCall } from '../context/CallContext';

// ==========================================
// 1. Interfaces (Strictly Defined)
// ==========================================
export interface User {
  _id: string;
  fullName?: string;
  groupName?: string;
  avatar?: string;
  profilePic?: string;
  role?: string;
}

export interface CallRecord {
  _id: string;
  caller: User;
  receiver?: User;
  receiverModel?: 'User' | 'Group';
  chatId?: any;
  type: 'voice' | 'video';
  status: 'missed' | 'accepted' | 'ended' | 'rejected';
  duration?: number;
  createdAt: string;
}




export const CallsPage: React.FC = () => {
  // --- States ---
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Missed' | 'Meetings'>('All');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [showAiPopup, setShowAiPopup] = useState<boolean>(false);
  const user = useSelector((state: RootState) => state.auth.user);
  const myUserId = user?._id || user?.id; 
  const navigate = useNavigate();
  const { callUser, callGroup } = useCall();

  // --- Helper: get the other party from a call record ---
  const getOtherUser = useCallback((call: any): any => {
    // For group calls, pull data from chatId (populated Chat document)
    if (call.type === 'group' || call.chatId?.isGroup) {
      return {
        _id: call.chatId?._id || call.chatId,
        isGroup: true,
        fullName: call.chatId?.groupName || 'Group Call',
        avatar: call.chatId?.groupAvatar || '',
        jobTitle: `${call.chatId?.users?.length || 0} participants`
      };
    }

    // CRITICAL: Compare as strings — Mongoose ObjectIds are objects, not strings
    const isOutgoing = String(call.caller?._id) === String(myUserId);
    const displayParty = isOutgoing ? call.receiver : call.caller;

    const displayName = displayParty?.fullName
      || displayParty?.groupName
      || 'Unknown User';
    const displayAvatar = displayParty?.avatar || displayParty?.profilePic || '';

    return {
      _id: displayParty?._id,
      isGroup: false,
      fullName: displayName,
      avatar: displayAvatar,
      jobTitle: displayParty?.role || 'Professional'
    };
  }, [myUserId]);

  const getCallDirection = (call: any): 'incoming' | 'outgoing' => {
    // Same string coercion fix here
    return String(call.caller?._id) === String(myUserId) ? 'outgoing' : 'incoming';
  };

  // --- API Fetch ---
  useEffect(() => {
    const fetchHistory = async (): Promise<void> => {
      try {
        setIsLoading(true);
        const response: AxiosResponse<any> = await axiosInstance.get('/calls/history');
        
        // 💡 The backend returns { status: 'success', data: { calls: [...] } }
        const fetchedCalls = response.data.data.calls || [];
        setCalls(fetchedCalls);
        
        if (fetchedCalls.length > 0) {
          setSelectedCallId(fetchedCalls[0]._id);
        }
      } catch (err: unknown) {
        console.error("Error fetching call history:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  // --- Filtering Logic ---
  const filteredCalls = calls.filter((call) => {
    const otherUser = getOtherUser(call);
    const matchesFilter = 
      activeFilter === 'All' || 
      (activeFilter === 'Missed' && call.status === 'missed') || 
      (activeFilter === 'Meetings' && !!call.chatId?.isGroup);

    const matchesSearch = (otherUser?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const selectedCall = calls.find((c) => c._id === selectedCallId);
  const selectedOtherUser = selectedCall ? getOtherUser(selectedCall) : null;

  const handleDeleteCall = async () => {
    if (!selectedCallId) return;
    try {
      await axiosInstance.delete(`/calls/${selectedCallId}`);
      setCalls((prev) => prev.filter((c) => c._id !== selectedCallId));
      toast.success('Call log deleted');
      if (calls.length > 0) {
        setSelectedCallId(calls[0]._id === selectedCallId ? calls[1]?._id : calls[0]._id);
      }
    } catch (err) {
      toast.error('Failed to delete call log');
    }
  };

  const handleOpenChat = () => {
    if (!selectedCall) return;
    if (selectedCall.chatId?.isGroup) {
      navigate(`/groups/${selectedCall.chatId?._id || selectedCall.chatId}`);
    } else {
      navigate('/chats'); // Note: For exact 1-to-1 routing, Rabta might need /chats to handle specific IDs if supported.
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#FAFAFA] dark:bg-[#171717] transition-colors duration-300">
      
      {/* 1. Calls Sidebar */}
      <aside className="w-[300px] bg-white dark:bg-[#262626] border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0">
        <div className="p-4">
          <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">Calls</h2>
        </div>

        <div className="px-4 mb-3">
          <div className="relative flex items-center bg-gray-50 dark:bg-[#171717] rounded-xl px-3 py-1.5 border border-gray-100 dark:border-gray-800 focus-within:border-[#7C3AED]">
            <span className="material-icons-round text-[18px] text-gray-400">search</span>
            <input 
              type="text" 
              placeholder="Search calls..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm p-1 ml-2 outline-none w-full text-[#171717] dark:text-[#F5F5F5]"
            />
          </div>
        </div>

        <div className="px-4 pb-3 mb-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          {(['All', 'Missed', 'Meetings'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                activeFilter === filter ? 'bg-[#7C3AED] text-white shadow-md' : 'bg-gray-50 dark:bg-[#171717] text-gray-500 border border-gray-100 dark:border-gray-800'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-10 text-center text-gray-400 animate-pulse">Fetching records...</div>
          ) : filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <div className="w-16 h-16 bg-gray-100 dark:bg-[#171717] rounded-full flex items-center justify-center mb-4">
                <span className="material-icons-round text-3xl text-gray-300 dark:text-gray-600">call</span>
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">No call history</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Your recent calls will appear here.</p>
            </div>
          ) : filteredCalls.map((call) => {
            const other = getOtherUser(call);
            const direction = getCallDirection(call);
            const isSelected = selectedCallId === call._id;

            return (
              <div
                key={call._id}
                onClick={() => setSelectedCallId(call._id)}
                className={`px-4 py-3 flex items-center gap-3 border-l-4 cursor-pointer transition-all ${
                  isSelected ? 'border-[#7C3AED] bg-[#7C3AED]/5 dark:bg-[#8B5CF6]/10' : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={other.avatar || '/default-avatar.png'} className="w-12 h-12 rounded-full object-cover" alt={other.fullName} />
                  <span className={`material-icons-round absolute -bottom-1 -right-1 text-[14px] w-5 h-5 flex items-center justify-center rounded-full text-white ${
                    call.status === 'missed' ? 'bg-red-500' : 'bg-[#7C3AED]'
                  }`}>
                    {call.type === 'video' ? 'videocam' : 'call'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h4 className={`font-bold text-sm truncate ${call.status === 'missed' && direction === 'incoming' && !isSelected ? 'text-red-500' : ''}`}>
                      {other.fullName}
                    </h4>
                    <span className="text-[10px] text-gray-400">{new Date(call.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    <span className="material-icons-round text-[11px]">{direction === 'outgoing' ? 'call_made' : call.status === 'missed' ? 'call_missed' : 'call_received'}</span>
                    {call.type === 'video' ? 'Video' : 'Voice'} call • {call.status}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. Call Details Main Area */}
      <main className="flex-1 flex flex-col relative bg-[#FAFAFA] dark:bg-[#171717] overflow-y-auto">
        {selectedCall && selectedOtherUser ? (
          <div className="animate-in fade-in duration-500">
            <header className="p-4 md:p-6 bg-white dark:bg-[#262626] border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold">Call Info</h2>
              <div className="flex gap-2">
                <button onClick={handleDeleteCall} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"><span className="material-icons-round text-[20px]">delete_outline</span></button>
              </div>
            </header>

            <div className="flex flex-col items-center py-10 px-4 border-b border-gray-100 dark:border-white/5">
              <img src={selectedOtherUser.avatar || '/default-avatar.png'} className="w-28 h-28 rounded-full shadow-lg mb-4 object-cover border-4 border-white dark:border-[#262626]" alt="Selected User" />
              <h1 className="text-2xl font-bold mb-1">{selectedOtherUser.fullName}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{selectedOtherUser.role || 'Professional'}</p>
              
              <div className="flex gap-6">
                <button 
                  onClick={() => {
                    if (selectedOtherUser.isGroup) {
                      callGroup(selectedOtherUser._id, selectedOtherUser.fullName, 'voice');
                    } else {
                      callUser(selectedOtherUser._id, selectedOtherUser.fullName, 'voice', selectedOtherUser.avatar);
                    }
                  }}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/20 text-[#7C3AED] dark:text-[#8B5CF6] flex items-center justify-center group-hover:bg-[#7C3AED] group-hover:text-white transition-all shadow-sm">
                    <span className="material-icons-round text-[24px]">call</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Voice</span>
                </button>
                <button 
                  onClick={() => {
                    if (selectedOtherUser.isGroup) {
                      callGroup(selectedOtherUser._id, selectedOtherUser.fullName, 'video');
                    } else {
                      callUser(selectedOtherUser._id, selectedOtherUser.fullName, 'video', selectedOtherUser.avatar);
                    }
                  }}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 rounded-full bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/20 text-[#7C3AED] dark:text-[#8B5CF6] flex items-center justify-center group-hover:bg-[#7C3AED] group-hover:text-white transition-all shadow-sm">
                    <span className="material-icons-round text-[24px]">videocam</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Video</span>
                </button>
                <button onClick={handleOpenChat} className="flex flex-col items-center gap-2 group">
                  <div className="w-14 h-14 rounded-full bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/20 text-[#7C3AED] dark:text-[#8B5CF6] flex items-center justify-center group-hover:bg-[#7C3AED] group-hover:text-white transition-all shadow-sm">
                    <span className="material-icons-round text-[24px]">chat_bubble_outline</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Chat</span>
                </button>
              </div>
            </div>

            <div className="p-6 max-w-2xl mx-auto w-full">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Recent Activity</h3>
              <div className="space-y-6">
                {calls.filter(c => getOtherUser(c)._id === selectedOtherUser._id).map(log => (
                  <div key={log._id} className="flex items-start gap-4">
                    <span className={`material-icons-round mt-1 ${log.status === 'missed' ? 'text-red-500' : 'text-green-500'}`}>
                      {log.status === 'missed' ? 'call_missed' : 'call_made'}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm">{log.type} Call - {log.status}</h4>
                      <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</p>
                      {log.duration && <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded mt-2 inline-block">Duration: {log.duration}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <span className="material-icons-round text-6xl mb-4">history</span>
             <p>{isLoading ? 'Syncing history...' : 'Select a record to see details'}</p>
          </div>
        )}

        {/* 3. AI Helper Popup */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {showAiPopup && (
            <div className="w-80 bg-white dark:bg-[#262626] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden animate-in slide-in-from-bottom-5">
              <div className="bg-[#7C3AED] p-4 text-white flex justify-between items-center font-bold text-sm">
                <span>Rabta AI Assistant</span>
                <button onClick={() => setShowAiPopup(false)}><span className="material-icons-round text-sm">close</span></button>
              </div>
              <div className="h-32 p-4 text-xs italic text-gray-500">I can help you summarize your call logs...</div>
            </div>
          )}
          <button 
            onClick={() => setShowAiPopup(!showAiPopup)}
            className="w-12 h-12 bg-[#7C3AED] rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-all"
          >
            <span className="material-icons-round">bolt</span>
          </button>
        </div>
      </main>
    </div>
  );
};