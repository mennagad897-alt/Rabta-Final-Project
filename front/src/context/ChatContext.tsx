import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, Socket } from "socket.io-client";

// 1. تعريف نوع البيانات اللي الـ Context هيشيلها
interface ChatContextType {
  socket: Socket | null;
  isConnected: boolean;
}

// 2. إنشاء الـ Context بقيم ابتدائية
const ChatContext = createContext<ChatContextType>({
  socket: null,
  isConnected: false,
});

// 3. Custom Hook عشان نستخدم الـ Socket بسهولة في أي صفحة
// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => {
  return useContext(ChatContext);
};

// 4. الـ Provider اللي هيغلف المشروع
export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // إنشاء الاتصال مع تمرير التوكن للمصادقة
    const token = localStorage.getItem("token");

    // Use the dedicated Socket URL from environment or extract from API URL
    const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

    const socketInstance = io(socketUrl, {
      autoConnect: true,
      auth: {
        token: token // This is required by the backend io.use() middleware
      }
    });

    socketInstance.on("connect_error", (err) => {
      console.error("🔴 Socket Connection Error:", err.message);
    });

    // 💡 الحل هنا: نقلنا التخزين جوه الـ Callback عشان نمنع الـ Cascading Renders
    socketInstance.on("connect", () => {
      console.log("🟢 Socket Connected:", socketInstance.id);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user?._id || user?.id;
      if (userId) {
        socketInstance.emit("registerUser", userId);
      }
      setSocket(socketInstance); // خزننا الـ Socket هنا بعد ما الاتصال تم بنجاح
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("🔴 Socket Disconnected");
      setIsConnected(false);
    });

    let isPlayingSound = false;

    socketInstance.on('notification', (data: {
      type: string;
      message: string;
      senderId: string;
      chatId: string
    }) => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentUserId = currentUser?._id || currentUser?.id;
      if (data.senderId?.toString() === currentUserId?.toString()) return;

      const token = localStorage.getItem('token');

      fetch('/api/notifications/settings', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(settings => {
          const allowed =
            (data.type === 'chat' && settings?.chatMessages !== false) ||
            (data.type === 'group' && settings?.communityMentions !== false);

          if (!allowed) return;

          // Browser Notification
          if (Notification.permission === 'granted') {
            new Notification('Rabta', {
              body: data.message,
              icon: '/logo.png'
            });
          }
          if (Notification.permission === 'default') {
            Notification.requestPermission();
          }

          // Play sound
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {
            const playOnInteraction = () => {
              audio.play().catch(() => { });
              document.removeEventListener('click', playOnInteraction);
            };
            document.addEventListener('click', playOnInteraction);
          });
        })
        .catch(() => {
          // fetch failed — show and play by default
          if (Notification.permission === 'granted') {
            new Notification('Rabta', { body: data.message, icon: '/logo.png' });
          }
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => { });
        });
    });

    // التنظيف لما اليوزر يقفل الموقع
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <ChatContext.Provider value={{ socket, isConnected }}>
      {children}
    </ChatContext.Provider>
  );
};