import React from 'react';

// بنستقبل دالة (onNewMessage) عشان لما ندوس على الزرار يفتح الـ Modal في الصفحة الرئيسية
export const EmptyChatState = ({ onNewMessage }: { onNewMessage: () => void }) => {
  return (
    <main className="flex-1 flex flex-col bg-[#FAFAFA] dark:bg-[#171717] transition-colors duration-300 min-h-0 min-w-0 items-center justify-center relative">
      <div className="flex flex-col items-center justify-center text-center p-8 max-w-md opacity-80">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-inner transition-colors">
          <span className="material-icons-round text-6xl text-gray-400 dark:text-gray-500">chat</span>
        </div>
        <h2 className="text-2xl font-bold text-[#171717] dark:text-[#F5F5F5] mb-3">Your Messages</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          Select a chat from the list to start messaging, or start a new conversation.
        </p>
        <button 
          onClick={onNewMessage}
          className="px-6 py-2.5 bg-[#7C3AED] dark:bg-[#8B5CF6] text-white rounded-xl font-medium shadow-md hover:opacity-90 transition-all flex items-center gap-2"
        >
          <span className="material-icons-round text-sm">edit</span>
          New Message
        </button>
      </div>
    </main>
  );
};