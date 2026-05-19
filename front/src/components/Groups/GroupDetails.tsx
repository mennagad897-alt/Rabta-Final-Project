import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const GroupDetails: React.FC = () => {
  const navigate = useNavigate();
  // id ده هنجيبه من اللينك عشان بعدين نكلم الباك-إند يجيب داتا الجروب ده بالذات
const { id } = useParams();
  console.log(id); // استخدامه هنا هيخلي الخطأ يختفي  
  return (
    <div className="flex w-full h-full bg-[#FAFAFA] dark:bg-[#171717]">
      
      {/* السايد بار (Group Details Sidebar) 
        حافظنا فيه على عرض 320px عشان الـ Layout ميبصش
      */}
      <aside className="w-[320px] bg-[#FAFAFA] dark:bg-[#171717] flex flex-col h-full border-r border-gray-200 dark:border-gray-800 shrink-0 overflow-y-auto hide-scrollbar">
        
        {/* Header: Back Button & Title */}
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-3 sticky top-0 bg-[#FAFAFA] dark:bg-[#171717] z-10">
          <button
            onClick={() => navigate('/groups')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-icons-round text-sm">arrow_back</span>
          </button>
          <h2 className="font-bold text-lg truncate">Group Details</h2>
        </div>

        {/* Group Info Profile */}
        <div className="p-6 flex flex-col items-center text-center border-b border-gray-200 dark:border-white/10">
          <div className="w-24 h-24 bg-[#7C3AED]/10 text-[#7C3AED] rounded-3xl flex items-center justify-center mb-4 shadow-inner border-2 border-[#7C3AED]/20">
            <span className="material-icons-round text-4xl">terminal</span>
          </div>
          <h3 className="text-xl font-black mb-1 text-[#171717] dark:text-white">React Ecosystem</h3>
          <p className="text-sm font-bold text-[#7C3AED] mb-3">Front-End Development</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            A community dedicated to the best patterns for State Management, Hooks, and everything related to React.js.
          </p>
        </div>

        {/* Stats & Info */}
        <div className="p-4 flex flex-col gap-3 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Members</span>
            <span className="font-bold text-[#171717] dark:text-white">1,204</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Privacy</span>
            <span className="font-bold text-[#171717] dark:text-white flex items-center gap-1">
              <span className="material-icons-round text-[14px]">public</span> Public
            </span>
          </div>
        </div>

        {/* Navigation Menu Inside Group */}
        <div className="p-3 flex flex-col gap-1 mt-2">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] font-bold transition-all">
            <span className="material-icons-round">forum</span>
            Group Chat
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium transition-all">
            <span className="material-icons-round text-gray-400">folder_open</span>
            Resources & Files
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 font-medium transition-all">
            <span className="material-icons-round text-gray-400">people</span>
            Members List
          </button>
        </div>

      </aside>

      {/* منطقة المحتوى (اليمين) - دي اللي منة هتحط فيها الشات 
        واخدة flex-1 عشان تفرد في باقي الشاشة
      */}
      <main className="flex-1 flex flex-col bg-white dark:bg-[#262626] relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <span className="material-icons-round text-6xl opacity-10 mb-4">forum</span>
          <p className="text-lg font-bold text-gray-300 dark:text-gray-600">Chat Area</p>
          <p className="text-sm mt-2 opacity-50">(Menna's Firebase Chat Component will go here)</p>
        </div>
      </main>
    </div>
  );
};

export default GroupDetails;