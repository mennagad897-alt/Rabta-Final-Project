import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import toast from 'react-hot-toast';



type SettingsKey = 'chatMessages' | 'communityMentions' | 'aiJobMatches' | 'inAppSounds';

interface NotificationSettings {
  chatMessages: boolean;
  communityMentions: boolean;
  aiJobMatches: boolean;
  inAppSounds: boolean;
}

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);

  const [loading, setLoading] = React.useState(true);
  const [settings, setSettings] = React.useState<NotificationSettings>({
    chatMessages: true,
    communityMentions: true,
    aiJobMatches: true,
    inAppSounds: false,
  });

  // ── Fetch settings on mount ──────────────────────────────────────────────
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/notifications/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (data?.data?.notificationSettings) {
          setSettings(data.data.notificationSettings);
        }
      } catch {
        toast.error('Could not load notification settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [token]);

  // ── Toggle with optimistic update + rollback on failure ──────────────────
  const toggleSetting = async (key: SettingsKey) => {
    const previous = settings[key];
    const next = !previous;

    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: next }));

    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Preference updated');
    } catch {
      // Revert on failure
      setSettings(prev => ({ ...prev, [key]: previous }));
      toast.error('Failed to update preference.');
    }
  };

  // ── Loading spinner (shown only during initial fetch) ────────────────────
  if (loading) {
    return (
      <main className="flex-1 flex flex-col relative bg-[#FAFAFA] dark:bg-[#171717] overflow-y-auto custom-scrollbar transition-all duration-300">
        <div className="flex items-center justify-center h-full min-h-[300px]">
          <div className="w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

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
          <h1 className="text-2xl font-bold text-[#171717] dark:text-[#F5F5F5]">Notifications</h1>
        </div>

        <div className="bg-white dark:bg-[#262626] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-50 dark:border-white/5 opacity-60 text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-white/60">
            Push Alerts
          </div>
          
          <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => toggleSetting('chatMessages')}>
            <div className="flex-1 pr-4">
              <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Chat Messages</h4>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-1">Get notified for new personal messages.</p>
            </div>
            <div className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.chatMessages ? 'bg-[#7C3AED] dark:bg-[#8B5CF6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.chatMessages ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </div>
          </div>

          <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => toggleSetting('communityMentions')}>
            <div className="flex-1 pr-4">
              <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">Community Mentions</h4>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-1">Notify me when someone tags me in a group.</p>
            </div>
            <div className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.communityMentions ? 'bg-[#7C3AED] dark:bg-[#8B5CF6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.communityMentions ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </div>
          </div>

          {/* <div className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => toggleSetting('aiJobMatches')}>
            <div className="flex-1 pr-4">
              <h4 className="text-[#7C3AED] dark:text-[#8B5CF6] text-sm font-semibold flex items-center gap-2">
                <span className="material-icons-round text-sm">bolt</span>
                AI Job Matches
              </h4>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-1">Let Rabta AI notify you about jobs matching your ITI track.</p>
            </div>
            <div className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.aiJobMatches ? 'bg-[#7C3AED] dark:bg-[#8B5CF6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.aiJobMatches ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </div>
          </div>
         </div> */}
        </div>

        {/* <div className="bg-white dark:bg-[#262626] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
           <div className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => toggleSetting('inAppSounds')}>
            <div className="flex-1 pr-4">
              <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">In-App Sounds</h4>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-1">Play sounds for incoming messages.</p>
            </div>
            <div className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${settings.inAppSounds ? 'bg-[#7C3AED] dark:bg-[#8B5CF6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${settings.inAppSounds ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </div>
          </div>
        </div> */}

      </div>
    </main>
  );
};