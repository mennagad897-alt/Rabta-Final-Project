import React, { useState, useEffect } from "react";
import type { ChatItem } from "./ChatsList";
import type { MessageType } from "./ChatWindow";
import axiosInstance from "../../api/axiosInstance";

interface GroupItem {
  _id: string;
  name: string;
  avatar?: string;
  isGroup: true;
  initials: string;
}

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageToForward: MessageType | null;
  chats: ChatItem[];
  groups?: GroupItem[];
  onForward: (chatId: string, message: MessageType) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  onClose,
  messageToForward,
  chats,
  groups: propsGroups,
  onForward,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<GroupItem[]>(propsGroups || []);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  useEffect(() => {
    if (isOpen && !propsGroups) {
      setIsLoadingGroups(true);
      axiosInstance.get('/groups/my-communities')
        .then(res => {
          const fetchedGroups = res.data.data.communities.map((g: any) => ({
            _id: g._id,
            name: g.name,
            avatar: g.avatar,
            isGroup: true,
            initials: g.name.substring(0, 2).toUpperCase()
          }));
          setGroups(fetchedGroups);
        })
        .catch(err => console.error('Failed to load groups:', err))
        .finally(() => setIsLoadingGroups(false));
    }
  }, [isOpen, propsGroups]);

  if (!isOpen || !messageToForward) return null;

  const allItems = [...chats, ...groups];
  
  const filteredItems = allItems.filter((item) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-white dark:bg-[#262626] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5]">
            Forward Message
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <span className="material-icons-round text-xl">close</span>
          </button>
        </div>

        {/* Message Preview */}
        <div className="p-4 bg-gray-50 dark:bg-[#171717] border-b border-gray-100 dark:border-gray-800">
          <div className="text-sm text-gray-500 mb-2 font-medium">
            Forwarding:
          </div>
          <div className="text-sm text-[#171717] dark:text-[#F5F5F5] line-clamp-2 italic border-l-2 border-[#7C3AED] pl-3">
            {messageToForward.type === "text" ? (
              messageToForward.content
            ) : messageToForward.type === "audio" ? (
              <span className="flex items-center gap-1">
                <span className="material-icons-round text-[11px]">mic</span>{" "}
                Voice message
              </span>
            ) : messageToForward.type === "call_summary" ? (
              <span className="flex items-center gap-1">
                <span className="material-icons-round text-[11px]">call</span>{" "}
                {messageToForward.content}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="material-icons-round text-[11px]">image</span>{" "}
                Media Message
              </span>
            )}{" "}
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              search
            </span>
            <input
              type="text"
              placeholder="Search contacts or groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl py-2 pl-10 pr-4 text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 transition-all text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="overflow-y-auto flex-1 p-2">
          {isLoadingGroups ? (
            <div className="p-8 text-center text-gray-500">
              <span className="material-icons-round animate-spin text-2xl">sync</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No chats or groups found.</div>
          ) : (
            <>
              {filteredItems.filter(item => !item.isGroup).length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Direct Chats
                  </div>
                  {filteredItems
                    .filter(item => !item.isGroup)
                    .map((chat: any) => (
                      <div
                        key={chat._id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer"
                        onClick={() => {
                          onForward(chat._id, messageToForward);
                          onClose();
                        }}
                      >
                        <div className="relative shrink-0">
                          {chat.avatar ? (
                            <img
                              src={chat.avatar}
                              alt={chat.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-[#7C3AED]/10 text-[#7C3AED]">
                              {chat.initials}
                            </div>
                          )}
                          {chat.isOnline && (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#262626] rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-[#171717] dark:text-[#F5F5F5] truncate">
                            {chat.name}
                          </h3>
                        </div>
                        <button className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 opacity-0 group-hover:opacity-100">
                          <span className="material-icons-round text-[16px]">send</span>
                          Send
                        </button>
                      </div>
                    ))}
                </>
              )}

              {filteredItems.filter(item => item.isGroup).length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mt-4">
                    Groups
                  </div>
                  {filteredItems
                    .filter(item => item.isGroup)
                    .map((group: any) => (
                      <div
                        key={group._id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer"
                        onClick={() => {
                          onForward(group._id, messageToForward);
                          onClose();
                        }}
                      >
                        <div className="relative shrink-0">
                          {group.avatar ? (
                            <img
                              src={group.avatar}
                              alt={group.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-orange-100 text-orange-600 dark:bg-orange-900/30">
                              {group.initials}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-[#171717] dark:text-[#F5F5F5] truncate">
                            {group.name}
                          </h3>
                        </div>
                        <button className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 opacity-0 group-hover:opacity-100">
                          <span className="material-icons-round text-[16px]">send</span>
                          Send
                        </button>
                      </div>
                    ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
