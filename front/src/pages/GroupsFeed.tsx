import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { ChatWindow, type MessageType, formatFileSize, extractFileName } from '../components/chat/ChatWindow';
import { SharedMediaSidePanel } from '../components/chat/SharedMediaSidePanel';
import { GroupDetails } from '../components/chat/GroupDetails';
import { useChat } from '../context/ChatContext';

interface JoinRequest {
  _id?: string;
  userId: string | { _id?: string; fullName?: string; avatar?: string };
  status?: "pending" | "accepted" | "rejected";
  requestedAt?: string;
}

interface Community {
  _id: string;
  name: string;
  description: string;
  avatar?: string;
  tags: string[];
  members: string[] | any[];
  admins?: string[];
  owner?: string | { _id?: string };
  isPublic?: boolean;
  joinRequests?: JoinRequest[];
  invitedUsers?: string[] | { _id?: string }[];
  chatId?: any;
  unreadCount?: number;
  isInvited?: boolean;
}

interface MessageSender {
  _id?: string;
  fullName?: string;
  name?: string;
}

interface NewCommunityMessagePayload {
  communityId: string;
  lastMessage: {
    _id: string;
    content: string;
    messageType: string;
  };
  timestamp: string;
  senderId: string | MessageSender;
  sender?: MessageSender;
}

const resolveMessageSenderId = (
  senderId: string | MessageSender | undefined,
): string | undefined => {
  if (!senderId) return undefined;
  if (typeof senderId === "string") return senderId;
  return senderId._id;
};

const getLatestMessageSenderName = (
  senderId: string | MessageSender | undefined,
  isMine: boolean,
): string => {
  if (isMine) return "You";
  if (!senderId || typeof senderId === "string") return "Member";
  const fullName = senderId.fullName || senderId.name;
  return fullName?.split(" ")[0] || "Member";
};

const resolveCommunityChatId = (community: Community): string | null => {
  const chatId = community.chatId;
  if (!chatId) return null;
  if (typeof chatId === 'string') return chatId;
  return chatId._id ?? null;
};

const getCommunitySortTime = (community: Community): number => {
  const latest = community.chatId?.latestMessage?.createdAt;
  const updated = community.chatId?.updatedAt;
  const raw = latest || updated;
  return raw ? new Date(raw).getTime() : 0;
};

const sortCommunitiesByRecent = (list: Community[]): Community[] =>
  [...list].sort((a, b) => getCommunitySortTime(b) - getCommunitySortTime(a));

const isCommunityMember = (
  community: Community,
  userId: string | undefined,
): boolean => {
  if (!userId) return false;
  return (community.members ?? []).some((m: string | { _id?: string }) => {
    const memberId = typeof m === 'string' ? m : m?._id;
    return memberId != null && String(memberId) === String(userId);
  });
};

const isCommunityAdmin = (
  community: Community,
  userId: string | undefined,
): boolean => {
  if (!userId) return false;
  const ownerId =
    typeof community.owner === "string"
      ? community.owner
      : community.owner?._id;
  if (ownerId && String(ownerId) === String(userId)) return true;
  return (community.admins ?? []).some((a: string | { _id?: string }) => {
    const adminId = typeof a === "string" ? a : a?._id;
    return adminId != null && String(adminId) === String(userId);
  });
};

const isCommunityInvited = (
  community: Community,
  userId: string | undefined,
): boolean => {
  if (!userId) return false;
  if (community.isInvited) return true;
  return (community.invitedUsers ?? []).some((u: string | { _id?: string }) => {
    const id = typeof u === "string" ? u : u?._id;
    return id != null && String(id) === String(userId);
  });
};

const hasPendingJoinRequest = (
  community: Community,
  userId: string | undefined,
): boolean => {
  if (!userId) return false;
  return (community.joinRequests ?? []).some((r) => {
    const requestUserId =
      typeof r.userId === "string" ? r.userId : r.userId?._id;
    return (
      requestUserId != null &&
      String(requestUserId) === String(userId) &&
      (r.status === "pending" || !r.status)
    );
  });
};

