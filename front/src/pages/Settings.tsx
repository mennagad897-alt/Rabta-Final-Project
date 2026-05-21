import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { logout } from "../store/slices/authSlice";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

interface SettingsState {
  notifications: {
    chatMessages: boolean;
    communityMentions: boolean;
    aiJobMatches: boolean;
    inAppSounds: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    showJobTitle: boolean;
    publicProfile: boolean;
  };
  [key: string]: Record<string, boolean>;
}

export const Settings = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const getInitials = (name?: string) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const [settings, setSettings] = useState<SettingsState>(user?.settings || {
    notifications: {
      chatMessages: true,
      communityMentions: true,
      aiJobMatches: true,
      inAppSounds: true
    },
    privacy: {
      showOnlineStatus: true,
      showJobTitle: true,
      publicProfile: true
    }
  });

  const toggleTheme = () => {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    toast.success(`Switched to ${isDark ? 'Dark' : 'Light'} Mode`);
  };

  const handleToggle = (section: string, field: string) => {
    setSettings((prev: SettingsState) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: !prev[section][field]
      }
    }));
    toast.success("Preference updated");
  };

  const handleLogout = () => {
    dispatch(logout());
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col relative bg-[#FAFAFA] dark:bg-[#171717] overflow-y-auto transition-colors duration-300">

      <div className="max-w-2xl mx-auto w-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">

        <h1 className="text-2xl font-bold mb-6 px-2 text-[#171717] dark:text-[#F5F5F5]">Settings</h1>

        <div className="flex flex-col gap-6 w-full">

          {/* Profile Section */}
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-4 p-4 bg-white dark:bg-[#262626] rounded-2xl border border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors shadow-sm w-full"
          >
            <div className="relative shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  className="w-16 h-16 rounded-full border-2 border-[#7C3AED] dark:border-[#8B5CF6] p-0.5 object-cover"
                  alt="Profile"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-[#7C3AED] dark:border-[#8B5CF6] p-0.5 flex items-center justify-center bg-[#FAFAFA] dark:bg-[#171717] text-[#7C3AED] dark:text-[#8B5CF6] font-bold text-xl tracking-wider">
                  {getInitials(user?.fullName)}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5] truncate">{user?.fullName || "Guest User"}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize truncate">
                {user?.jobTitle && user?.location
                  ? `${user.jobTitle} • ${user.location}`
                  : user?.jobTitle || user?.location || ""}
              </p>
            </div>
            <span className="text-gray-400">
              <span className="material-icons-round">chevron_right</span>
            </span>
          </div>

          {/* Account Section */}
          <div className="bg-white dark:bg-[#262626] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 px-4 py-3 uppercase text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400">
              Account
            </div>

            <div
              className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/2 cursor-pointer transition-colors"
              onClick={() => navigate('/privacy')}
            >
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                <span className="material-icons-round">lock</span>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Privacy</h4>
                <p className="text-xs text-gray-400">Last seen, Profile visibility</p>
              </div>
              <span className="text-gray-400">
                <span className="material-icons-round">chevron_right</span>
              </span>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white dark:bg-[#262626] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 px-4 py-3 uppercase text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400">
              Preferences
            </div>

            <div
              className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/2 cursor-pointer transition-colors border-b border-gray-50 dark:border-white/5"
              onClick={toggleTheme}
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-indigo-900/30 flex items-center justify-center text-orange-500 dark:text-indigo-400 transition-colors">
                <span className="material-icons-round text-[24px] block dark:hidden">light_mode</span>
                <span className="material-icons-round text-[24px] hidden dark:block">dark_mode</span>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Appearance</h4>
                <p className="text-xs text-gray-400">Dark mode, Light mode</p>
              </div>
              <div className="w-10 h-5 bg-gray-200 dark:bg-[#8B5CF6] rounded-full relative transition-all">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 dark:translate-x-5"></div>
              </div>
            </div>

            <div
              className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/2 cursor-pointer transition-colors border-b border-gray-50 dark:border-white/5"
              onClick={() => navigate('/notifications')}
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <span className="material-icons-round">notifications</span>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Notifications</h4>
                <p className="text-xs text-gray-400">Messages, Groups, Job Alerts</p>
              </div>
              <span className="text-gray-400">
                <span className="material-icons-round">chevron_right</span>
              </span>
            </div>


          </div>

          {/* Logout Button */}
          <div
            className="flex items-center gap-4 p-4 mt-2 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors shadow-sm w-full"
            onClick={handleLogout}
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
              <span className="material-icons-round">logout</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Log Out</h4>
              <p className="text-xs text-red-500/80 dark:text-red-400/70">Sign out of your account securely</p>
            </div>
          </div>

          {/* App version */}
          <p className="text-xs text-gray-500 text-center w-full pb-8 pt-4">
            Rabta for ITI Community • Version 1.0.0
          </p>

        </div>
      </div>
    </div>
  );
};
