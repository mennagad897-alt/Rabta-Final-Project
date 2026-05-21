import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChatsList } from '../components/chat/ChatsList';
import type { ChatItem } from '../components/chat/ChatsList';
import { ChatWindow, type MessageType, formatFileSize, extractFileName } from '../components/chat/ChatWindow';
import { ProfileSidePanel } from '../components/chat/ProfileSidePanel';
import { SharedMediaSidePanel } from '../components/chat/SharedMediaSidePanel';
import { EmptyChatState } from '../components/chat/EmptyChatState';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useChat } from '../context/ChatContext';

type ChatUser = { _id?: string; id?: string; fullName: string; avatar?: string; status?: string; showOnlineStatus?: boolean };

export const HomeFeed = () => {
  const { socket } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingChatId = (location.state as { openChatId?: string } | null)?.openChatId;

  // 1. State: تخزين المحادثات والرسائل (دايناميك بالكامل)
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const [, setIsLoadingChats] = useState(true);

  // 2. State: التحكم في النوافذ المنبثقة
  const [showNewMessage, setShowNewMessage] = useState(false);
  // Collapsible chat list (Telegram desktop style)
  const [isChatListOpen, setIsChatListOpen] = useState(true);
  /** Right-hand in-chat search sidebar (lifted here so layout stays coordinated). */
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  /** Contact profile side panel (same shell as search — keeps user in chat). */
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  /** Shared media / files / links panel (replaces full-page /shared). */
  const [isSharedMediaOpen, setIsSharedMediaOpen] = useState(false);
  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')?._id;

  const formatChatFromApi = (chat: any): ChatItem => {
    const otherUser = chat.users.find((u: any) => (u._id || u.id) !== currentUserId) as ChatUser | undefined;
    const latest = chat.latestMessage;
    const senderIdStr = typeof latest?.senderId === 'object' ? latest?.senderId?._id : latest?.senderId;
    const lastMessageIsMine = senderIdStr === currentUserId;
    const lastMessageStatus = latest?.status || 'sent';
    const messageType = latest?.messageType;
    const contentRaw = latest?.content;
    const contentStr = typeof contentRaw === 'object' && contentRaw !== null ? (contentRaw.text || contentRaw.message || 'Message') : (contentRaw || '');
    const content = messageType && messageType !== 'text' ? 'Media message' : contentStr;
    return {
      _id: chat._id,
      name: otherUser?.fullName || 'Unknown User',
      receiverId: otherUser?._id || otherUser?.id,
      lastMessage: content,
      time: latest?.createdAt ? new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      updatedAt: latest?.createdAt || chat.updatedAt,
      avatar: otherUser?.avatar,
      initials: (otherUser?.fullName || 'U')[0],
      isOnline: otherUser?.status === 'online',
      showOnlineStatus: otherUser?.showOnlineStatus !== false,
      isGroup: false,
      unreadCount: chat.unreadCount || 0,
      lastMessageIsMine,
      lastMessageStatus
    };
  };

  const upsertChatPreview = (chatId: string, payload: { content?: string; messageType?: string; createdAt?: string; senderId?: any; status?: 'sending' | 'sent' | 'delivered' | 'read' }) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => String(c._id) === String(chatId));
      if (idx === -1) return prev;
      const target = prev[idx];
      const senderIdStr = typeof payload.senderId === 'object' ? payload.senderId?._id : payload.senderId;
      const updated: ChatItem = {
        ...target,
        lastMessage: payload.messageType && payload.messageType !== 'text'
          ? 'Media message'
          : (payload.content || target.lastMessage),
        time: payload.createdAt ? new Date(payload.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : target.time,
        updatedAt: payload.createdAt || new Date().toISOString(),
        lastMessageIsMine: senderIdStr === currentUserId,
        lastMessageStatus: payload.status || (senderIdStr === currentUserId ? 'sent' : target.lastMessageStatus),
        unreadCount: String(chatId) === String(activeChatIdRef.current) ? 0 : (senderIdStr === currentUserId ? target.unreadCount : (target.unreadCount || 0) + 1)
      };
      const next = prev.filter((c) => String(c._id) !== String(chatId));
      return [updated, ...next];
    });
  };


  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // CRITICAL: Always force sidebar open if no chat is selected
  useEffect(() => {
    if (!activeChatId) setIsChatListOpen(true);
  }, [activeChatId]);

  // 3. Effect: جلب قائمة المحادثات من الباك-إند
  useEffect(() => {
    const fetchChats = async () => {
      try {
        setIsLoadingChats(true);
        const response = await axiosInstance.get('/chats');
        // تحويل شكل المحادثات من الباك لشكل الفرونت
        const formatted = response.data.data.chats
          .filter((chat: { isGroup?: boolean }) => !chat.isGroup) // 💡 Filter out group chats (Direct Messages only)
          .map((chat: any) => formatChatFromApi(chat));

        setChats(formatted);
        if (pendingChatId) {
          setActiveChatId(pendingChatId);
        }
      } catch (error: unknown) {
        const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load chats';
        toast.error(errorMessage);
      } finally {
        setIsLoadingChats(false);
      }
    };
    fetchChats();
  }, [pendingChatId]);

  // 4. Effect: جلب الرسائل لما اليوزر يختار شات معين
  useEffect(() => {
    if (!activeChatId) return;

    const fetchMessages = async () => {
      const targetChatId = activeChatId;
      try {
        const response = await axiosInstance.get(`/chats/${targetChatId}/messages`);
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        // تحويل شكل الرسائل من الباك لشكل الفرونت
        const sortedMessages = [...response.data.data.messages].sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const formatted = sortedMessages.map((m: { _id: string; messageType: string; content: string; createdAt: string; senderId: { _id?: string } | string; status?: MessageType['status']; duration?: number; isDeletedForEveryone?: boolean; isEdited?: boolean; isPinned?: boolean; reactions?: any[]; attachments?: any[]; replyTo?: any }) => {
          const isMine = (typeof m.senderId === 'string' ? m.senderId : m.senderId._id) === currentUser._id;
          return {
            id: m._id,
            type: (['text', 'audio', 'file', 'image', 'video'].includes(m.messageType) ? m.messageType : (m.content?.endsWith('.webm') ? 'audio' : 'text')) as 'text' | 'audio' | 'file' | 'image' | 'video' | 'call_summary',
            content: m.content || m.attachments?.[0]?.fileUrl || '',
            fileUrl: m.attachments?.[0]?.fileUrl || (['image', 'video', 'file'].includes(m.messageType) ? m.content : undefined),
            fileName: extractFileName(m.attachments?.[0]?.fileUrl),
            fileSize: formatFileSize(m.attachments?.[0]?.fileSize),
            duration: m.duration,
            isDeletedForEveryone: m.isDeletedForEveryone,
            isEdited: m.isEdited,
            isPinned: m.isPinned,
            reactions: m.reactions || [],
            replyTo: m.replyTo,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMine,
            status: m.status || (isMine ? 'sent' : undefined),
          };
        });
        if (String(targetChatId) === String(activeChatId)) {
          setMessages(formatted);
        }
      } catch (error: unknown) {
        const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load messages';
        toast.error(errorMessage);
      }
    };

    fetchMessages();
  }, [activeChatId]);

  useEffect(() => {
    setIsChatSearchOpen(false);
    setIsProfileOpen(false);
    setProfileUserId(null);
    setIsSharedMediaOpen(false);
  }, [activeChatId]);

  /** Deep link: `/shared/:id` → `/chats` with state — open shared panel after chat switch. */
  useEffect(() => {
    const sid = (location.state as { openSharedForChat?: string } | null)?.openSharedForChat;
    if (!sid) return;
    setActiveChatId(sid);
    navigate('/chats', { replace: true, state: {} });
    const t = window.setTimeout(() => {
      setIsSharedMediaOpen(true);
      setIsProfileOpen(false);
      setProfileUserId(null);
      setIsChatSearchOpen(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [location.state, navigate]);

  useEffect(() => {
    if (!socket) return;
    if (!chats.length) return;

    chats.forEach((chat) => socket.emit('join-room', chat._id));
    return () => {
      chats.forEach((chat) => socket.emit('leave-room', chat._id));
    };
  }, [socket, chats]);

  useEffect(() => {
    if (!socket) return;

    const handleRealtimeMessage = (incoming: any) => {
      const chatId = incoming?.chatId;
      if (!chatId) return;
      upsertChatPreview(chatId, incoming);
      if (String(chatId) !== String(activeChatIdRef.current)) {
        const senderName = incoming?.senderName || incoming?.sender?.fullName || 'New message';
        const content = incoming?.content || 'Sent a message';
        toast(`💬 ${senderName}: ${content}`, { duration: 4000 });
      }
    };

    const handleStatusUpdate = (payload: { chatId: string; status: 'delivered' | 'read'; readBy?: string }) => {
      if (!payload?.chatId) return;
      setChats((prev) => prev.map((chat) => {
        if (String(chat._id) !== String(payload.chatId)) return chat;
        if (!chat.lastMessageIsMine) return chat;
        if (payload.readBy && String(payload.readBy) === String(currentUserId)) return chat;
        return { ...chat, lastMessageStatus: payload.status };
      }));
    };

    const handleMessageDelivered = ({ chatId }: { chatId: string }) => {
      setChats((prev) => prev.map((chat) => String(chat._id) === String(chatId)
        ? { ...chat, lastMessageStatus: 'delivered' }
        : chat
      ));
    };
    const handleMessagesReadPreview = ({ chatId, readBy }: { chatId: string; readBy?: string }) => {
      setChats((prev) => prev.map((chat) => {
        if (String(chat._id) !== String(chatId)) return chat;
        if (!chat.lastMessageIsMine) return chat;
        if (readBy && String(readBy) === String(currentUserId)) return chat;
        return { ...chat, lastMessageStatus: 'read' };
      }));
    };
    const handleChatCleared = ({ chatId }: { chatId: string }) => {
      setChats((prev) => prev.filter((chat) => String(chat._id) !== String(chatId)));
      if (String(chatId) === String(activeChatIdRef.current)) {
        setActiveChatId(null);
      }
    };

    socket.on('receive-message', handleRealtimeMessage);
    socket.on('message-status-update', handleStatusUpdate);
    socket.on('messageDelivered', handleMessageDelivered);
    socket.on('messagesRead', handleMessagesReadPreview);
    socket.on('messages-read', handleMessagesReadPreview);
    socket.on('chatCleared', handleChatCleared);

    const handleOnlineUsers = (onlineUserIds: string[]) => {
      console.log('🟢 online-users received:', onlineUserIds);
      setChats((prev) => prev.map((chat) => ({
        ...chat,
        isOnline: chat.receiverId ? onlineUserIds.includes(String(chat.receiverId)) : false,
      })));
    };
    socket.on('online-users', handleOnlineUsers);

    return () => {
      socket.off('receive-message', handleRealtimeMessage);
      socket.off('message-status-update', handleStatusUpdate);
      socket.off('messageDelivered', handleMessageDelivered);
      socket.off('messagesRead', handleMessagesReadPreview);
      socket.off('messages-read', handleMessagesReadPreview);
      socket.off('chatCleared', handleChatCleared);
      socket.off('online-users', handleOnlineUsers);
    };
  }, [socket, currentUserId]);

  // تحديد بيانات الشات المفتوح حالياً لتمريرها كـ Props
  const activeChat = chats.find(c => c._id === activeChatId);

  // New Message Search Logic
  const [phoneQuery, setPhoneQuery] = useState('');
  const [foundUser, setFoundUser] = useState<{ _id: string; fullName: string; phoneNumber: string; avatar?: string; role?: string; jobTitle?: string } | null>(null);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const searchContacts = async () => {
    if (!phoneQuery.trim()) {
      setFoundUser(null);
      setSearchAttempted(false);
      return;
    }
    setIsSearchingContacts(true);
    setSearchAttempted(true);
    try {
      const response = await axiosInstance.get('/users/find-by-phone', {
        params: { phone: phoneQuery.trim() }
      });
      setFoundUser(response.data.data.user);
    } catch (error: unknown) {
      console.error("Search failed", error);
      setFoundUser(null);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleStartChat = async (userId: string) => {
    try {
      const response = await axiosInstance.post('/chats', { userId });
      const newChat = response.data.data.chat;
      // Refresh chats list with proper formatting
      const chatsRes = await axiosInstance.get('/chats');
      const formatted = chatsRes.data.data.chats
        .filter((chat: { isGroup?: boolean }) => !chat.isGroup)
        .map((chat: any) => formatChatFromApi(chat));
      setChats(formatted);
      setActiveChatId(newChat._id);
      setShowNewMessage(false);
    } catch (error) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start chat';
      toast.error(errorMessage);
    }
  };

  const handleChatSearchOpenChange = (open: boolean) => {
    setIsChatSearchOpen(open);
    if (open) {
      setIsSharedMediaOpen(false);
      setIsProfileOpen(false);
      setProfileUserId(null);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await axiosInstance.delete(`/chats/${chatId}/clear`);
      setChats((prev) => prev.filter((chat) => String(chat._id) !== String(chatId)));
      if (String(chatId) === String(activeChatId)) {
        setActiveChatId(null);
      }
      toast.success("Chat hidden from list");
    } catch (error) {
      console.error("Failed to hide chat", error);
      toast.error("Failed to hide chat");
    }
  };

  return (
    <div className="flex w-full h-full bg-[#FAFAFA] dark:bg-[#171717] overflow-hidden relative">

      {/* 1. قائمة المحادثات (تستقبل الـ State الدايناميك) */}
      <ChatsList
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={async (id: string) => {
          setActiveChatId(id);
          // Mark as read when opened locally
          setChats(prev => prev.map((c: ChatItem) => c._id === id ? { ...c, unreadCount: 0 } : c));
          // API Call to clear unread in DB
          try {
            await axiosInstance.put(`/chats/${id}/read`);
          } catch (e) {
            console.error('Failed to mark read', e);
          }
        }}
        isChatListOpen={isChatListOpen}
        onClose={() => setIsChatListOpen(false)}
        onAddContact={() => {
          setShowNewMessage(true);
          setPhoneQuery('');
          setFoundUser(null);
          setSearchAttempted(false);
        }}
        onToggleFocusMode={() => setIsChatListOpen(false)}
        onDeleteChat={handleDeleteChat}
      />

      {activeChatId && activeChat ? (
        <div className="flex flex-1 min-h-0 min-w-0">
          <ChatWindow
            chatId={activeChatId}
            chatName={activeChat.name}
            isOnline={activeChat.isOnline || false}
            showOnlineStatus={activeChat.showOnlineStatus !== false}
            isGroup={activeChat.isGroup || false}
            receiverId={activeChat.receiverId}
            messages={messages}
            setMessages={setMessages}
            isChatSearchOpen={isChatSearchOpen}
            onChatSearchOpenChange={handleChatSearchOpenChange}
            isChatListOpen={isChatListOpen}
            onOpenChatList={() => setIsChatListOpen(true)}
            chats={chats}
            onOpenProfile={(userId) => {
              navigate(`/freelancer-profile/${userId}`);
            }}
            onOpenSharedMedia={() => {
              setIsSharedMediaOpen(true);
              setIsProfileOpen(false);
              setProfileUserId(null);
              setIsChatSearchOpen(false);
            }}
            onCloseChat={() => setActiveChatId(null)}
          />
          {isSharedMediaOpen ? (
            <SharedMediaSidePanel
              messages={messages}
              onClose={() => setIsSharedMediaOpen(false)}
            />
          ) : isProfileOpen && profileUserId ? (
            <ProfileSidePanel
              chatId={activeChatId}
              profileUserId={profileUserId}
              onClose={() => {
                setIsProfileOpen(false);
                setProfileUserId(null);
              }}
            />
          ) : null}
        </div>
      ) : (
        <EmptyChatState onNewMessage={() => setShowNewMessage(true)} />
      )}

      {/* 3. نافذة رسالة جديدة (New Message Modal) */}
      {showNewMessage && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewMessage(false)}></div>
          <div className="bg-white dark:bg-[#262626] w-full max-w-md rounded-2xl shadow-2xl relative z-10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-lg text-[#171717] dark:text-[#F5F5F5]">New Contact</h3>
              <button onClick={() => setShowNewMessage(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter the phone number to find a user.</p>
              {/* Search Input */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">phone</span>
                  <input
                    type="text"
                    placeholder="e.g. +123456789"
                    value={phoneQuery}
                    onChange={(e) => setPhoneQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchContacts()}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none text-[#171717] dark:text-[#F5F5F5]"
                  />
                </div>
                <button
                  onClick={searchContacts}
                  disabled={isSearchingContacts || !phoneQuery.trim()}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Search
                </button>
              </div>

              {/* Search Results */}
              <div className="mt-6">
                {isSearchingContacts ? (
                  <div className="text-center py-4 text-gray-500">Searching...</div>
                ) : foundUser ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                    {foundUser.avatar ? (
                      <img src={foundUser.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold shrink-0">
                        {foundUser.fullName[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#171717] dark:text-[#F5F5F5] truncate">{foundUser.fullName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{foundUser.jobTitle || foundUser.role}</p>
                    </div>
                    <button
                      onClick={() => handleStartChat(foundUser._id)}
                      className="shrink-0 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 text-[#7C3AED] px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                    >
                      Message
                    </button>
                  </div>
                ) : searchAttempted ? (
                  <div className="text-center text-sm text-red-500 dark:text-red-400 py-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
                    User not found. Please check the phone number.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};