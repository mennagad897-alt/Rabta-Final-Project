import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ChatsList } from '../components/chat/ChatsList';
import type { ChatItem } from '../components/chat/ChatsList';
import { ChatWindow, type MessageType } from '../components/chat/ChatWindow';
import { EmptyChatState } from '../components/chat/EmptyChatState';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useChat } from '../context/ChatContext';

type ChatUser = { _id?: string; id?: string; fullName: string; avatar?: string; status?: string };

interface RawChat {
  _id: string;
  isGroup: boolean;
  users: ChatUser[];
  latestMessage?: { content: string; createdAt: string };
  unreadCount?: number;
}

interface RawMessage {
  _id: string;
  messageType?: string;
  content: string;
  createdAt: string;
  senderId: string | { _id?: string; id?: string };
  chatId: string;
}

type ApiError = { response?: { data?: { message?: string } } };

export const HomeFeed = () => {
  const location = useLocation();
  const { chatId: urlChatId } = useParams<{ chatId?: string }>();
  const pendingChatId = urlChatId || (location.state as { openChatId?: string } | null)?.openChatId;

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [, setIsLoadingChats] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [isChatListOpen, setIsChatListOpen] = useState(true);

  // ✅ ref عشان نعرف لو الـ pendingChatId اتفتح قبل كده
  const pendingHandled = useRef(false);

  useEffect(() => {
    if (!activeChatId) setIsChatListOpen(true);
  }, [activeChatId]);

  const formatChats = (rawChats: RawChat[], currentUserId: string): ChatItem[] =>
    rawChats
      .filter((chat) => !chat.isGroup)
      .map((chat) => {
        const otherUser = chat.users.find((u: ChatUser) => (u._id || u.id) !== currentUserId) as ChatUser | undefined;
        return {
          _id: chat._id,
          name: otherUser?.fullName || 'Chat',
          receiverId: otherUser?._id || otherUser?.id,
          lastMessage: chat.latestMessage?.content || 'No messages yet',
          time: chat.latestMessage ? new Date(chat.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          avatar: otherUser?.avatar,
          initials: otherUser?.fullName?.[0],
          isOnline: otherUser?.status === 'online',
          isGroup: false,
          unreadCount: chat.unreadCount || 0
        };
      });

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setIsLoadingChats(true);
        const response = await axiosInstance.get('/chats');
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const formatted = formatChats(response.data.data.chats, currentUser._id);
        setChats(formatted);

        // ✅ لو جاي من CallsPage أو NewContact، افتح الشات مباشرة
        if (pendingChatId && !pendingHandled.current) {
          pendingHandled.current = true;
          setActiveChatId(pendingChatId);
        }
      } catch (error: unknown) {
        const errorMessage = (error as ApiError)?.response?.data?.message || 'Failed to load chats';
        toast.error(errorMessage);
      } finally {
        setIsLoadingChats(false);
      }
    };
    fetchChats();
  }, [pendingChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    const fetchMessages = async () => {
      try {
        const response = await axiosInstance.get(`/chats/${activeChatId}/messages`);
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const messagesArray = response.data?.data?.messages || response.data?.messages || [];
        if (!Array.isArray(messagesArray)) return;

        const formatted: MessageType[] = messagesArray.map((m: RawMessage) => ({
          id: m._id,
          type: (m.messageType === 'file' ? 'file' : 'text') as MessageType['type'],
          content: m.content,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMine: (typeof m.senderId === 'string' ? m.senderId : m.senderId._id || m.senderId.id) === (currentUser._id || currentUser.id)
        }));
        setMessages(formatted);
      } catch (error: unknown) {
        toast.error((error as ApiError)?.response?.data?.message || 'Failed to load messages');
      }
    };
    fetchMessages();
  }, [activeChatId]);

  const activeChat = chats.find(c => c._id === activeChatId);

  const [contactQuery, setContactQuery] = useState('');
  const [contacts, setContacts] = useState<Array<{ _id: string; fullName: string; email: string; avatar?: string }>>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);

  useEffect(() => {
    const searchContacts = async () => {
      if (!contactQuery.trim()) { setContacts([]); return; }
      setIsSearchingContacts(true);
      try {
        const response = await axiosInstance.get('/users/search/all', { params: { keyword: contactQuery.trim() } });
        setContacts(response.data.data.users);
      } catch { /* silent */ } finally {
        setIsSearchingContacts(false);
      }
    };
    const t = setTimeout(searchContacts, 500);
    return () => clearTimeout(t);
  }, [contactQuery]);

  const { socket } = useChat();
  
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: RawMessage) => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentUserId = currentUser._id || currentUser.id;
      const senderId = typeof msg.senderId === 'object' ? msg.senderId._id || msg.senderId.id : msg.senderId;
      
      // Update the chats list when a new message arrives
      setChats(prev => {
        const chatIdx = prev.findIndex(c => c._id === msg.chatId);
        if (chatIdx === -1) return prev;

        const updatedChats = [...prev];
        const chat = updatedChats[chatIdx];
        
        chat.lastMessage = msg.content;
        chat.time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Only increment unread count if NOT the active chat AND NOT my own message
        if (msg.chatId !== activeChatId && senderId !== currentUserId) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        updatedChats.splice(chatIdx, 1);
        return [chat, ...updatedChats];
      });
    };

    socket.on('receive-message', handleNewMessage);
    return () => {
      socket.off('receive-message', handleNewMessage);
    };
  }, [socket, activeChatId]);

  const handleStartChat = async (userId: string) => {
    try {
      const response = await axiosInstance.post('/chats', { userId });
      const newChat = response.data.data.chat;
      const chatsRes = await axiosInstance.get('/chats');
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      setChats(formatChats(chatsRes.data.data.chats, currentUser._id));
      setActiveChatId(newChat._id);
      setShowNewMessage(false);
    } catch (error: unknown) {
      toast.error((error as ApiError)?.response?.data?.message || 'Failed to start chat');
    }
  };

  return (
    <div className="flex w-full h-full bg-[#FAFAFA] dark:bg-[#171717] overflow-hidden relative">
      <ChatsList 
        chats={chats} 
        activeChatId={activeChatId} 
        onSelectChat={async (id: string) => {
          setActiveChatId(id);
          setChats(prev => prev.map((c: ChatItem) => c._id === id ? { ...c, unreadCount: 0 } : c));
          
          try {
            await axiosInstance.put(`/chats/${id}/read`);
          } catch (err) {
            console.error("Failed to mark messages as read", err);
          }
        }}
        isChatListOpen={isChatListOpen}
        onClose={() => setIsChatListOpen(false)}
      />

      {/* ✅ setMessages بيتمرر دلوقتي عشان الإرسال يشتغل */}
      {activeChatId && activeChat ? (
        <ChatWindow 
          chatId={activeChatId}
          chatName={activeChat.name} 
          isOnline={activeChat.isOnline || false} 
          isGroup={activeChat.isGroup || false}
          messages={messages}
          setMessages={setMessages}
          isChatListOpen={isChatListOpen}
          onOpenChatList={() => setIsChatListOpen(true)}
        />
      ) : (
        <EmptyChatState onNewMessage={() => setShowNewMessage(true)} />
      )}

      {showNewMessage && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewMessage(false)}></div>
          <div className="bg-white dark:bg-[#262626] w-full max-w-md rounded-2xl shadow-2xl relative z-10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-lg text-[#171717] dark:text-[#F5F5F5]">New Message</h3>
              <button onClick={() => setShowNewMessage(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                <input 
                  type="text" 
                  placeholder="Search contacts..." 
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none text-[#171717] dark:text-[#F5F5F5]" 
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {isSearchingContacts ? (
                  <div className="text-center py-4 text-gray-500">Searching...</div>
                ) : contacts.length > 0 ? (
                  contacts.map(contact => (
                    <div 
                      key={contact._id} 
                      onClick={() => handleStartChat(contact._id)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-colors"
                    >
                      {contact.avatar ? (
                        <img src={contact.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold">
                          {contact.fullName[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">{contact.fullName}</p>
                        <p className="text-xs text-gray-500">{contact.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                    {contactQuery.trim() ? "No users found" : "Suggested contacts will appear here..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};