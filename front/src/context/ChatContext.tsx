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
    
    // Extract the base domain from the API URL (e.g. "http://localhost:5000/api/v1" -> "http://localhost:5000")
    const apiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const socketUrl = apiUrl.split('/api')[0];

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
      setSocket(socketInstance); // خزننا الـ Socket هنا بعد ما الاتصال تم بنجاح
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("🔴 Socket Disconnected");
      setIsConnected(false);
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