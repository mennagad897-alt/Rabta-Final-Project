import React, { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export type SharedCategory = 'media' | 'docs' | 'photos';

type PublicUser = {
  _id?: string;
  fullName?: string;
  avatar?: string;
  status?: string;
  about?: string;
  bioHeadline?: string;
  jobTitle?: string;
  location?: string;
  role?: string;
  showOnlineStatus?: boolean;
};

type SharedItem = {
  id: string;
  url: string;
  fileName?: string;
  messageType: string;
  createdAt: string;
};

function mediaBaseOrigin(): string {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
}

export function resolveChatMediaUrl(path?: string): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = mediaBaseOrigin();
  if (!origin) return path;
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

interface ProfileSidePanelProps {
  chatId: string;
  profileUserId: string;
  onClose: () => void;
}

export const ProfileSidePanel: React.FC<ProfileSidePanelProps> = ({
  chatId,
  profileUserId,
  onClose
}) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeShared, setActiveShared] = useState<SharedCategory | null>(null);
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingUser(true);
    setUser(null);
    (async () => {
      try {
        const res = await axiosInstance.get(`/users/${profileUserId}`);
        const u = res.data?.data?.user as PublicUser | undefined;
        if (!cancelled) setUser(u || null);
      } catch {
        if (!cancelled) {
          setUser(null);
          toast.error('Could not load profile.');
        }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileUserId]);

  useEffect(() => {
    setActiveShared(null);
    setSharedItems([]);
  }, [chatId, profileUserId]);

  const fetchShared = useCallback(
    async (category: SharedCategory) => {
      setLoadingShared(true);
      setSharedItems([]);
      setActiveShared(category);
      try {
        const res = await axiosInstance.get(`/chats/${chatId}/shared`, {
          params: { category }
        });
        const items = (res.data?.data?.items || []) as SharedItem[];
        setSharedItems(Array.isArray(items) ? items : []);
      } catch {
        toast.error('Could not load shared files.');
        setSharedItems([]);
      } finally {
        setLoadingShared(false);
      }
    },
    [chatId]
  );

  const displayName = user?.fullName || 'Contact';
  const headline = user?.bioHeadline || user?.jobTitle || user?.role || '';
  const bioText = user?.about || '';
  const avatarSrc = resolveChatMediaUrl(user?.avatar);
  const statusLabel = user?.status === 'online' ? 'Online' : user?.status === 'busy' ? 'Busy' : 'Offline';
  const showStatusDot = user?.status === 'online' && user?.showOnlineStatus !== false;

  return (
    <aside className="w-85 min-w-[19rem] max-w-[22rem] bg-white dark:bg-[#262626] border-l border-gray-200 dark:border-gray-800 flex flex-col h-full shrink-0 shadow-xl z-20 animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-[#171717] dark:text-[#F5F5F5] text-base">Contact</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          aria-label="Close profile panel"
        >
          <span className="material-icons text-[22px]">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-6">
        {loadingUser ? (
          <div className="flex flex-col items-center py-10 gap-3 text-gray-500">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#7C3AED] border-t-transparent" />
            <span className="text-sm">Loading profile…</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-[#262626] shadow-md"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#7C3AED]/15 text-[#7C3AED] flex items-center justify-center text-3xl font-bold border-4 border-white dark:border-[#262626]">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {showStatusDot && (
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-4 border-white dark:border-[#262626] rounded-full" />
                )}
              </div>
              <h3 className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5]">{displayName}</h3>
              {headline ? (
                <p className="text-sm text-[#7C3AED] dark:text-[#8B5CF6] font-semibold mt-0.5">{headline}</p>
              ) : null}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{statusLabel}</p>
              {bioText ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed text-left w-full">
                  {bioText}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Shared in this chat</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: 'media' as const, label: 'Media', icon: 'perm_media' },
                    { key: 'docs' as const, label: 'Docs', icon: 'description' },
                    { key: 'photos' as const, label: 'Photos', icon: 'photo_library' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => fetchShared(tab.key)}
                    className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border text-xs font-semibold transition-all ${
                      activeShared === tab.key
                        ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#7C3AED]/40'
                    }`}
                  >
                    <span className="material-icons-round text-[22px]">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeShared && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[#171717] dark:text-[#F5F5F5] capitalize">
                    {activeShared}
                  </span>
                  {loadingShared ? (
                    <span className="text-xs text-gray-400">Loading…</span>
                  ) : (
                    <span className="text-xs text-gray-400">{sharedItems.length} items</span>
                  )}
                </div>
                {!loadingShared && sharedItems.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">Nothing here yet.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
                    {sharedItems.map((item) => {
                      const href = resolveChatMediaUrl(item.url);
                      const isImg = activeShared === 'photos' || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(href);
                      return (
                        <li key={item.id} className="relative group">
                          {isImg ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                              <img src={href} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                            </a>
                          ) : (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col gap-1 p-2 rounded-lg bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-700 hover:border-[#7C3AED]/50 text-xs break-all"
                            >
                              <span className="material-icons-round text-[#7C3AED] text-lg">
                                {activeShared === 'media' ? 'graphic_eq' : 'insert_drive_file'}
                              </span>
                              <span className="line-clamp-2 text-[#171717] dark:text-[#F5F5F5]">
                                {item.fileName || href.split('/').pop() || 'File'}
                              </span>
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
