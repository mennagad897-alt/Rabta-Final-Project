import React from 'react';

import { AiAssistant } from '../shared/AiAssistant';

export interface ChatItem {
  _id: string;
  id?: string;
  name: string;
  receiverId?: string; // 💡 الطرف التاني في المحادثة (للمكالمات)
  lastMessage: string;
  time: string;
  updatedAt?: string;
  avatar?: string;
  initials?: string;
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  isGroup?: boolean; // لو جروب بياخد لون برتقالي، لو شات عادي بياخد بنفسجي
  unreadCount?: number;
  lastMessageIsMine?: boolean;
  lastMessageStatus?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface ChatsListProps {
  chats: ChatItem[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  isChatListOpen?: boolean;
  onClose?: () => void;
  onAddContact?: () => void;
  onToggleFocusMode?: () => void;
  onDeleteChat?: (chatId: string) => void;
}

export const ChatsList: React.FC<ChatsListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  isChatListOpen = true,
  onAddContact,
  onToggleFocusMode,
  onDeleteChat
}) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const getReceipt = (chat: ChatItem) => {
    if (!chat.lastMessageIsMine) return '';
    if (chat.lastMessageStatus === 'read') return '✓✓';
    if (chat.lastMessageStatus === 'delivered') return '✓✓';
    return '✓';
  };

  const filteredChats = chats.filter(chat =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className={`${isChatListOpen === false ? 'w-0 opacity-0 overflow-hidden border-none' : 'w-[320px] opacity-100 border-r border-gray-200 dark:border-gray-800'} bg-[#FAFAFA] dark:bg-[#171717] flex flex-col h-full transition-all duration-300 z-40 relative min-h-0 shrink-0`}>

      {/* الهيدر ومربع البحث */}
      <div className="p-4 flex flex-col gap-4 shrink-0 min-w-[320px]">
        <div className="flex items-center justify-between text-[#171717] dark:text-[#F5F5F5]">
          <span className="text-xl font-bold tracking-tight">Rabta</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddContact?.()}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400"
              title="New Contact"
            >
              <span className="material-icons">add</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400"
              >
                <span className="material-icons">menu</span>
              </button>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#262626] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 z-[110]">
                    <button
                      onClick={() => { setIsMenuOpen(false); onToggleFocusMode?.(); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-sm text-[#171717] dark:text-[#F5F5F5] flex items-center gap-3 transition-colors"
                    >
                      <span className="material-icons-round text-[18px]">fullscreen</span>
                      Focus Mode
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="relative group">
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">search</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-800 rounded-lg py-2 pl-10 pr-4 text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#7C3AED]/50 transition-all text-sm focus:outline-none"
            placeholder="Search" type="text"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {searchQuery.trim() && filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
            <span className="material-icons-round text-4xl text-gray-300 dark:text-gray-600 mb-2">search_off</span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No chats found matching<br /><span className="font-semibold text-[#171717] dark:text-[#F5F5F5]">'{searchQuery}'</span>
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => onSelectChat(chat._id)}
              className={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${activeChatId === chat._id
                ? 'bg-white dark:bg-[#262626] border-l-4 border-[#7C3AED]' // حالة لو الشات مفتوح
                : 'hover:bg-gray-100 dark:hover:bg-gray-800/50' // حالة لو الشات مش مفتوح
                }`}
            >
              <div className="relative shrink-0">
                {chat.avatar ? (
                  <img className="w-12 h-12 rounded-full object-cover" src={chat.avatar} />
                ) : (
                  <div
                    className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${chat.isGroup
                      ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
                      : 'bg-[#7C3AED]/10 text-[#7C3AED]'
                      }`}
                  >
                    {chat.initials}
                  </div>
                )}
                {chat.isOnline && chat.showOnlineStatus !== false && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-[#171717] dark:text-[#F5F5F5] font-semibold text-sm truncate">{chat.name || 'Unknown User'}</h3>
                  <span className={`${activeChatId === chat._id ? 'text-[#7C3AED]' : 'text-gray-400'} text-xs font-medium shrink-0 ml-2`}>{chat.time}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <p className="text-gray-500 dark:text-gray-400 text-sm truncate pr-2">
                    {chat.lastMessageIsMine && (
                      <span className={chat.lastMessageStatus === 'read' ? 'text-[#7C3AED]' : 'text-gray-400'}>
                        {getReceipt(chat)}{' '}
                      </span>
                    )}
                    {chat.lastMessage}
                  </p>
                  {chat.unreadCount ? (
                    <span className="bg-[#7C3AED] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0">
                      {chat.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Delete/Hide Button */}
              {onDeleteChat && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Are you sure you want to hide this chat?')) {
                      onDeleteChat(chat._id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 absolute right-2 top-1/2 -translate-y-1/2 z-10"
                  title="Hide Chat"
                >
                  <span className="material-icons-round text-[18px]">delete_outline</span>
                </button>
              )}
            </div>
          )))}
      </div>
    </aside>
  );
};
