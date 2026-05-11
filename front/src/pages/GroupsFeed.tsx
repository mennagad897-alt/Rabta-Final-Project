import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { AiAssistant } from '../components/shared/AiAssistant';
import { ChatWindow } from '../components/chat/ChatWindow';

interface Community {
  _id: string;
  name: string;
  description: string;
  avatar?: string;
  tags: string[];
  members: string[] | any[];
  chatId?: any;
  unreadCount?: number;
}

export const GroupsFeed = () => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = currentUser._id;
  
  const [activeFilter, setActiveFilter] = useState("All");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isSideBarOpen, setIsSideBarOpen] = useState(true);
  const navigate = useNavigate();

  // Derived: only allow collapsing when a group is actually selected
  const isChatSelected = !!activeGroupId;

  // If no chat is selected, always force the sidebar open so the user
  // can't end up staring at an empty screen with no list visible.
  useEffect(() => {
    if (!isChatSelected) setIsSideBarOpen(true);
  }, [isChatSelected]);
  
  const filters = ["All", "Programming", "UI/UX", "Data", "Cyber", "Cloud"];

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        setIsLoading(true);
        const category = activeFilter === "All" ? "" : activeFilter.toLowerCase();
        const response = await axiosInstance.get(`/groups?category=${category}`);
        setCommunities(response.data.data.communities);
      } catch (error) {
        toast.error("Failed to load communities");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCommunities();
  }, [activeFilter]);

  return (
    <div className="flex w-full h-full bg-[#FAFAFA] dark:bg-[#171717]">
      {/* عمود المجتمعات (Communities List) */}
      <aside className={`flex flex-col h-full bg-[#FAFAFA] dark:bg-[#171717] transition-all duration-300 ease-in-out z-40 relative min-h-0 shrink-0 ${
        isSideBarOpen
          ? 'w-80 md:w-96 opacity-100 border-r border-gray-200 dark:border-gray-800'
          : 'w-0 opacity-0 overflow-hidden border-none px-0 mx-0'
      }`}>
        <div className="p-4 flex flex-col gap-4 shrink-0">
          
          <div className="flex items-center justify-between text-[#171717] dark:text-[#F5F5F5]">
            <span className="text-xl font-bold tracking-tight">
              Groups
            </span>
            {/* Hamburger close button — only visible when a chat is selected */}
            {isChatSelected ? (
              <button
                onClick={() => setIsSideBarOpen(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400"
                title="Collapse group list"
              >
                <span className="material-icons">menu</span>
              </button>
            ) : (
              <button 
                onClick={() => navigate('/create-group')}
                className="flex items-center justify-center gap-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
                title="Create New Group"
              >
                <span className="material-icons-round text-sm">add</span>
                Create
              </button>
            )}
          </div>

          <div className="relative group">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
              search
            </span>
            <input
              className="w-full bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-800 rounded-lg py-2 pl-10 pr-4 text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 transition-all text-sm"
              placeholder="Search groups"
              type="text"
            />
          </div>

          {/* الفلاتر */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shadow-sm ${
                  activeFilter === filter
                    ? "bg-[#7C3AED] text-white shadow-[#7C3AED]/20"
                    : "bg-white dark:bg-[#262626] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-[#7C3AED]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* قائمة الجروبات */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <span className="material-icons-round animate-spin text-[#7C3AED]">sync</span>
            </div>
          ) : communities.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No groups found in this category.
            </div>
          ) : (
            communities.map((community) => (
              <div 
                key={community._id}
                onClick={() => {
                  setActiveGroupId(community._id);
                  // Mark as read locally
                  setCommunities(prev => prev.map(c => c._id === community._id ? { ...c, unreadCount: 0 } : c));
                }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 ${
                  activeGroupId === community._id 
                    ? "bg-gray-100 dark:bg-gray-800/80 border-l-4 border-l-[#7C3AED]" 
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center text-[#7C3AED] shrink-0 overflow-hidden">
                  {community.avatar ? (
                    <img src={community.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-icons-round">groups</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className={`text-sm truncate ${community.unreadCount ? 'font-bold text-[#171717] dark:text-[#F5F5F5]' : 'font-semibold text-[#171717] dark:text-[#F5F5F5]'}`}>
                      {community.name}
                    </h3>
                  </div>
                  <p className={`text-xs truncate ${community.unreadCount ? 'font-bold text-[#171717] dark:text-[#F5F5F5]' : 'text-gray-500 dark:text-gray-400'}`}>
                    {community.chatId?.latestMessage ? `${community.chatId.latestMessage.senderId?.fullName?.split(' ')[0]}: ${community.chatId.latestMessage.content}` : community.description}
                  </p>
                </div>
                {!!community.unreadCount && (
                  <div className="w-5 h-5 bg-[#10B981] text-white text-[10px] font-bold flex items-center justify-center rounded-full shrink-0">
                    {community.unreadCount}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* AI Assistant - Positioned at bottom of sidebar */}
        <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
          <AiAssistant 
            className="relative !items-center !justify-center" 
            placeholder="I can help you find interesting communities or summarize group discussions..." 
          />
        </div>
      </aside>

      {activeGroupId && communities.find(c => c._id === activeGroupId) ? (
        (() => {
          const activeCommunity = communities.find(c => c._id === activeGroupId);
          // Handle both string IDs and populated objects in members array
          const isMember = activeCommunity?.members?.some((m: any) => 
            (typeof m === 'string' ? m : m._id) === currentUserId
          );

          if (!isMember) {
            return (
              <main className="flex-1 flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#171717] p-8">
                <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 max-w-md w-full text-center">
                  <div className="w-20 h-20 bg-[#7C3AED]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#7C3AED]">
                    <span className="material-icons-round text-4xl">groups</span>
                  </div>
                  <h2 className="text-2xl font-bold text-[#171717] dark:text-[#F5F5F5] mb-2">{activeCommunity?.name}</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">{activeCommunity?.description}</p>
                  
                  <div className="flex items-center justify-center gap-2 mb-8 text-sm text-gray-400">
                    <span className="material-icons-round text-[18px]">group</span>
                    <span>{activeCommunity?.members?.length || 0} members</span>
                  </div>

                  <button 
                    onClick={async () => {
                      try {
                        await axiosInstance.post(`/groups/${activeGroupId}/join`);
                        toast.success(`Joined ${activeCommunity?.name}!`);
                        // Refresh communities to reflect membership
                        const response = await axiosInstance.get('/groups');
                        setCommunities(response.data.data.communities);
                      } catch (err) {
                        toast.error("Failed to join group");
                      }
                    }}
                    className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    Join Group
                  </button>
                </div>
              </main>
            );
          }

          return (
            <ChatWindow 
              chatId={activeCommunity?.chatId?._id || activeCommunity?.chatId || activeGroupId}
              chatName={activeCommunity?.name || "Group Chat"} 
              isOnline={true} 
              isGroup={true}
              messages={[]} 
              groupMembers={activeCommunity?.members?.map((m: any) => m.fullName || '')}
              isChatListOpen={isSideBarOpen}
              onOpenChatList={() => setIsSideBarOpen(true)}
            />
          );
        })()
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-[#FAFAFA] dark:bg-[#171717]">
          <span className="material-icons-round text-6xl opacity-10">groups</span>
          <p className="text-sm mt-4 font-medium">
            Select a group to see the feed
          </p>
        </main>
      )}
    </div>
  );
};