import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatsList } from '../components/chat/ChatsList';
import type { ChatItem } from '../components/chat/ChatsList';
import { ChatWindow, type MessageType } from '../components/chat/ChatWindow';
import { EmptyChatState } from '../components/chat/EmptyChatState';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

type ChatUser = { _id?: string; id?: string; fullName: string; avatar?: string; status?: string };

export const HomeFeed = () => {
  const location = useLocation();
  const pendingChatId = (location.state as { openChatId?: string } | null)?.openChatId;

  // 1. State: تخزين المحادثات والرسائل (دايناميك بالكامل)
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [, setIsLoadingChats] = useState(true);
  
  // 2. State: التحكم في النوافذ المنبثقة
  const [showNewMessage, setShowNewMessage] = useState(false);
  // Collapsible chat list (Telegram desktop style)
  const [isChatListOpen, setIsChatListOpen] = useState(true);

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
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        
        // تحويل شكل المحادثات من الباك لشكل الفرونت
        const formatted = response.data.data.chats
          .filter((chat: { isGroup?: boolean }) => !chat.isGroup) // 💡 Filter out group chats (Direct Messages only)
          .map((chat: { _id: string; users: Array<{ _id?: string; id?: string; fullName: string; avatar?: string; status?: string }>; latestMessage?: { content: string; createdAt: string } }) => {
            const otherUser = chat.users.find((u: { _id?: string; id?: string }) => (u._id || u.id) !== currentUser._id) as ChatUser | undefined;
            return {
              _id: chat._id,
              name: otherUser?.fullName || 'Chat',
              receiverId: otherUser?._id || otherUser?.id,
              lastMessage: chat.latestMessage?.content || 'No messages yet',
              time: chat.latestMessage ? new Date(chat.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
              avatar: otherUser?.avatar,
              initials: otherUser?.fullName?.[0],
              isOnline: otherUser?.status === 'online',
              isGroup: false
            };
          });

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
      try {
        const response = await axiosInstance.get(`/chats/${activeChatId}/messages`);
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        // تحويل شكل الرسائل من الباك لشكل الفرونت
        const formatted = response.data.data.messages.map((m: { _id: string; messageType: string; content: string; createdAt: string; senderId: { _id?: string } | string }) => ({
          id: m._id,
          type: m.messageType === 'file' ? 'file' : 'text',
          content: m.content,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMine: (typeof m.senderId === 'string' ? m.senderId : m.senderId._id) === currentUser._id
        }));
        setMessages(formatted);
      } catch (error: unknown) {
        const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load messages';
        toast.error(errorMessage);
      }
    };

    fetchMessages();
  }, [activeChatId]);

  // تحديد بيانات الشات المفتوح حالياً لتمريرها كـ Props
  const activeChat = chats.find(c => c._id === activeChatId);

  // New Message Search Logic
  const [contactQuery, setContactQuery] = useState('');
  const [contacts, setContacts] = useState<Array<{ _id: string; fullName: string; email: string; avatar?: string }>>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);

  useEffect(() => {
    const searchContacts = async () => {
      if (!contactQuery.trim()) {
        setContacts([]);
        return;
      }
      setIsSearchingContacts(true);
      try {
        const response = await axiosInstance.get('/users/search/all', {
          params: { keyword: contactQuery.trim() }
        });
        setContacts(response.data.data.users);
      } catch (error: unknown) {
        console.error("Search failed", error);
      } finally {
        setIsSearchingContacts(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      searchContacts();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [contactQuery]);

  const handleStartChat = async (userId: string) => {
    try {
      const response = await axiosInstance.post('/chats', { userId });
      const newChat = response.data.data.chat;
      // Refresh chats list with proper formatting
      const chatsRes = await axiosInstance.get('/chats');
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const formatted = chatsRes.data.data.chats
        .filter((chat: { isGroup?: boolean }) => !chat.isGroup)
        .map((chat: { _id: string; users: Array<{ _id?: string; id?: string; fullName: string; avatar?: string; status?: string }>; latestMessage?: { content: string; createdAt: string } }) => {
          const otherUser = chat.users.find((u: { _id?: string; id?: string }) => (u._id || u.id) !== currentUser._id) as ChatUser | undefined;
          return {
            _id: chat._id,
            name: otherUser?.fullName || 'Chat',
            receiverId: otherUser?._id || otherUser?.id,
            lastMessage: chat.latestMessage?.content || 'No messages yet',
            time: chat.latestMessage ? new Date(chat.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            avatar: otherUser?.avatar,
            initials: otherUser?.fullName?.[0],
            isOnline: otherUser?.status === 'online',
            isGroup: false
          };
        });
      setChats(formatted);
      setActiveChatId(newChat._id);
      setShowNewMessage(false);
    } catch (error) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start chat';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex w-full h-full bg-[#FAFAFA] dark:bg-[#171717] overflow-hidden relative">
      
      {/* 1. قائمة المحادثات (تستقبل الـ State الدايناميك) */}
      <ChatsList 
        chats={chats} 
        activeChatId={activeChatId} 
        onSelectChat={(id: string) => {
          setActiveChatId(id);
          // Mark as read when opened
          setChats(prev => prev.map((c: ChatItem) => c._id === id ? { ...c, unreadCount: 0 } : c));
        }}
        isChatListOpen={isChatListOpen}
        onClose={() => setIsChatListOpen(false)}
      />

      {activeChatId && activeChat ? (
        <ChatWindow 
          chatId={activeChatId}
          chatName={activeChat.name} 
          isOnline={activeChat.isOnline || false} 
          isGroup={activeChat.isGroup || false}
          messages={messages}
        />
      ) : (
        <EmptyChatState onNewMessage={() => setShowNewMessage(true)} />
      )}

      {/* 3. نافذة رسالة جديدة (New Message Modal) */}
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
               {/* Search Input */}
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
               {/* Contacts List */}
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