import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { useChat } from '../../context/ChatContext';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { CreatePostModal } from '../CreatePostModal';

export type MessageType = {
  id: string;
  type: 'text' | 'file' | 'audio' | 'call_summary';
  content?: string;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  time: string;
  isMine: boolean;
  isPending?: boolean;
};

interface ChatWindowProps {
  chatId: string;
  receiverId?: string;
  chatName: string;
  isOnline: boolean;
  isGroup?: boolean;
  messages: MessageType[];
  setMessages?: React.Dispatch<React.SetStateAction<MessageType[]>>;
  isChatListOpen?: boolean;
  onOpenChatList?: () => void;
  groupMembers?: string[];
}

type SearchUser = {
  _id: string;
  fullName: string;
  email?: string;
  role?: string;
  avatar?: string;
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  chatId, 
  receiverId, 
  chatName, 
  isOnline, 
  isGroup = false,
  messages, 
  setMessages,
  isChatListOpen = true,
  onOpenChatList,
  groupMembers = []
}) => {
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showAiPopup, setShowAiPopup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [inputText, setInputText] = useState('');
  const [activeSidePanel, setActiveSidePanel] = useState<'details' | 'search' | null>(null);
  const [activeTab, setActiveTab] = useState<'Members' | 'Media' | 'Posts'>('Members');
  const [isMuted, setIsMuted] = useState(false);
  const [canAddMembers] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showGroupPostModal, setShowGroupPostModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isSearchingUsers] = useState(false);
  const [searchResults] = useState<SearchUser[]>([]);
  const { socket } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (incoming: unknown) => {
      if (!setMessages) return;
      const incoming_msg = incoming as { chatId: string; _id: string; messageType: string; content: string; createdAt: string };
      if (incoming_msg.chatId !== chatId) return;

      const formatted: MessageType = {
        id: incoming_msg._id,
        type: incoming_msg.messageType === 'file' ? 'file' : 'text',
        content: incoming_msg.content,
        time: new Date(incoming_msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMine: false
      };

      setMessages(prev => {
        if (prev.some(m => m.id === formatted.id)) return prev;
        return [...prev, formatted];
      });
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('receive-message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [socket, chatId, setMessages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !setMessages) return;

    const tempId = `temp-${Date.now()}`;
    const newMsg: MessageType = {
      id: tempId,
      type: 'text',
      content: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
      isPending: true
    };

    setMessages(prev => [...prev, newMsg]);
    const textToSend = inputText;
    setInputText('');
    setShowEmojiPicker(false);

    try {
      const response = await axiosInstance.post(`/chats/${chatId}/messages`, {
        content: textToSend,
        messageType: 'text'
      });

      const saved = response.data.data.message;
      setMessages(prev => prev.map(m => m.id === tempId ? {
        id: saved._id,
        type: 'text',
        content: saved.content,
        time: new Date(saved.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMine: true,
        isPending: false
      } : m));

      if (socket) {
        socket.emit('send_message', {
          chatId,
          content: saved.content,
          messageType: 'text',
          _id: saved._id,
          createdAt: saved.createdAt,
          senderId: saved.senderId
        });
      }
    } catch {
      toast.error("Failed to send message");
      setMessages!(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !setMessages) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('messageType', 'file');

    try {
      toast.loading("Uploading file...", { id: 'upload' });
      const response = await axiosInstance.post(`/chats/${chatId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success("File sent", { id: 'upload' });
      
      const saved = response.data.data.message;
      const formatted: MessageType = {
        id: saved._id,
        type: 'file',
        content: saved.content,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        time: new Date(saved.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMine: true
      };
      setMessages!(prev => [...prev, formatted]);
      
      if (socket) {
        socket.emit('send_message', { chatId, ...saved });
      }
    } catch {
      toast.error("Failed to upload file", { id: 'upload' });
    }
  };

  const handleCall = async (type: 'voice' | 'video') => {
    try {
      await axiosInstance.post('/calls/initiate', {
        receiverId: receiverId || chatId,
        type: type
      });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} call initiated`);
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Call failed";
      toast.error(errorMessage);
    }
  };

  const cancelRecording = () => {
    setShowAiPopup(false);
    toast.success("Recording cancelled");
  };

  const togglePauseResume = () => {
    setIsPaused(prev => !prev);
  };

  const handleAddUserToGroup = async (userId: string) => {
    try {
      await axiosInstance.post(`/chats/group/${chatId}/members`, { userId });
      toast.success("Member added to group");
      setShowAddMemberModal(false);
      setUserSearchQuery("");
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to add member";
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex-1 flex min-w-0 h-full">
      <main className="flex-1 flex flex-col bg-[#FAFAFA] dark:bg-[#171717] min-h-0 min-w-0 transition-colors duration-300 relative">
        <header 
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('button')) setActiveSidePanel('details');
          }}
          className="h-16 px-4 bg-white/80 dark:bg-[#262626]/80 backdrop-blur-md flex items-center justify-between border-b border-gray-200 dark:border-gray-800 z-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 shrink-0 transition-colors"
        >
          <div className="flex items-center min-w-0 gap-2">
            {!isChatListOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenChatList?.(); }}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors shrink-0"
                title="Open chat list"
              >
                <span className="material-icons text-[22px]">menu</span>
              </button>
            )}
          <div className="flex flex-col min-w-0">
            <h2 className="text-[#171717] dark:text-[#F5F5F5] font-bold text-base truncate">{chatName || 'Unknown Chat'}</h2>
            {isGroup ? (
              <span className="text-gray-500 dark:text-gray-400 text-xs truncate">
                {groupMembers && groupMembers?.filter(Boolean)?.length > 0 
                  ? (groupMembers?.filter(Boolean)?.length <= 2 
                      ? groupMembers?.filter(Boolean)?.join(", ") 
                      : `${groupMembers?.filter(Boolean)?.slice(0, 2).join(", ")}, +${groupMembers?.filter(Boolean)?.length - 2} others`)
                  : "Group members"}
              </span>
            ) : (
              isOnline && <span className="text-[#7C3AED] dark:text-[#8B5CF6] text-xs font-medium">Online</span>
            )}
          </div>
          </div>
          <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500 shrink-0">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <button 
                onClick={(e) => { e.stopPropagation(); handleCall('video'); }}
                className="px-2.5 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-[#7C3AED] transition-colors"
              >
                <span className="material-icons-round text-[20px]">videocam</span>
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleCall('voice'); }}
                className="px-1 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-[#7C3AED] transition-colors"
              >
                <span className="material-icons-round text-[18px]">call</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-4">
          <div className="flex justify-center my-4">
            <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Today</span>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.isMine ? 'items-end' : 'items-start'} w-full`}>
              {msg.type === 'text' ? (
                <div className={`${msg.isMine ? 'bg-[#7C3AED] text-white rounded-tr-none' : 'bg-white dark:bg-[#262626] text-[#171717] dark:text-[#F5F5F5] border border-gray-200 dark:border-gray-800 rounded-tl-none'} rounded-xl p-3 shadow-sm max-w-[80%] ${msg.isPending ? 'opacity-70' : ''}`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <div className={`flex justify-end items-center gap-1 mt-1 ${msg.isMine ? 'text-white/80' : 'text-gray-400'}`}>
                    <span className="text-[10px]">{msg.time}</span>
                    {msg.isMine && <span className="material-icons text-[12px]">{msg.isPending ? 'schedule' : 'done_all'}</span>}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-800 rounded-xl rounded-tl-none p-2 shadow-sm max-w-[80%]">
                  <a href={msg?.fileUrl ? `${import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000'}${msg?.fileUrl}` : '#'} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden mb-2 hover:opacity-90 transition-opacity">
                    <div className="bg-[#FAFAFA] dark:bg-[#171717] p-4 flex items-center gap-3 border border-gray-200 dark:border-gray-800">
                      <div className="w-10 h-10 bg-white dark:bg-[#262626] rounded flex items-center justify-center border border-gray-200 dark:border-gray-800">
                        <span className="material-icons text-[#7C3AED]">description</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[#171717] dark:text-[#F5F5F5] text-sm font-medium">{msg?.fileName || 'Attachment'}</span>
                        {msg?.fileSize && <span className="text-gray-400 text-[10px]">{msg?.fileSize}</span>}
                      </div>
                    </div>
                  </a>
                  <p className="text-[#171717] dark:text-[#F5F5F5] text-sm px-1 mb-1">{msg?.content}</p>
                  <span className="block text-right text-[10px] text-gray-400">{msg?.time}</span>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <footer className="p-4 bg-white dark:bg-[#262626] border-t border-gray-200 dark:border-gray-800 shrink-0 relative">
          {showEmojiPicker && (
            <div className="absolute bottom-20 right-4 z-50 shadow-2xl rounded-2xl overflow-hidden">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}
          <div className="max-w-4xl mx-auto flex items-end gap-4">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mb-2 text-gray-400 hover:text-[#7C3AED] transition-colors shrink-0"
            >
              <span className="material-icons">attach_file</span>
            </button>
            <div className="flex-1 bg-[#FAFAFA] dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-gray-700 flex items-center px-4 py-1.5 focus-within:border-[#7C3AED] transition-colors min-w-0 relative">
              {showAiPopup && (
                <div className="absolute bottom-[calc(100%+10px)] left-4 right-4 md:left-auto md:right-auto md:w-80 bg-white dark:bg-[#262626] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col z-50">
                  <div className="bg-[#7C3AED] dark:bg-[#8B5CF6] p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="font-bold text-sm">Rabta AI Assistant</span>
                    </div>
                    <button onClick={() => setShowAiPopup(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                      <span className="material-icons-round text-sm">close</span>
                    </button>
                  </div>
                  <div className="h-48 bg-[#FAFAFA] dark:bg-[#171717] p-4 text-sm text-gray-500 italic overflow-y-auto">
                    How can I help you with your conversation with {chatName}?
                  </div>
                  <div className="flex items-center gap-5 text-gray-500">
                    <button onClick={cancelRecording} className="hover:text-red-500 transition-colors" title="Cancel Recording">
                      <span className="material-icons-round">delete</span>
                    </button>
                    <button onClick={togglePauseResume} className="hover:text-[#7C3AED] transition-colors" title={isPaused ? "Resume" : "Pause"}>
                      <span className="material-icons-round">{isPaused ? 'play_circle' : 'pause_circle'}</span>
                    </button>
                  </div>
                </div>
              )}
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 resize-none text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 outline-none hide-scrollbar" 
                placeholder="Write a message..." 
                rows={1}
              ></textarea>
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`ml-4 transition-colors shrink-0 ${showEmojiPicker ? 'text-[#7C3AED]' : 'text-gray-400 hover:text-[#7C3AED]'}`}
              >
                <span className="material-icons">sentiment_satisfied_alt</span>
              </button>
              <button 
                onClick={() => setShowAiPopup(!showAiPopup)} 
                className={`ml-4 transition-colors shrink-0 ${showAiPopup ? 'text-[#7C3AED]' : 'text-gray-400 hover:text-[#7C3AED]'}`}
              >
                <span className="material-icons-round">bolt</span>
              </button>
              <button className="ml-4 text-gray-400 hover:text-[#7C3AED] transition-colors shrink-0"><span className="material-icons">mic</span></button>
            </div>
            
            <button 
              onClick={() => setShowCreatePost(true)}
              className="bg-[#7C3AED]/10 text-[#7C3AED] w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#7C3AED]/20 transition-all shadow-sm shrink-0"
              title="Create Post"
            >
              <span className="material-icons text-xl">add</span>
            </button>

            <button 
              onClick={handleSendMessage}
              className="bg-[#7C3AED] text-white w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-90 shadow-md shrink-0"
            >
              <span className="material-icons text-xl">send</span>
            </button>
          </div>
        </footer>
      </main>

      {showCreatePost && (
        <CreatePostModal 
          isOpen={showCreatePost} 
          onClose={() => setShowCreatePost(false)} 
          groupId={chatId} 
          groupName={chatName}
          onPostSuccess={() => {
            setShowCreatePost(false);
            toast.success("Post shared in chat");
          }}
        />
      )}

      {showUserDetails && (
        <aside className="w-85 bg-white dark:bg-[#262626] border-l border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-300 relative z-10 shrink-0">
          <div className="p-6 pb-4 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 relative shrink-0">
            <button onClick={() => setShowUserDetails(false)} className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition-colors">
              <span className="material-icons">close</span>
            </button>
            <h3 className="font-bold text-[#171717] dark:text-[#F5F5F5]">
              {activeSidePanel === 'details' ? (isGroup ? 'Group Info' : 'Contact Info') : 'Search Messages'}
            </h3>
            {activeSidePanel === 'details' ? (
              isGroup && (
                <button 
                  onClick={() => setShowEditGroupModal(true)} 
                  className="text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                >
                  <span className="material-icons-round text-xl">edit</span>
                </button>
              )
            ) : (
              <div className="w-6"></div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto hide-scrollbar p-6">
            {activeSidePanel === 'details' ? (
              <div className="flex flex-col">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-4">
                    <div className="w-28 h-28 rounded-full bg-linear-to-tr from-[#7C3AED] to-[#ec4899] text-white flex items-center justify-center text-4xl font-bold shadow-lg">
                      {isGroup ? 'G' : chatName.charAt(0)}
                    </div>
                    <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#10B981] border-4 border-white dark:border-[#262626] rounded-full"></div>
                  </div>
                  <h3 className="font-bold text-xl text-[#171717] dark:text-[#F5F5F5] text-center mb-1">{chatName}</h3>
                  <p className="text-sm text-gray-500 text-center">
                    {isGroup ? `${groupMembers?.length || 0} members, 1 online` : (isOnline ? 'Online' : 'Offline')}
                  </p>
                </div>

                <div className="flex justify-between items-center w-full px-2 mb-8">
                  {isGroup && canAddMembers && (
                    <div 
                      className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowAddMemberModal(true)}
                    >
                      <div className="w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center text-[#7C3AED]">
                        <span className="material-icons-round">person_add</span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Add</span>
                    </div>
                  )}
                  
                  <div 
                    className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      setIsMuted(!isMuted);
                      toast.success(isMuted ? "Notifications unmuted" : "Notifications muted");
                    }}
                  >
                    <div className={`w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center ${isMuted ? 'text-[#7C3AED]' : 'text-gray-500 dark:text-gray-400'}`}>
                      <span className="material-icons-round">{isMuted ? 'notifications_off' : 'notifications'}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                  </div>
                  
                  <div 
                    className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity" 
                    onClick={() => setActiveSidePanel('search')}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      <span className="material-icons-round">search</span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Search</span>
                  </div>
                  
                  {isGroup && (
                    <div 
                      className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowLeaveConfirmModal(true)}
                    >
                      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-center text-red-500">
                        <span className="material-icons-round">exit_to_app</span>
                      </div>
                      <span className="text-xs text-red-500 font-medium">Leave</span>
                    </div>
                  )}
                </div>

                <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-2">About</h4>
                  <p className="text-sm text-[#171717] dark:text-[#F5F5F5] leading-relaxed">
                    {isGroup ? 'Welcome to the group! We discuss frontend development, React, and modern UI/UX design patterns.' : 'Hey there! I am using Rabta.'}
                  </p>
                </div>

                {isGroup && canAddMembers && (
                  <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] rounded-2xl p-4 mb-6 border border-gray-100 dark:border-gray-800">
                    <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-2">Invite Link</h4>
                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
                      <span className="text-sm text-gray-500 truncate select-all">https://rabta.app/g/react2026</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText('https://rabta.app/g/react2026');
                          toast.success("Link copied!");
                        }}
                        className="text-[#7C3AED] hover:text-[#6D28D9] shrink-0 transition-colors"
                      >
                        <span className="material-icons-round text-lg">content_copy</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 bg-[#FAFAFA] dark:bg-[#171717] p-1 rounded-xl mb-4 border border-gray-100 dark:border-gray-800">
                  <button 
                    onClick={() => setActiveTab('Members')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'Members' ? 'bg-white dark:bg-[#262626] text-[#7C3AED] shadow-sm' : 'text-gray-500 hover:text-[#171717] dark:hover:text-[#F5F5F5]'}`}
                  >
                    Members
                  </button>
                  <button 
                    onClick={() => setActiveTab('Media')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'Media' ? 'bg-white dark:bg-[#262626] text-[#7C3AED] shadow-sm' : 'text-gray-500 hover:text-[#171717] dark:hover:text-[#F5F5F5]'}`}
                  >
                    Media
                  </button>
                  <button 
                    onClick={() => setActiveTab('Posts')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'Posts' ? 'bg-white dark:bg-[#262626] text-[#7C3AED] shadow-sm' : 'text-gray-500 hover:text-[#171717] dark:hover:text-[#F5F5F5]'}`}
                  >
                    Posts
                  </button>
                </div>

                <div className="w-full">
                  {activeTab === 'Members' && (
                    <div className="flex flex-col gap-3">
                      {groupMembers?.length ? groupMembers.map((member, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-[#FAFAFA] dark:hover:bg-[#171717] rounded-xl cursor-pointer transition-colors">
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 shrink-0">
                            {member.charAt(0)}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-bold text-[#171717] dark:text-[#F5F5F5] truncate">{member}</span>
                            <span className="text-xs text-gray-500">Member</span>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center text-sm text-gray-500 py-4">No members to display.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Media' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                    </div>
                  )}

                  {activeTab === 'Posts' && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <span className="material-icons-round text-4xl opacity-20 mb-2">article</span>
                      <p className="text-sm">No posts yet.</p>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                  <input 
                    type="text" 
                    placeholder="Search in chat..." 
                    className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#7C3AED] text-[#171717] dark:text-[#F5F5F5]"
                  />
                </div>
                <div className="text-center text-gray-400 text-sm mt-10">
                  <span className="material-icons-round text-4xl opacity-20 mb-2 block">search</span>
                  Search for messages
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {showGroupPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">Create Group Post</h2>
              <button onClick={() => setShowGroupPostModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6">
              <textarea 
                className="w-full h-32 bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-[#171717] dark:text-[#F5F5F5] resize-none focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="What's on your mind? Share with the group..."
              ></textarea>
              <div className="flex items-center gap-3 mt-4">
                <button className="text-gray-400 hover:text-[#7C3AED] transition-colors">
                  <span className="material-icons-round">image</span>
                </button>
                <button className="text-gray-400 hover:text-[#7C3AED] transition-colors">
                  <span className="material-icons-round">poll</span>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-[#1f1f1f] flex justify-end gap-3">
              <button onClick={() => setShowGroupPostModal(false)} className="px-5 py-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium">
                Cancel
              </button>
              <button onClick={() => { setShowGroupPostModal(false); toast.success("Post created in group!"); }} className="px-6 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-medium transition-colors">
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">Edit Group Info</h2>
              <button onClick={() => setShowEditGroupModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-500 mb-2">Group Name</label>
              <input type="text" defaultValue={chatName} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl py-3 px-4 text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:border-[#7C3AED] mb-4" />
              
              <label className="block text-sm font-medium text-gray-500 mb-2">Description</label>
              <textarea rows={3} defaultValue="Welcome to the group! We discuss frontend development, React, and modern UI/UX design patterns." className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl py-3 px-4 text-[#171717] dark:text-[#F5F5F5] resize-none focus:outline-none focus:border-[#7C3AED]"></textarea>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-[#1f1f1f] flex justify-end gap-3">
              <button onClick={() => setShowEditGroupModal(false)} className="px-5 py-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium">Cancel</button>
              <button onClick={() => { setShowEditGroupModal(false); toast.success("Group info updated"); }} className="px-6 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-medium transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">Add Member</h2>
              <button onClick={() => { setShowAddMemberModal(false); setUserSearchQuery(""); }} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="relative mb-6">
                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input 
                  type="text" 
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search users by name or email..." 
                  className="w-full pl-10 pr-4 py-3 bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:border-[#7C3AED] transition-colors text-[#171717] dark:text-[#F5F5F5]"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                {isSearchingUsers ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div key={user._id} className="flex items-center justify-between p-3 bg-[#FAFAFA] dark:bg-[#171717] rounded-xl border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold">
                          {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" /> : user.fullName.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-[#171717] dark:text-[#F5F5F5] truncate">{user.fullName}</span>
                          <span className="text-xs text-gray-500 truncate">{user.email || user.role}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddUserToGroup(user._id)}
                        className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))
                ) : userSearchQuery.trim().length >= 2 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">No users found matching "{userSearchQuery}"</div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm italic">Type at least 2 characters to search...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-round text-3xl">warning</span>
              </div>
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5] mb-2">Leave Group?</h2>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to leave this group? You won't receive any more messages from it.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowLeaveConfirmModal(false)} className="flex-1 py-3 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium">Cancel</button>
                <button 
                  onClick={async () => {
                    try {
                      await axiosInstance.put(`/chats/group/${chatId}/leave`);
                      toast.success("You left the group");
                      setShowLeaveConfirmModal(false);
                      setActiveSidePanel(null);
                    } catch {
                      toast.error("Failed to leave group");
                    }
                  }} 
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};