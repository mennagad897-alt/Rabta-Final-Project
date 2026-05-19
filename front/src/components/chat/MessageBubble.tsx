// src/components/chat/MessageBubble.tsx
import React from 'react';

interface MessageBubbleProps {
  content: string;
  time: string;
  isMine: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ content, time, isMine }) => {
  return (
    <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-[70%] flex flex-col relative group ${
          isMine 
            ? 'items-end' 
            : 'items-start'
        }`}
      >
        {/* فقاعة الرسالة */}
        <div 
          className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
            isMine 
              ? 'bg-[#7C3AED] text-white rounded-2xl rounded-tr-sm' // ستايل رسالتي
              : 'bg-white dark:bg-[#262626] text-[#171717] dark:text-[#F5F5F5] border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm' // ستايل رسالة الطرف التاني
          }`}
        >
          {content}
        </div>
        
        {/* الوقت وحالة القراءة */}
        <div className="flex items-center gap-1 mt-1 px-1">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
            {time}
          </span>
          {isMine && (
            <span className="material-icons-round text-[14px] text-[#7C3AED] dark:text-[#8B5CF6]">
              done_all
            </span>
          )}
        </div>
      </div>
    </div>
  );
};