const mergeCommunityIntoList = (
  prev: Community[],
  community: Community,
): Community[] => {
  const exists = prev.some((c) => c._id === community._id);
  if (exists) {
    return prev.map((c) =>
      c._id === community._id ? { ...c, ...community } : c,
    );
  }
  return sortCommunitiesByRecent([...prev, community]);
};

const mergeCommunitiesLists = (prev: Community[], loaded: Community[]): Community[] => {
  const loadedIds = new Set(loaded.map((c) => c._id));
  const preserved = prev.filter((c) => !loadedIds.has(c._id));
  return sortCommunitiesByRecent([...preserved, ...loaded]);
};

const fetchUnreadCountForChat = async (chatId: string): Promise<number> => {
  try {
    const { data } = await axiosInstance.get(`/chats/${chatId}/unread-count`);
    return data.data?.unreadCount ?? 0;
  } catch {
    return 0;
  }
};

export const GroupsFeed = () => {
  const { socket } = useChat();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = currentUser._id;
  const activeGroupIdRef = useRef<string | null>(null);
  const communitiesRef = useRef<Community[]>([]);
  
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Community[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [showGroupDetailsPanel, setShowGroupDetailsPanel] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isSideBarOpen, setIsSideBarOpen] = useState(true);
  const [isSharedMediaOpen, setIsSharedMediaOpen] = useState(false);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const prevActiveGroupIdRef = useRef<string | null>(null);
  const fetchToastShownRef = useRef(false);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const loadCommunitiesRef = useRef<
    (options?: { silent?: boolean }) => Promise<Community[] | null>
  >(() => Promise.resolve(null));

  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    communitiesRef.current = communities;
  }, [communities]);

  const syncUnreadCounts = useCallback(async (list: Community[]) => {
    if (!list.length) return;

    const counts = await Promise.all(
      list.map(async (community) => {
        const chatId = resolveCommunityChatId(community);
        if (!chatId) return { id: community._id, unreadCount: 0 };
        const unreadCount = await fetchUnreadCountForChat(chatId);
        return { id: community._id, unreadCount };
      }),
    );

    setCommunities((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        const match = counts.find((x) => x.id === c._id);
        if (!match) return c;
        const unreadCount =
          activeGroupIdRef.current === c._id ? 0 : match.unreadCount;
        if (c.unreadCount === unreadCount) return c;
        changed = true;
        return { ...c, unreadCount };
      });
      return changed ? next : prev;
    });
  }, []);

  const selectCommunity = useCallback(
    (community: Community) => {
      setActiveGroupId(community._id);
      setCommunities((prev) => {
        const updated = prev.map((c) =>
          c._id === community._id ? { ...c, unreadCount: 0 } : c,
        );
        return sortCommunitiesByRecent(updated);
      });

      const chatId = resolveCommunityChatId(community);
      if (chatId) {
        axiosInstance.put(`/chats/${chatId}/read`).catch(() => {});
      }
    },
    [],
  );

  useEffect(() => {
    if (!showSidebarMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarMenuRef.current &&
        !sidebarMenuRef.current.contains(event.target as Node)
      ) {
        setShowSidebarMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSidebarMenu]);

  useEffect(() => {
    setShowGroupDetailsPanel(false);
  }, [activeGroupId]);

  // Derived: only allow collapsing when a group is actually selected
  const isChatSelected = !!activeGroupId;

  // If no chat is selected, always force the sidebar open so the user
  // can't end up staring at an empty screen with no list visible.
  useEffect(() => {
    if (!isChatSelected) setIsSideBarOpen(true);
  }, [isChatSelected]);

  useEffect(() => {
    setIsSharedMediaOpen(false);
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId) {
      setActiveChatId(null);
      return;
    }
    const community = communitiesRef.current.find((c) => c._id === activeGroupId);
    const chatId = community ? resolveCommunityChatId(community) : null;
    setActiveChatId(chatId);
    setMessages([]);
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeChatId) return;
    const community = communitiesRef.current.find((c) => c._id === activeGroupId);
    if (community && isCommunityInvited(community, currentUserId)) return;

    const fetchMessages = async () => {
      const targetChatId = activeChatId;
      try {
        const response = await axiosInstance.get(`/chats/${targetChatId}/messages`);
        const sortedMessages = [...response.data.data.messages].sort(
          (a: { createdAt: string }, b: { createdAt: string }) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const formatted: MessageType[] = sortedMessages.map(
          (m: {
            _id: string;
            messageType: string;
            content: string;
            createdAt: string;
            senderId: { _id?: string; fullName?: string } | string;
            status?: MessageType['status'];
            duration?: number;
            isDeletedForEveryone?: boolean;
            isEdited?: boolean;
            isPinned?: boolean;
            reactions?: MessageType['reactions'];
            attachments?: Array<{ fileUrl?: string; fileType?: string; fileSize?: number }>;
            replyTo?: MessageType['replyTo'];
          }) => {
            const isMine =
              (typeof m.senderId === 'string' ? m.senderId : m.senderId?._id) === currentUserId;
            const senderName =
              typeof m.senderId === 'object' ? m.senderId?.fullName : undefined;
            return {
              id: m._id,
              type: (['text', 'audio', 'file', 'image', 'video'].includes(m.messageType)
                ? m.messageType
                : m.content?.endsWith('.webm')
                  ? 'audio'
                  : 'text') as MessageType['type'],
              content: m.content || m.attachments?.[0]?.fileUrl || '',
              fileUrl:
                m.attachments?.[0]?.fileUrl ||
                (['image', 'video', 'file'].includes(m.messageType) ? m.content : undefined),
              fileName: extractFileName(m.attachments?.[0]?.fileUrl),
              fileSize: formatFileSize(m.attachments?.[0]?.fileSize),
              duration: m.duration,
              isDeletedForEveryone: m.isDeletedForEveryone,
              isEdited: m.isEdited,
              isPinned: m.isPinned,
              reactions: m.reactions || [],
              replyTo: m.replyTo,
              time: new Date(m.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              isMine,
              status: m.status || (isMine ? 'sent' : undefined),
              senderName,
            };
          }
        );
        if (String(targetChatId) === String(activeChatId)) {
          setMessages(formatted);
        }
      } catch {
        toast.error('Failed to load messages');
      }
    };

    fetchMessages();
  }, [activeGroupId, activeChatId, currentUserId]);
  
  const filters = ["All", "Programming", "UI/UX", "Data", "Cyber", "Cloud"];

  const loadCommunities = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setIsLoading(true);
      const category = activeFilter === "All" ? "" : activeFilter.toLowerCase();
      const response = await axiosInstance.get(`/groups?category=${category}`);
      const loaded: Community[] = response.data.data?.communities ?? [];
      setCommunities((prev) => mergeCommunitiesLists(prev, loaded));
      fetchToastShownRef.current = false;
      return loaded;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 429 && !fetchToastShownRef.current) {
        fetchToastShownRef.current = true;
        toast.error("Failed to load communities");
      }
      return null;
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadCommunitiesRef.current = loadCommunities;
  }, [loadCommunities]);

  const openGroupPreview = useCallback((community: Community) => {
    setCommunities((prev) => mergeCommunityIntoList(prev, community));
    setActiveGroupId(community._id);
  }, []);

  const handleJoinGroup = useCallback(
    async (community: Community) => {
      const communityId = community._id;
      const communityName = community.name;
      const isPrivate = community.isPublic === false;

      try {
        const { data } = await axiosInstance.post(`/groups/${communityId}/join`);
        if (data.data?.requestSent) {
          setCommunities((prev) =>
            prev.map((c) =>
              c._id === communityId
                ? {
                    ...c,
                    joinRequests: [
                      ...(c.joinRequests ?? []).filter((r) => {
                        const uid =
                          typeof r.userId === "string"
                            ? r.userId
                            : r.userId?._id;
                        return String(uid) !== String(currentUserId);
                      }),
                      {
                        userId: currentUserId,
                        status: "pending" as const,
                        requestedAt: new Date().toISOString(),
                      },
                    ],
                  }
                : c,
            ),
          );
          toast.success("Join request sent!");
          return;
        }
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        const message = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        if (status === 400 && message?.toLowerCase().includes("pending")) {
          toast.error(message);
          return;
        }
        if (status !== 400) {
          toast.error(isPrivate ? "Failed to send join request" : "Failed to join group");
          return;
        }
      }

      try {
        const response = await axiosInstance.get("/groups");
        const loaded: Community[] = response.data.data?.communities ?? [];
        setCommunities((prev) => mergeCommunitiesLists(prev, loaded));
      } catch {
        await loadCommunities({ silent: true });
      }

      setActiveGroupId(communityId);
      socket?.emit("join-room", communityId);
      toast.success(`Joined ${communityName || "the group"}!`);
    },
    [loadCommunities, socket, currentUserId],
  );

  const handleLeaveGroup = useCallback(
    async (communityId: string) => {
      try {
        await axiosInstance.post(`/groups/${communityId}/leave`);
        setShowGroupDetailsPanel(false);
        setActiveGroupId(null);
        socket?.emit("leave-room", communityId);
        setCommunities((prev) => prev.filter((c) => c._id !== communityId));
        await loadCommunities({ silent: true });
        toast.success("You left the group");
      } catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        toast.error(message || "Failed to leave group");
      }
    },
    [loadCommunities, socket],
  );

  const handleRespondToJoinRequest = useCallback(
    async (communityId: string, userId: string, action: "accept" | "reject") => {
      try {
        const { data } = await axiosInstance.put(
          `/groups/${communityId}/requests/${userId}`,
          { action },
        );
        setCommunities((prev) =>
          prev.map((c) => {
            if (c._id !== communityId) return c;
            const nextRequests = (c.joinRequests ?? []).filter((r) => {
              const uid = typeof r.userId === "string" ? r.userId : r.userId?._id;
              return String(uid) !== String(userId);
            });
            if (action === "accept" && data.data?.community) {
              return { ...data.data.community, unreadCount: c.unreadCount ?? 0 };
            }
            return { ...c, joinRequests: nextRequests };
          }),
        );
        toast.success(
          action === "accept" ? "Request accepted" : "Request rejected",
        );
      } catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        toast.error(message || "Failed to update join request");
      }
    },
    [],
  );

  const handleAcceptCommunityInvite = useCallback(
    async (communityId: string) => {
      try {
        const { data } = await axiosInstance.post(
          `/groups/${communityId}/invite/accept`,
        );
        const updated = data.data?.community;
        if (updated) {
          setCommunities((prev) =>
            prev.map((c) =>
              c._id === communityId
                ? { ...updated, unreadCount: 0, isInvited: false }
                : c,
            ),
          );
        } else {
          await loadCommunities({ silent: true });
        }
        socket?.emit("join-room", communityId);
        toast.success("Invitation accepted!");
      } catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        toast.error(message || "Failed to accept invitation");
      }
    },
    [loadCommunities, socket],
  );

  const handleDeclineCommunityInvite = useCallback(
    async (communityId: string) => {
      try {
        await axiosInstance.post(`/groups/${communityId}/invite/decline`);
        setShowGroupDetailsPanel(false);
        setActiveGroupId(null);
        setCommunities((prev) => prev.filter((c) => c._id !== communityId));
        toast.success("Invitation declined");
      } catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        toast.error(message || "Failed to decline invitation");
      }
    },
    [],
  );

  const handleDeleteGroup = useCallback(
    async (communityId: string) => {
      try {
        await axiosInstance.delete(`/groups/${communityId}`);
        setShowGroupDetailsPanel(false);
        setActiveGroupId(null);
        socket?.emit("leave-room", communityId);
        setCommunities((prev) => prev.filter((c) => c._id !== communityId));
        await loadCommunities({ silent: true });
        toast.success("Group deleted successfully");
      } catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        toast.error(message || "Failed to delete group");
        throw error;
      }
    },
    [loadCommunities, socket],
  );

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const runGlobalSearch = useCallback(async () => {
    const q = globalSearchQuery.trim();
    if (!q) {
      setGlobalSearchResults([]);
      return;
    }
    setGlobalSearchLoading(true);
    try {
      const response = await axiosInstance.get("/groups/search", {
        params: { search: q },
      });
      setGlobalSearchResults(response.data.data.communities || []);
    } catch {
      toast.error("Global search is unavailable. Please try again later.");
      setGlobalSearchResults([]);
    } finally {
      setGlobalSearchLoading(false);
    }
  }, [globalSearchQuery]);

  const filteredCommunities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.tags?.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [communities, searchQuery]);

  // After creating a group: merge into list and open it (no full-page refresh)
  useEffect(() => {
    const state = location.state as {
      openGroupId?: string;
      newCommunity?: Community;
    } | null;
    if (!state?.newCommunity && !state?.openGroupId) return;

    const incoming = state.newCommunity;
    const openId = state.openGroupId ?? incoming?._id;

    if (incoming) {
      const normalized = { ...incoming, unreadCount: 0 };
      setCommunities((prev) =>
        sortCommunitiesByRecent(
          prev.filter((c) => c._id !== normalized._id).concat(normalized),
        ),
      );
    }

    if (openId) {
      setActiveGroupId(openId);
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  const communityRoomIds = communities.map((c) => c._id).join(",");

  // Phase 3: join communityId rooms so sidebar receives new-community-message
  useEffect(() => {
    if (!socket || !communityRoomIds) return;

    const ids = communityRoomIds.split(",");
    ids.forEach((id) => socket.emit("join-room", id));
    return () => {
      ids.forEach((id) => socket.emit("leave-room", id));
    };
  }, [socket, communityRoomIds]);

  // Phase 3: real-time sidebar preview + unread bump (stable subscription — socket only)
  useEffect(() => {
    if (!socket) return;

    const handleNewCommunityMessage = (payload: NewCommunityMessagePayload) => {
      const { communityId, lastMessage, timestamp } = payload;
      const populatedSender = payload.sender ?? (
        typeof payload.senderId === "object" ? payload.senderId : undefined
      );
      const senderId =
        populatedSender ?? resolveMessageSenderId(payload.senderId) ?? payload.senderId;
      const senderObjectId = resolveMessageSenderId(senderId);
      const isFromMe =
        senderObjectId != null &&
        String(senderObjectId) === String(currentUserId);
      const isActive = String(activeGroupIdRef.current) === String(communityId);

      setCommunities((prev) => {
        const idx = prev.findIndex((c) => String(c._id) === String(communityId));
        if (idx === -1) return prev;

        const community = prev[idx];
        const existingLatestId = community.chatId?.latestMessage?._id;
        if (
          existingLatestId &&
          String(existingLatestId) === String(lastMessage._id)
        ) {
          return prev;
        }

        const latestMessage = {
          _id: lastMessage._id,
          content: lastMessage.content,
          messageType: lastMessage.messageType,
          createdAt: timestamp,
          senderId: populatedSender ?? senderId,
          status: isFromMe ? "sent" : undefined,
        };

        const updatedChatId =
          typeof community.chatId === "object" && community.chatId !== null
            ? { ...community.chatId, latestMessage, updatedAt: timestamp }
            : community.chatId;

        const updated: Community = {
          ...community,
          chatId: updatedChatId,
          unreadCount:
            isActive || isFromMe
              ? 0
              : (community.unreadCount || 0) + 1,
        };

        const rest = prev.filter((_, i) => i !== idx);
        return sortCommunitiesByRecent([...rest, updated]);
      });
    };

    const handleAddedToCommunity = (payload?: { community?: Community }) => {
      if (payload?.community) {
        const item = { ...payload.community, unreadCount: 0, isInvited: false };
        setCommunities((prev) =>
          sortCommunitiesByRecent(
            prev.filter((c) => c._id !== item._id).concat(item),
          ),
        );
      } else {
        void loadCommunitiesRef.current({ silent: true });
      }
    };

    const handleInvitedToCommunity = (payload?: { community?: Community }) => {
      if (payload?.community) {
        const item = { ...payload.community, unreadCount: 0, isInvited: true };
        setCommunities((prev) =>
          sortCommunitiesByRecent(
            prev.filter((c) => c._id !== item._id).concat(item),
          ),
        );
      }
    };

    socket.on("new-community-message", handleNewCommunityMessage);
    socket.on("added-to-community", handleAddedToCommunity);
    socket.on("invited-to-community", handleInvitedToCommunity);
    return () => {
      socket.off("new-community-message", handleNewCommunityMessage);
      socket.off("added-to-community", handleAddedToCommunity);
      socket.off("invited-to-community", handleInvitedToCommunity);
    };
  }, [socket, currentUserId]);

  // Phase 4: refresh unread badges only when user closes a chat (not on initial mount)
  useEffect(() => {
    const prev = prevActiveGroupIdRef.current;
    prevActiveGroupIdRef.current = activeGroupId;

    if (prev !== null && activeGroupId === null && communitiesRef.current.length) {
      syncUnreadCounts(communitiesRef.current);
    }
  }, [activeGroupId, syncUnreadCounts]);

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
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate("/create-group")}
                className="flex items-center justify-center gap-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
                title="Create New Group"
              >
                <span className="material-icons-round text-sm">add</span>
                Create
              </button>
              <div className="relative" ref={sidebarMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSidebarMenu((open) => !open)}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400"
                  title="Sidebar menu"
                >
                    <span className="material-icons">menu</span>
                  </button>
                  {showSidebarMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-700 shadow-lg py-1 z-50">
                      {isChatSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowSidebarMenu(false);
                            setIsSideBarOpen((open) => !open);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          {isSideBarOpen ? "Collapse sidebar" : "Expand sidebar"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowSidebarMenu(false);
                          setShowGlobalSearchModal(true);
                          setGlobalSearchQuery("");
                          setGlobalSearchResults([]);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Global search
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="relative group">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
              search
            </span>
            <input
              className="w-full bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-800 rounded-lg py-2 pl-10 pr-4 text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 transition-all text-sm"
              placeholder="Search groups"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
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
          ) : filteredCommunities.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              {searchQuery.trim()
                ? "No groups match your search."
                : "No groups found in this category."}
            </div>
          ) : (
            filteredCommunities.map((community) => (
              <div 
                key={community._id}
                onClick={() => selectCommunity(community)}
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
                    {isCommunityInvited(community, currentUserId) && (
                      <span className="text-[10px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-1.5 py-0.5 rounded-full shrink-0">
                        New Invite
                      </span>
                    )}
                  </div>
                  <div className={`text-xs truncate ${community.unreadCount ? 'font-bold text-[#171717] dark:text-[#F5F5F5]' : 'text-gray-500 dark:text-gray-400'}`}>
                    {(() => {
                      if (!community.chatId?.latestMessage) return community.description;
                      const msg = community.chatId.latestMessage;
                      const senderRef = msg.senderId;
                      const senderObjectId = resolveMessageSenderId(senderRef);
                      const isMine =
                        senderObjectId != null &&
                        String(senderObjectId) === String(currentUserId);
                      const senderName = getLatestMessageSenderName(
                        senderRef,
                        isMine,
                      );
                      const contentRaw = msg.content;
                      const contentStr = typeof contentRaw === 'object' && contentRaw !== null ? (contentRaw.text || contentRaw.message || 'Message') : (contentRaw || '');
                      const content = ['text', 'audio', 'file', 'image', 'video'].includes(msg.messageType) && msg.messageType !== 'text' 
                        ? `Sent a ${msg.messageType}` 
                        : contentStr;
                      
                      let ticks = '';
                      if (isMine) {
                        ticks = (msg.status === 'read' || msg.status === 'delivered') ? '✓✓' : '✓';
                      }
                      
                      return (
                        <div className="flex items-center gap-1 truncate">
                          {isMine && <span className={msg.status === 'read' ? 'text-[#7C3AED] tracking-tighter' : 'text-gray-400 tracking-tighter'}>{ticks}</span>}
                          <span className="truncate">{senderName}: {content}</span>
                        </div>
                      );
                    })()}
                  </div>
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
      </aside>

      {activeGroupId && communities.find(c => c._id === activeGroupId) ? (
        (() => {
          const activeCommunity = communities.find(c => c._id === activeGroupId);
          // Handle both string IDs and populated objects in members array
          const isMember = activeCommunity
            ? isCommunityMember(activeCommunity, currentUserId)
            : false;
          const isInvited = activeCommunity
            ? isCommunityInvited(activeCommunity, currentUserId)
            : false;

          if (isInvited) {
            return (
              <div className="flex flex-1 min-h-0 min-w-0">
                <ChatWindow
                  chatId={activeChatId || resolveCommunityChatId(activeCommunity!) || ""}
                  chatName={activeCommunity?.name || "Group"}
                  isOnline={true}
                  isGroup={true}
                  messages={[]}
                  setMessages={setMessages}
                  groupMembers={activeCommunity?.members}
                  isChatListOpen={isSideBarOpen}
                  onOpenChatList={() => setIsSideBarOpen(true)}
                  onCloseChat={() => setActiveGroupId(null)}
                  onOpenGroupDetails={() => setShowGroupDetailsPanel(true)}
                  isGroupInviteView
                  onAcceptGroupInvitation={() =>
                    void handleAcceptCommunityInvite(activeCommunity!._id)
                  }
                  onDeclineGroupInvitation={() =>
                    void handleDeclineCommunityInvite(activeCommunity!._id)
                  }
                />
                {showGroupDetailsPanel && activeCommunity && (
                  <aside className="w-[340px] shrink-0 h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-[#262626] flex flex-col z-10">
                    <GroupDetails
                      chatId={activeChatId || resolveCommunityChatId(activeCommunity) || ""}
                      chatName={activeCommunity.name}
                      description={activeCommunity.description}
                      isPrivateGroup={activeCommunity.isPublic === false}
                      groupMembers={activeCommunity.members}
                      groupAdmins={[]}
                      canAddMembers={false}
                      isInvitedView
                      communityId={activeCommunity._id}
                      onAcceptInvitation={() =>
                        void handleAcceptCommunityInvite(activeCommunity._id)
                      }
                      onDeclineInvitation={() =>
                        void handleDeclineCommunityInvite(activeCommunity._id)
                      }
                      onClose={() => setShowGroupDetailsPanel(false)}
                      onLeaveGroup={() => {}}
                      onSearchClick={() => setShowGroupDetailsPanel(false)}
                      onEditGroup={() => {}}
                      isMuted={false}
                      onToggleMute={() => {}}
                    />
                  </aside>
                )}
              </div>
            );
          }

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

                  {(() => {
                    const isPrivate = activeCommunity?.isPublic === false;
                    const pending = hasPendingJoinRequest(
                      activeCommunity!,
                      currentUserId,
                    );
                    const joinLabel = isPrivate ? "Request to Join" : "Join Group";
                    return (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          void handleJoinGroup(activeCommunity!)
                        }
                        className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-colors"
                      >
                        {pending ? "Pending Request" : joinLabel}
                      </button>
                    );
                  })()}
                </div>
              </main>
            );
          }

          const groupAdminIds = (activeCommunity?.admins || []).map(
            (a: string | { _id?: string }) =>
              typeof a === "string" ? a : a._id || "",
          );
          const ownerId =
            typeof activeCommunity?.owner === "string"
              ? activeCommunity.owner
              : activeCommunity?.owner?._id;
          const isGroupAdmin = isCommunityAdmin(activeCommunity!, currentUserId);
          const pendingJoinRequests = (activeCommunity?.joinRequests ?? []).filter(
            (r) => r.status === "pending" || !r.status,
          );

          return (
            <div className="flex flex-1 min-h-0 min-w-0">
            <ChatWindow 
              chatId={activeChatId || resolveCommunityChatId(activeCommunity!) || ''}
              chatName={activeCommunity?.name || "Group Chat"} 
              isOnline={true} 
              isGroup={true}
              messages={messages}
              setMessages={setMessages}
              groupMembers={activeCommunity?.members}
              groupAdmins={groupAdminIds}
              isPrivateGroup={activeCommunity?.isPublic === false}
              isChatListOpen={isSideBarOpen}
              onOpenChatList={() => setIsSideBarOpen(true)}
              onOpenSharedMedia={() => setIsSharedMediaOpen(true)}
              onCloseChat={() => setActiveGroupId(null)}
              onOpenGroupDetails={() => setShowGroupDetailsPanel(true)}
            />
            {isSharedMediaOpen && (
              <SharedMediaSidePanel messages={messages} onClose={() => setIsSharedMediaOpen(false)} />
            )}
            {showGroupDetailsPanel && activeCommunity && (
              <aside className="w-[340px] shrink-0 h-full border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-[#262626] flex flex-col z-10">
                <GroupDetails
                  chatId={activeChatId || resolveCommunityChatId(activeCommunity) || ""}
                  chatName={activeCommunity.name}
                  description={activeCommunity.description}
                  isPrivateGroup={activeCommunity.isPublic === false}
                  groupMembers={activeCommunity.members}
                  groupAdmins={
                    ownerId && !groupAdminIds.includes(ownerId)
                      ? [ownerId, ...groupAdminIds]
                      : groupAdminIds
                  }
                  canAddMembers={isGroupAdmin}
                  isGroupAdmin={isGroupAdmin}
                  joinRequests={pendingJoinRequests}
                  communityId={activeCommunity._id}
                  onRespondToJoinRequest={(userId: string, action: 'accept' | 'reject') =>
                    handleRespondToJoinRequest(activeCommunity._id, userId, action)
                  }
                  onMembersUpdated={(members) =>
                    setCommunities((prev) =>
                      prev.map((c) =>
                        c._id === activeCommunity._id ? { ...c, members } : c,
                      ),
                    )
                  }
                  onDeleteGroup={() => handleDeleteGroup(activeCommunity._id)}
                  onClose={() => setShowGroupDetailsPanel(false)}
                  onLeaveGroup={() => void handleLeaveGroup(activeCommunity._id)}
                  onSearchClick={() => setShowGroupDetailsPanel(false)}
                  onEditGroup={() => toast("Edit group coming soon")}
                  isMuted={false}
                  onToggleMute={() => {}}
                />
              </aside>
            )}
            </div>
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

      {showGlobalSearchModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowGlobalSearchModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#262626] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5]">
                Search all communities
              </h3>
              <button
                type="button"
                onClick={() => setShowGlobalSearchModal(false)}
                className="text-gray-400 hover:text-red-500"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runGlobalSearch();
                  }
                }}
                placeholder="Search communities..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-[#171717] text-sm outline-none focus:ring-2 focus:ring-[#7C3AED]/50"
              />
              <button
                type="button"
                onClick={() => void runGlobalSearch()}
                disabled={globalSearchLoading}
                className="px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {globalSearchLoading ? "..." : "Search"}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto hide-scrollbar space-y-2">
              {globalSearchResults.length === 0 && !globalSearchLoading ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  {globalSearchQuery.trim()
                    ? "No communities found."
                    : "Type a name and press Search."}
                </p>
              ) : (
                globalSearchResults.map((community) => (
                  <button
                    key={community._id}
                    type="button"
                    onClick={() => {
                      setShowGlobalSearchModal(false);
                      if (isCommunityMember(community, currentUserId)) {
                        selectCommunity(community as Community);
                      } else {
                        openGroupPreview(community as Community);
                      }
                    }}
                    className="w-full text-left p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <p className="font-semibold text-sm text-[#171717] dark:text-[#F5F5F5]">
                      {community.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {community.description}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};