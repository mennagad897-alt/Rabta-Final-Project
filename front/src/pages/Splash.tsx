import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

// تعريف الـ User والـ State عشان الـ useSelector يكون دقيق
interface User {
  id: string;
  fullName: string;
  role: string;
}

interface RootState {
  auth: {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
  };
}

export const Splash = () => {
  const navigate = useNavigate();
  // تحديد النوع هنا بيخلي التايب سكريبت والـ ESLint في قمة السعادة
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        navigate("/chats");
      } else {
        navigate("/login");
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [navigate, isAuthenticated]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center overflow-hidden bg-[#FAFAFA] dark:bg-[#171717] transition-colors duration-500 relative font-sans">
      {/* الدوائر الملونة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 rounded-full blur-[100px] animate-pulse"></div>
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      <div className="flex flex-col items-center z-10 relative">
        {/* اللوجو */}
        <div className="relative animate-scale-in mb-8">
          <div className="absolute inset-0 bg-[#7C3AED] dark:bg-[#8B5CF6] blur-2xl opacity-40 rounded-4xl"></div>
          <div className="relative w-28 h-28 bg-linear-to-tr from-[#7C3AED] to-[#9F67FF] dark:from-[#8B5CF6] dark:to-[#A78BFA] rounded-4xl flex items-center justify-center text-white shadow-2xl animate-float border border-white/20">
            <span className="material-icons-round text-[60px]">hub</span>
          </div>
        </div>

        <h1 className="text-5xl font-black text-[#171717] dark:text-[#F5F5F5] tracking-tight mb-3 animate-fade-in-up">
          Rabta
        </h1>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500 animate-fade-in-up mb-14">
          Tech Community Hub
        </p>

        <div className="flex flex-col items-center w-full animate-fade-in-up">
          <div className="w-48 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute top-0 bottom-0 w-1/2 bg-[#7C3AED] dark:bg-[#8B5CF6] rounded-full animate-loading"></div>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-4 font-medium animate-pulse">
            Syncing with ITI network...
          </p>
        </div>
      </div>

      <div className="absolute bottom-8 text-center animate-fade-in-up z-10">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
          Version 1.0.0
        </p>
      </div>
    </div>
  );
};