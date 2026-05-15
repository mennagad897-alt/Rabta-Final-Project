import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { updateProfile } from '../store/slices/authSlice';
import type { RootState } from '../store/store';
import axiosInstance from '../api/axiosInstance';

export const Privacy: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: user?.showOnlineStatus !== false,
    allowDirectMessages: false
  });

  const toggleSetting = async (key: keyof typeof privacySettings) => {
    const newValue = !privacySettings[key];
    setPrivacySettings(prev => ({ ...prev, [key]: newValue }));
    
    if (key === 'showOnlineStatus') {
      try {
        await axiosInstance.patch('/profile/me', { showOnlineStatus: newValue });
        dispatch(updateProfile({ showOnlineStatus: newValue }));
        toast.success("Privacy setting updated");
      } catch (error) {
        toast.error("Failed to update privacy setting");
        setPrivacySettings(prev => ({ ...prev, [key]: !newValue }));
      }
    } else {
      toast.success("Privacy setting updated");
    }
  };

  return (
    <main className="flex-1 flex flex-col relative bg-[#FAFAFA] dark:bg-[#171717] overflow-y-auto custom-scrollbar transition-all duration-300">
      <div className="max-w-2xl mx-auto w-full p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500 dark:text-white/70"
          >
            <span className="material-icons-round">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold text-[#171717] dark:text-[#F5F5F5]">Privacy</h1>
        </div>

        <div className="bg-white dark:bg-[#262626] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-50 dark:border-white/5 opacity-60 text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-white/60">
            Profile Visibility
          </div>
          
          {/* Show Online Status */}
          <div 
            className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
            onClick={() => toggleSetting('showOnlineStatus')}
          >
            <div className="flex-1 pr-4">
              <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Show Online Status</h4>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-1">Let connections see when you are active on Rabta.</p>
            </div>
            <div className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${privacySettings.showOnlineStatus ? 'bg-[#7C3AED] dark:bg-[#8B5CF6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${privacySettings.showOnlineStatus ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
};
