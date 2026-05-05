import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiAssistant } from '../shared/AiAssistant';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export interface ChatItem {
  _id: string;
  id?: string;
  name: string;
  receiverId?: string; // 💡 الطرف التاني في المحادثة (للمكالمات)
  lastMessage: string;
  time: string;
  avatar?: string;
  initials?: string;
  isOnline?: boolean;
  isGroup?: boolean;
  unreadCount?: number;
}

interface ChatsListProps {
  chats: ChatItem[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  isChatListOpen?: boolean;
  onClose?: () => void;
}

export const ChatsList: React.FC<ChatsListProps> = ({ chats, activeChatId, onSelectChat }) => {
  const navigate = useNavigate();

  return (
    <aside className="w-[320px] bg-[#FAFAFA] dark:bg-[#171717] flex flex-col h-full border-r border-gray-200 dark:border-gray-800 transition-colors duration-300 z-40 relative min-h-0 shrink-0">
      
      {/* الهيدر ومربع البحث */}
      <div className="p-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between text-[#171717] dark:text-[#F5F5F5]">
          <span className="text-xl font-bold tracking-tight">Rabta</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/chats/new-contact')}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400"
              title="New Contact"
            >
              <span className="material-icons">add</span>
            </button>
            <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
              <span className="material-icons">menu</span>
            </button>
          </div>
        </div>
        <div className="relative group">
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">search</span>
          <input
            className="w-full bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-800 rounded-lg py-2 pl-10 pr-4 text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#7C3AED]/50 transition-all text-sm focus:outline-none"
            placeholder="Search" type="text"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {/* ✅ Safe optional chaining - prevent crashes if chats is undefined/null */}
        {chats?.length ? (
          chats.map((chat) => (
            <div
              key={chat?._id}
              onClick={() => onSelectChat(chat?._id!)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                activeChatId === chat?._id 
                  ? 'bg-white dark:bg-[#262626] border-l-4 border-[#7C3AED]' // حالة لو الشات مفتوح
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800/50' // حالة لو الشات مش مفتوح
              }`}
            >
              <div className="relative shrink-0">
                {chat?.avatar ? (
                  <img className="w-12 h-12 rounded-full object-cover" src={chat?.avatar} alt={chat?.name} />
                ) : (
                  <div
                    className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${
                      chat?.isGroup
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
                        : 'bg-[#7C3AED]/10 text-[#7C3AED]'
                    }`}
                  >
                    {chat?.initials}
                  </div>
                )}
                {chat?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className={`text-[#171717] dark:text-[#F5F5F5] ${chat?.unreadCount ? 'font-bold' : 'font-semibold'} text-sm truncate`}>{chat?.name}</h3>
                  <span className={`${activeChatId === chat?._id ? 'text-[#7C3AED]' : 'text-gray-400'} text-xs font-medium`}>{chat?.time}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <p className={`text-xs truncate flex-1 pr-2 ${chat?.unreadCount ? 'text-[#171717] dark:text-white font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                    {chat?.lastMessage}
                  </p>
                  {Number(chat?.unreadCount) > 0 && (
                    <div className="min-w-[18px] h-[18px] bg-[#10B981] text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 shrink-0 shadow-sm">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <span className="material-icons-round text-4xl opacity-30">forum</span>
            <p className="text-sm">No chats yet</p>
          </div>
        )}
      </div>

      <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
        <AiAssistant 
          className="relative items-center! justify-center!" 
          placeholder="I can help you summarize your messages or find information..." 
        />
      </div>
    </aside>
  );
};
