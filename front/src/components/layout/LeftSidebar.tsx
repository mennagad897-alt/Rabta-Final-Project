import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useChat } from "../../context/ChatContext"; 
import type { RootState } from "../../store/store";

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const LeftSidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);
  
  // 1. استدعاء حالة الاتصال بالـ Socket من الـ Context
  const { isConnected } = useChat();

  // دالة لاستخراج الحروف الأولى من الاسم (مثلاً: John Doe -> JD)
  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const initials = user ? getInitials(user.fullName) : "??";
  const profileImage = user?.avatar || user?.profilePicture || user?.image; // حسب مسمى الصورة في الباك

  // قائمة الروابط الأساسية كما ظهرت في ملفاتكم
  const navItems: NavItem[] = [
    { path: "/chats", icon: "chat_bubble", label: "Chats" },
    { path: "/groups", icon: "groups", label: "Groups" },
    { path: "/bookmarks", icon: "bookmarks", label: "Saved" },
    { path: "/jobs", icon: "work_outline", label: "Jobs" },
    { path: "/calls", icon: "call", label: "Calls" },
  ];

  // دالة للتأكد لو المسار الحالي هو الأكتيف
  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    // 1. الكلاسات الأساسية للسايد بار
    <aside className="w-16 h-screen flex flex-col items-center py-6 bg-white dark:bg-[#171717] border-r border-gray-100 dark:border-white/5 shrink-0 transition-colors duration-300 z-20 overflow-y-auto hide-scrollbar">
      
      {/* 2. اللوجو الرئيسي (hub) + لمبة البيان */}
      <div className="mb-8 relative">
        <Link
          to="/chats"
          className="w-11 h-11 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 cursor-pointer hover:scale-105 transition-transform"
        >
          <span className="material-icons-round text-[26px]">hub</span>
        </Link>
        
        {/* لمبة بيان حالة الـ Socket (نقطة أعلى يمين اللوجو) */}
        <span
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-[#171717] transition-colors duration-300 ${
            isConnected ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500"
          }`}
          title={isConnected ? "Connected to Server" : "Disconnected"}
        ></span>
      </div>

      {/* 3. قائمة الـ Navigation الرئيسية */}
      <nav className="flex flex-col items-center gap-5 w-full">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            title={item.label}
            className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${
              isActive(item.path)
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                : "text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/10"
            }`}
          >
            <span className="material-icons-round text-[24px]">
              {item.icon}
            </span>
          </Link>
        ))}
      </nav>

      {/* 4. الجزء السفلي (الاعدادات والبروفايل) */}
      <div className="flex flex-col items-center gap-6 mt-auto pb-4">
        {/* رابط الإعدادات - زرار الـ Dark Mode هيكون جوا صفحة الـ Settings نفسها */}
        <Link
          to="/settings"
          title="Settings"
          className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${
            isActive("/settings")
              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
              : "text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/10"
          }`}
        >
          <span className="material-icons-round text-[24px]">settings</span>
        </Link>

        {/* البروفايل الشخصي */}
        <Link to="/profile">
          <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-[12px] font-bold ring-2 ring-purple-200 dark:ring-purple-900 ring-offset-2 ring-offset-white dark:ring-offset-[#171717] cursor-pointer hover:ring-purple-400 transition-all overflow-hidden">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </Link>
      </div>
    </aside>
  );
};

export default LeftSidebar;