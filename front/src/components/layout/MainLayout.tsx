// src/components/layout/MainLayout.tsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import LeftSidebar from "./LeftSidebar";
import { CallProvider } from "../../context/CallContext";
import { GlobalAiAssistant } from "../shared/GlobalAiAssistant.tsx";
import { IncomingCallModal } from "../call/IncomingCallModal";
import { OutgoingCallModal } from "../call/OutgoingCallModal";
import { VideoCallRoom } from "../call/VideoCallRoom";

// TODO (Aya): If we add a Mobile view with open/close toggle, the toggle state will be managed in Redux here
// خطة: اعمل uiSlice فيه sidebarOpen state، واستخدمه بـ useSelector للتحكم في عرض الـ sidebar على الـ mobile
export const MainLayout = () => {
  const [showNotifBanner, setShowNotifBanner] = React.useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  React.useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotifBanner(true);
    }

    const handleOpenGlobalAi = () => {
      setIsAiOpen(true);
    };
    window.addEventListener('open-global-ai', handleOpenGlobalAi);
    return () => {
      window.removeEventListener('open-global-ai', handleOpenGlobalAi);
    };
  }, []);

  const requestNotificationPermission = () => {
    Notification.requestPermission().then(perm => {
      console.log('Notifications:', perm);
      setShowNotifBanner(false);
    });
  };

  return (
    <CallProvider>
      <div className="bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] font-display h-screen flex flex-col overflow-hidden transition-colors duration-300">

        {showNotifBanner && (
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-md z-50">
            <span className="text-sm font-medium">Please enable notifications to ring on incoming calls in the background.</span>
            <button onClick={requestNotificationPermission} className="px-4 py-1 bg-white text-blue-600 rounded-md text-xs font-bold hover:bg-gray-100 transition">
              Enable Call Notifications
            </button>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* 1. العمود الأول: السايد بار (ثابت) */}
          <LeftSidebar isAiOpen={isAiOpen} onToggleAi={() => setIsAiOpen(!isAiOpen)} />

          {/* 2. باقي الشاشة: هنا هيتعرض محتوى الصفحات (زي الـ Chats List ومربع المحادثة) */}
          <main className="flex-1 overflow-y-auto relative min-h-0 min-w-0 transition-colors duration-300">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Global AI Assistant Floating Window */}
      {isAiOpen && <GlobalAiAssistant onClose={() => setIsAiOpen(false)} />}

      {/* Global Call UI Components */}
      <IncomingCallModal />
      <OutgoingCallModal />
      <VideoCallRoom />
    </CallProvider>
  );
};

