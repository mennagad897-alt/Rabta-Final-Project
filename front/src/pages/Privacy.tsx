import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosInstance from '../api/axiosInstance';

export const Privacy: React.FC = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [privacySettings, setPrivacySettings] = useState({
    showOnlineStatus: true,
  });

  // Fetch current settings on mount
  useEffect(() => {
    axiosInstance.get('/notifications/privacy/settings')
      .then(res => {
        setPrivacySettings({
          showOnlineStatus: res.data?.showOnlineStatus !== false,
        });
      })
      .catch(() => {
        toast.error('Failed to load privacy settings');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const toggleSetting = async (key: keyof typeof privacySettings) => {
    const newValue = !privacySettings[key];
    // Optimistic update
    setPrivacySettings(prev => ({ ...prev, [key]: newValue }));

    try {
      await axiosInstance.patch('/notifications/privacy/settings', { [key]: newValue });
      toast.success('Privacy setting updated');
    } catch {
      // Rollback on failure
      setPrivacySettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error('Failed to update privacy setting');
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

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
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
        )}

      </div>
    </main>
  );
};
