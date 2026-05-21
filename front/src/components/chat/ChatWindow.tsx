import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { useChat } from '../../context/ChatContext';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { CreatePostModal } from '../CreatePostModal';
import { VoiceRecorder } from './VoiceRecorder';
import { GroupDetails } from './GroupDetails';
import { CameraModal } from './CameraModal';
import { useCall } from '../../context/CallContext';
import { ForwardMessageModal } from './ForwardMessageModal';
import { resolveChatMediaUrl } from './ProfileSidePanel';

export function formatFileSize(bytes?: number): string | undefined {
  if (bytes === undefined || bytes === null) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function extractFileName(url?: string): string {
  if (!url) return 'Attachment';
  const decoded = decodeURIComponent(url);
  const baseName = decoded.substring(decoded.lastIndexOf('/') + 1);
  return baseName.replace(/^\d+-/, ''); // Remove unique prefix
}

export function getDownloadUrl(url?: string): string {
  if (!url) return '#';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
}

export type MessageType = {
  id: string;
  type: 'text' | 'file' | 'audio' | 'call_summary' | 'image' | 'video';
  content?: string;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  time: string;
  isMine: boolean;
  isPending?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  duration?: number;
  isDeletedForEveryone?: boolean;
  isEdited?: boolean;
  isPinned?: boolean;
  reactions?: { userId: string; emoji: string }[];
  replyTo?: any; // To store reference if replied
  isForwarded?: boolean;
  senderName?: string;
};

interface ChatWindowProps {
  chatId: string;
  receiverId?: string;
  chatName: string;
  isOnline: boolean;
  showOnlineStatus?: boolean;
  isGroup?: boolean;
  messages: MessageType[];
  setMessages?: React.Dispatch<React.SetStateAction<MessageType[]>>;
  isChatListOpen?: boolean;
  onOpenChatList?: () => void;
  groupMembers?: any[];
  groupAdmins?: string[];
  isPrivateGroup?: boolean;
  chats?: any[]; // Passed down to power the Forward Message Modal
  /** Lifted from HomeFeed ΓÇö WhatsApp-style search sidebar coordination */
  isChatSearchOpen?: boolean;
  onChatSearchOpenChange?: (open: boolean) => void;
  /** Open contact profile in parent side panel (keeps chat context). */
  onOpenProfile?: (userId: string) => void;
  /** Open shared media / files / links panel (parent layout; keeps chat context). */
  onOpenSharedMedia?: () => void;
  /** Close the active chat view without deleting history. */
  onCloseChat?: () => void;
  /** Open group details in parent layout (keeps chat visible). */
  onOpenGroupDetails?: () => void;
  chatStatus?: 'pending' | 'accepted';
  isChatInitiator?: boolean;
  isChatRecipient?: boolean;
  onRespondToChatRequest?: (action: 'accept' | 'reject') => void | Promise<void>;
  /** Restricted group invite preview (no messages, accept/decline only). */
  isGroupInviteView?: boolean;
  onAcceptGroupInvitation?: () => void | Promise<void>;
  onDeclineGroupInvitation?: () => void | Promise<void>;
}

const formatGroupMemberLabel = (members: unknown[]): string => {
  const names = (members || [])
    .filter(Boolean)
    .map((m) => {
      if (typeof m === "string") return null;
      const member = m as { fullName?: string; name?: string };
      return member.fullName || member.name || null;
    })
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return "Group members";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")}, +${names.length - 2} others`;
};

type SearchUser = {
  _id: string;
  fullName: string;
  email?: string;
  role?: string;
  avatar?: string;
};

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatId,
  receiverId,
  chatName,
  isOnline,
  showOnlineStatus = true,
  isGroup = false,
  messages,
  setMessages,
  isChatListOpen = true,
  onOpenChatList,
  groupMembers = [],
  groupAdmins = [],
  isPrivateGroup = false,
  chats = [],
  isChatSearchOpen,
  onChatSearchOpenChange,
  onOpenProfile,
  onOpenSharedMedia,
  onCloseChat,
  onOpenGroupDetails,
  chatStatus = 'accepted',
  isChatInitiator = false,
  isChatRecipient = false,
  onRespondToChatRequest,
  isGroupInviteView = false,
  onAcceptGroupInvitation,
  onDeclineGroupInvitation,
}) => {
  const activeChatId = chatId;
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showAiPopup, setShowAiPopup] = useState(false);

  // Chat-Specific AI Assistant States
  const [aiTab, setAiTab] = useState<'summarize' | 'search'>('summarize');
  const [summaryLimit, setSummaryLimit] = useState<number | string>(10);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string>('');
  const [summaryError, setSummaryError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string>('');
  const [searchFallback, setSearchFallback] = useState(false);

  // Reset AI states when chatId changes
  useEffect(() => {
    setShowAiPopup(false);
    setSummaryResult('');
    setSummaryError('');
    setSearchQuery('');
    setSearchResult('');
    setSearchFallback(false);
    setSmartReplies([]);
    setTranslatedMessages({});
    setTranslatingMessageId(null);
  }, [chatId]);

  const handleSummarizeChat = async () => {
    setSummarizing(true);
    setSummaryResult('');
    setSummaryError('');
    try {
      const limitVal = summaryLimit === 'All' ? 999999 : Number(summaryLimit);
      const res = await axiosInstance.post('/api/ai/chat/summarize', {
        chatId,
        limit: limitVal,
      }, {
        timeout: 60000,
      });
      const dataStr = res.data?.data || '';

      if (typeof dataStr === 'string' && (dataStr.includes("┘ä╪º ╪¬┘ê╪¼╪» ╪▒╪│╪º╪ª┘ä ┘â╪º┘ü┘è╪⌐") || dataStr.includes("┘ä╪º ╪¬┘ê╪¼╪» ╪▒╪│╪º╪ª┘ä ┘â╪º┘ü┘è╪⌐ ┘ä╪¬┘ä╪«┘è╪╡┘ç╪º"))) {
        setSummaryError("Cannot summarize: The messages might have been deleted or there are not enough messages in this chat.");
      } else {
        setSummaryResult(dataStr);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.message || "Failed to summarize chat.";
      setSummaryError(errMsg);
    } finally {
      setSummarizing(false);
    }
  };

  const handleSmartSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchResult('');
    setSearchFallback(false);
    try {
      const res = await axiosInstance.post(`/api/ai/smart-search/${chatId}`, {
        query: trimmed,
        chatId,
      }, {
        timeout: 60000,
      });
      const dataStr = res.data?.data || '';
      setSearchResult(dataStr);

      // Check if fallback response detected
      const isFallback = [
        "╪╣╪░╪▒╪º┘ï╪î ┘ä╪º ╪ú┘à╪¬┘ä┘â",
        "┘ä╪º ╪ú┘à╪¬┘ä┘â ┘à╪╣┘ä┘ê┘à╪º╪¬ ┘â╪º┘ü┘è╪⌐",
        "No relevant messages found",
        "don't have information",
        "cannot find this information"
      ].some(phrase => dataStr.toLowerCase().includes(phrase.toLowerCase()));

      if (isFallback) {
        setSearchFallback(true);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.message || "Search failed.";
      setSearchResult(`ΓÜá∩╕Å ${errMsg}`);
    } finally {
      setSearching(false);
    }
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [inputText, setInputText] = useState('');
  const [activeSidePanel, setActiveSidePanel] = useState<'details' | 'search' | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [showGroupPostModal, setShowGroupPostModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isSearchingUsers] = useState(false);
  const [searchResults] = useState<SearchUser[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'up' | 'down'>('up');
  const [forwardingMessage, setForwardingMessage] = useState<MessageType | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string, type: 'image' | 'document' } | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);

  // Smart Replies & Inline Translation States
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, { translatedText: string; originalText: string }>>({});
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const navigate = useNavigate();
  const { socket } = useChat();
  const { callUser, callGroup } = useCall();
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLAudioElement>(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const cannotReply = !isGroup && (blockedByMe || blockedMe);

  // Calculate if the current user can add members based on group privacy
  const isCurrentUserAdmin = (groupAdmins || []).includes(currentUser._id);
  const canAddMembers = isPrivateGroup ? isCurrentUserAdmin : true;
  const isParticipant = isGroup ? groupMembers.some(m => (m._id || m) === currentUser._id) : true;

  const searchMatchingMessages = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) =>
      (m.content || '').toLowerCase().includes(q) ||
      (m.fileName || '').toLowerCase().includes(q)
    );
  }, [messages, chatSearchQuery]);

  const closeChatSidebar = () => {
    setShowUserDetails(false);
    setShowDetails(false);
    setActiveSidePanel(null);
    setActiveSidePanel(null);
    onChatSearchOpenChange?.(false);
  };

  const scrollToMessageInThread = (messageId: string) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    if (isGroup || !receiverId) {
      setBlockedByMe(false);
      setBlockedMe(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(`/users/block-relation/${receiverId}`);
        const data = res.data?.data as { blockedByMe?: boolean; blockedMe?: boolean } | undefined;
        if (!cancelled) {
          setBlockedByMe(!!data?.blockedByMe);
          setBlockedMe(!!data?.blockedMe);
        }
      } catch {
        if (!cancelled) {
          setBlockedByMe(false);
          setBlockedMe(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiverId, isGroup, chatId]);

  useEffect(() => {
    if (isChatSearchOpen) {
      setShowUserDetails(true);
      setActiveSidePanel('search');
    }
  }, [isChatSearchOpen]);

  useEffect(() => {
    if (!socket) return;
    const onBlocked = (payload?: { message?: string }) => {
      toast.error(payload?.message || 'This action is not allowed.');
    };

    const onBlockStatusChanged = (payload: { blockerId: string, blocked: boolean }) => {
      // Only update state if the person who blocked/unblocked us is the current chat's receiver
      if (payload.blockerId === receiverId) {
        setBlockedMe(payload.blocked);
      }
    };

    socket.on('blocked', onBlocked);
    socket.on('block-status-changed', onBlockStatusChanged);
    return () => {
      socket.off('blocked', onBlocked);
      socket.off('block-status-changed', onBlockStatusChanged);
    };
  }, [socket, receiverId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.message-context-menu')) {
        setActiveMessageMenu(null);
      }
      if (!(event.target as Element).closest('.attachment-menu-container')) {
        setShowAttachmentMenu(false);
      }
      if (!(event.target as Element).closest('.header-menu-container')) {
        setShowHeaderMenu(false);
      }
    };
    if (activeMessageMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMessageMenu, showHeaderMenu]);

  const handleOpenMessageMenu = (msgId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (activeMessageMenu === msgId) {
      setActiveMessageMenu(null);
      return;
    }
    buttonRef.current = e.currentTarget;
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      /** Tall menu (reactions + actions); need enough clearance below viewport top / header */
      const SAFE_MARGIN = 400;
      setDropdownDirection(spaceAbove < SAFE_MARGIN ? 'down' : 'up');
    }
    setActiveMessageMenu(msgId);
  };

  const handleClearChat = async () => {
    try {
      await axiosInstance.delete(`/chats/${chatId}/clear`);
      if (setMessages) setMessages([]);
      setShowHeaderMenu(false);
      toast.success("Chat cleared");
    } catch (err) {
      toast.error("Failed to clear chat");
    }
  };

  const handleMuteChat = async () => {
    try {
      const res = await axiosInstance.put(`/chats/${chatId}/mute`);
      setIsMuted(res.data.isMuted);
      setShowHeaderMenu(false);
      toast.success(res.data.isMuted ? "Chat muted" : "Chat unmuted");
    } catch (err) {
      toast.error("Failed to toggle mute");
    }
  };

  const handleBlockUser = async () => {
    if (isGroup || !receiverId) return;
    try {
      await axiosInstance.put(`/users/block/${receiverId}`);
      const newBlockedState = !blockedByMe;
      setBlockedByMe(newBlockedState);
      setShowHeaderMenu(false);
      toast.success(newBlockedState ? "User blocked" : "User unblocked");
    } catch (err) {
      toast.error("Failed to block user");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Join Room Effect (Depends on chatId)
  useEffect(() => {
    if (!socket || !activeChatId) return;
    socket.emit('join-room', activeChatId);
    return () => {
      socket.emit('leave-room', activeChatId);
    };
  }, [socket, activeChatId]);

  // 2. Socket Listeners Effect
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (incoming: unknown) => {
      if (!setMessages) return;
      const incomingMsg = incoming as {
        chatId: string;
        _id?: string;
        id?: string;
        messageType?: string;
        type?: string;
        content?: string;
        text?: string;
        createdAt?: string;
        sender?: { _id?: string; id?: string; fullName?: string } | string;
        senderId?: { _id?: string; id?: string; fullName?: string } | string;
        replyTo?: any;
        attachments?: Array<{ fileUrl?: string; fileType?: string; fileSize?: number }>;
      };

      // Only append messages for the currently active chat
      if (String(incomingMsg.chatId) !== String(activeChatId)) return;

      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const senderRaw = incomingMsg.senderId ?? incomingMsg.sender;
      const senderIdStr = typeof senderRaw === 'object' ? (senderRaw?._id || senderRaw?.id) : senderRaw;
      if (senderIdStr === currentUser._id) return; // Ignore messages sent by me (Axios handles local append)

      // Play message notification sound via local React ref
      if (msgRef.current) {
        msgRef.current.play().catch((e: any) => {
          // Dev-safe: missing/unsupported sources should not spam console
          if (e?.name === 'NotSupportedError') return;
          if (e?.name === 'AbortError') return;
          console.log('Audio blocked', e);
        });
      }

      const resolvedType = incomingMsg.messageType || incomingMsg.type || 'text';
      const resolvedContent = incomingMsg.content ?? incomingMsg.text ?? '';
      const createdAt = incomingMsg.createdAt || new Date().toISOString();
      const senderName =
        typeof senderRaw === 'object' && senderRaw?.fullName
          ? senderRaw.fullName
          : undefined;

      const formatted: MessageType = {
        id: incomingMsg._id || incomingMsg.id || `socket-${Date.now()}`,
        type: ['text', 'audio', 'file', 'image', 'video', 'call_summary'].includes(resolvedType) ? resolvedType as MessageType['type'] : 'text',
        content: resolvedContent || incomingMsg.attachments?.[0]?.fileUrl || '',
        fileUrl: incomingMsg.attachments?.[0]?.fileUrl || (['image', 'video', 'file'].includes(resolvedType) ? resolvedContent : undefined),
        fileName: extractFileName(incomingMsg.attachments?.[0]?.fileUrl),
        fileSize: formatFileSize(incomingMsg.attachments?.[0]?.fileSize),
        time: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMine: false,
        status: 'delivered',
        replyTo: incomingMsg.replyTo,
        senderName,
      };

      // Functional state update avoids stale closure issues
      setMessages((prev) => {
        if (prev.some(m => m.id === formatted.id)) return prev;
        return [...prev, formatted];
      });
    };

    const handleMessageDeleted = ({ messageId, type }: { messageId: string, type: string }) => {
      if (!setMessages) return;
      if (type === 'everyone') {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    };

    const handleMessageEdited = ({ messageId, content }: { messageId: string, content: string }) => {
      if (!setMessages) return;
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, isEdited: true } : m));
    };

    const handleMessagePinned = ({ messageId, isPinned }: { messageId: string, isPinned: boolean }) => {
      if (!setMessages) return;
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned } : m));
    };

    const handleMessageReacted = ({ messageId, reactions }: { messageId: string, reactions: any[] }) => {
      if (!setMessages) return;
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    const handleMessageDelivered = ({ chatId, messageId }: { chatId: string; messageId?: string }) => {
      if (!setMessages) return;
      if (String(chatId) !== String(activeChatId)) return;
      setMessages((prev) => prev.map((m) => {
        if (!m.isMine) return m;
        if (messageId && m.id !== messageId) return m;
        return m.status === 'read' ? m : { ...m, status: 'delivered', isPending: false };
      }));
    };

    const handleMessagesRead = ({ chatId, readBy }: { chatId: string; readBy?: string }) => {
      if (!setMessages) return;
      if (String(chatId) !== String(activeChatId)) return;
      // Ignore when we marked incoming messages read ΓÇö only the other party reading our sends updates ticks
      if (readBy && String(readBy) === String(currentUser._id)) return;
      setMessages((prev) => prev.map((m) => (
        m.isMine ? { ...m, status: 'read', isPending: false } : m
      )));
    };

    // Canonical event only (avoid double-fires)
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messagePinned', handleMessagePinned);
    socket.on('messageReacted', handleMessageReacted);
    socket.on('messageDelivered', handleMessageDelivered);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('messages-read', handleMessagesRead);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messagePinned', handleMessagePinned);
      socket.off('messageReacted', handleMessageReacted);
      socket.off('messageDelivered', handleMessageDelivered);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('messages-read', handleMessagesRead);
    };
  }, [socket, setMessages, activeChatId]);

  useEffect(() => {
    if (!socket || !activeChatId || !messages.length) return;
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    const hasUnreadFromOther = messages.some((m) => !m.isMine && m.status !== 'read');
    if (!hasUnreadFromOther) return;
    socket.emit('markAsRead', { chatId: activeChatId, userId: currentUser._id });
  }, [socket, setMessages, activeChatId, currentUser._id]);

  const handleRecordingComplete = (blob: Blob, durationSeconds: number) => {
    setVoiceBlob(blob);
    setVoiceDuration(durationSeconds);
    const url = URL.createObjectURL(blob);
    setVoiceUrl(url);
    setIsRecordingVoice(false);
  };

  const handleSendMessage = async () => {
    if (cannotReply) {
      toast.error(blockedByMe ? 'You blocked this user.' : 'You cannot reply to this conversation.');
      return;
    }
    // 1. Handle Voice Message Send
    if (voiceBlob) {
      const audioBlob = voiceBlob;
      setVoiceBlob(null);
      setVoiceUrl(null);
      setIsRecordingVoice(false);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-message.webm');
      formData.append('messageType', 'audio');
      formData.append('duration', voiceDuration.toString());
      if (replyingTo) {
        formData.append('replyTo', replyingTo.id);
      }

      try {
        toast.loading("Sending voice message...", { id: 'voice' });
        const response = await axiosInstance.post(`/chats/${chatId}/audio`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success("Voice message sent", { id: 'voice' });

        const saved = response.data.data.message;
        const formatted: MessageType = {
          id: saved._id,
          type: 'audio',
          content: saved.content,
          duration: voiceDuration,
          time: new Date(saved.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMine: true,
          status: saved.status || 'sent'
        };

        if (setMessages) {
          setMessages(prev => [...prev, formatted]);
        }

        if (socket) {
          socket.emit('send_message', { chatId, ...saved });
        }
        setReplyingTo(null);
      } catch {
        toast.error("Failed to send voice message", { id: 'voice' });
      }
      return;
    }

    // 2. Handle Text Message Send
    if (!inputText.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const newMsg: MessageType = {
      id: tempId,
      type: 'text',
      content: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
      isPending: true,
      status: 'sending',
      replyTo: replyingTo
    };

    if (setMessages) {
      setMessages(prev => [...prev, newMsg]);
    }
    const textToSend = inputText;
    setInputText('');
    setShowEmojiPicker(false);

    try {
      const response = await axiosInstance.post(`/chats/${chatId}/send`, {
        content: textToSend,
        type: 'text',
        replyTo: replyingTo?.id
      });

      const saved = response.data.data.message;
      if (setMessages) {
        setMessages(prev => prev.map(m => m.id === tempId ? {
          id: saved._id,
          type: 'text',
          content: saved.content,
          time: new Date(saved.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMine: true,
          isPending: false,
          status: saved.status || 'sent',
          replyTo: saved.replyTo
        } : m));
      }

      if (socket) {
        socket.emit('send_message', {
          chatId,
          content: saved.content,
          messageType: 'text',
          _id: saved._id,
          createdAt: saved.createdAt,
          senderId: saved.senderId,
          replyTo: saved.replyTo
        });
      }
      setReplyingTo(null);
    } catch (error: any) {
      console.log('Text Message Send Error:', error?.response?.data || error);
      toast.error("Failed to send message");
      if (setMessages) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    }
  };

  const submitEditMessage = async () => {
    if (!editingText.trim() || !editingMessageId) return;

    try {
      await axiosInstance.put(`/messages/${editingMessageId}/edit`, { content: editingText.trim() });
      if (setMessages) {
        setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: editingText.trim(), isEdited: true } : m));
      }
      setEditingMessageId(null);
      setEditingText('');
      toast.success("Message edited");
    } catch (error) {
      toast.error("Failed to edit message");
    }
  };

  const deleteMessage = async (messageId: string, type: 'me' | 'everyone') => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`, { data: { type } });
      if (setMessages) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
      setActiveMessageMenu(null);
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleCopy = async (content: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          toast.error("Failed to copy");
          return;
        } finally {
          textArea.remove();
        }
      }
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy");
    } finally {
      setActiveMessageMenu(null);
    }
  };

  const handleReply = (msg: MessageType) => {
    setReplyingTo(msg);
    setActiveMessageMenu(null);
  };

  const handleForward = (msg: MessageType) => {
    setForwardingMessage(msg);
    setActiveMessageMenu(null);
  };

  const handleForwardMessage = async (targetChatId: string, message: MessageType) => {
    try {
      const payload = {
        chatId: targetChatId,
        content: message.content,
        messageType: message.type,
        isForwarded: true,
        audioUrl: message.type === 'audio' ? message.fileUrl : undefined,
        duration: message.duration,
        attachments: message.fileUrl && message.type !== 'audio'
          ? [{ fileUrl: message.fileUrl, fileType: message.type, fileSize: message.fileSize ? parseFloat(message.fileSize) : 0 }]
          : []
      };

      const response = await axiosInstance.post(`/chats/${targetChatId}/send`, payload);

      // If the target chat is currently open, instantly show the new message
      if (targetChatId === chatId && setMessages) {
        const newMsgData = response.data?.data?.message || response.data?.message || response.data;
        const newMsg: MessageType = {
          id: newMsgData._id,
          type: newMsgData.messageType || 'text',
          content: newMsgData.content || newMsgData.attachments?.[0]?.fileUrl || '',
          fileUrl: newMsgData.attachments?.[0]?.fileUrl || newMsgData.audioUrl,
          fileName: extractFileName(newMsgData.attachments?.[0]?.fileUrl),
          fileSize: formatFileSize(newMsgData.attachments?.[0]?.fileSize),
          time: new Date(newMsgData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMine: true,
          status: 'sent',
          isForwarded: true
        };
        setMessages(prev => [...prev, newMsg]);
      }

      toast.success('Message forwarded');
    } catch (error: any) {
      console.error('Error forwarding message:', error.response?.data || error.message);
      toast.error('Failed to forward message');
    }
  };

  const handleGenerateSmartReplies = async () => {
    setLoadingReplies(true);
    setSmartReplies([]);
    try {
      const res = await axiosInstance.post('/api/ai/chat/generate-reply', { chatId }, { timeout: 60000 });
      if (res.data?.status === 'success' && Array.isArray(res.data?.data)) {
        setSmartReplies(res.data.data);
      } else {
        toast.error("Could not generate replies. Please try again.");
      }
    } catch (err: any) {
      console.error("Error generating smart replies:", err);
      toast.error(err.response?.data?.message || "Failed to generate smart replies.");
    } finally {
      setLoadingReplies(false);
      setActiveMessageMenu(null);
    }
  };

  const handleSendSmartReplyText = async (text: string) => {
    if (cannotReply) {
      toast.error(blockedByMe ? 'You blocked this user.' : 'You cannot reply to this conversation.');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const newMsg: MessageType = {
      id: tempId,
      type: 'text',
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
      isPending: true,
      status: 'sending',
    };

    if (setMessages) {
      setMessages(prev => [...prev, newMsg]);
    }

    try {
      const response = await axiosInstance.post(`/chats/${chatId}/send`, {
        content: text,
        type: 'text',
      });

      const saved = response.data.data.message;
      if (setMessages) {
        setMessages(prev => prev.map(m => m.id === tempId ? {
          id: saved._id,
          type: 'text',
          content: saved.content,
          time: new Date(saved.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMine: true,
          isPending: false,
          status: saved.status || 'sent',
        } : m));
      }

      if (socket) {
        socket.emit('send_message', {
          chatId,
          content: saved.content,
          messageType: 'text',
          _id: saved._id,
          createdAt: saved.createdAt,
          senderId: saved.senderId,
        });
      }
    } catch (error: any) {
      console.log('Smart Reply Send Error:', error?.response?.data || error);
      toast.error("Failed to send smart reply");
      if (setMessages) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    }
  };

  const handleTranslateMessage = async (msg: MessageType) => {
    if (!msg.content) return;
    setTranslatingMessageId(msg.id);
    setActiveMessageMenu(null);
    try {
      const isArabic = /[\u0600-\u06FF]/.test(msg.content);
      const targetLang = isArabic ? 'en' : 'ar';
      const res = await axiosInstance.post('/api/ai/chat/translate', { text: msg.content, targetLang }, { timeout: 60000 });
      if (res.data?.status === 'success' && res.data?.data) {
        setTranslatedMessages(prev => ({
          ...prev,
          [msg.id]: {
            translatedText: res.data.data,
            originalText: msg.content || ''
          }
        }));
      } else {
        toast.error("Failed to translate message.");
      }
    } catch (err: any) {
      console.error("Error translating message:", err);
      toast.error(err.response?.data?.message || "Failed to translate message.");
    } finally {
      setTranslatingMessageId(null);
    }
  };

  const handlePin = async (messageId: string) => {
    try {
      await axiosInstance.put(`/messages/${messageId}/pin`);
      setActiveMessageMenu(null);
    } catch (error) {
      toast.error("Failed to pin message");
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await axiosInstance.post(`/messages/${messageId}/react`, { emoji });
      setActiveMessageMenu(null);
      setShowReactionPicker(false);
    } catch (error) {
      toast.error("Failed to react to message");
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const uploadFileToServer = async (file: File) => {
    if (cannotReply) {
      toast.error(blockedByMe ? 'You blocked this user.' : 'You cannot reply to this conversation.');
      return;
    }
    const formData = new FormData();
    formData.append('document', file);
    formData.append('messageType', 'file');
    if (replyingTo) {
      formData.append('replyTo', replyingTo.id);
    }

    try {
      toast.loading("Uploading file...", { id: 'upload' });
      const response = await axiosInstance.post(`/chats/${chatId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success("File sent", { id: 'upload' });

      const saved = response.data.data.message;
      const formatted: MessageType = {
        id: saved._id,
        type: saved.messageType as any || 'file',
        content: saved.content || saved.attachments?.[0]?.fileUrl || '',
        fileUrl: saved.attachments?.[0]?.fileUrl || saved.content || '',
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        time: new Date(saved.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMine: true,
        status: saved.status || 'sent',
        replyTo: saved.replyTo
      };

      if (setMessages) {
        setMessages(prev => [...prev, formatted]);
      }
      setReplyingTo(null);
    } catch (error: any) {
      console.log('File Upload Error:', error?.response?.data || error);
      toast.error("Failed to upload file", { id: 'upload' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileToServer(file);
      setShowAttachmentMenu(false);
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  const handleCall = async (type: 'voice' | 'video') => {
    if (!isGroup && cannotReply) {
      toast.error(blockedByMe ? 'You blocked this user.' : 'You cannot call this user.');
      return;
    }
    try {
      if (isGroup) {
        await callGroup(chatId, chatName, type);
      } else {
        await callUser(receiverId || chatId, chatName, type, undefined, chatId);
      }
    } catch (error: unknown) {
      toast.error("Call failed to initiate");
    }
  };

  const handleAddUserToGroup = async (userId: string) => {
    try {
      await axiosInstance.post(`/chats/group/${chatId}/members`, { userId });
      toast.success("Member added to group");
      setShowAddMemberModal(false);
      setUserSearchQuery("");
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to add member";
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex-1 flex min-w-0 h-full">
      <main className="flex-1 flex flex-col bg-[#FAFAFA] dark:bg-[#171717] min-h-0 min-w-0 transition-colors duration-300 relative">
        <header
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('button')) {
              if (isGroup && onOpenGroupDetails) {
                onOpenGroupDetails();
                return;
              }
              setShowUserDetails(true);
              setActiveSidePanel('details');
            }
          }}
          className="relative z-[100] h-16 px-4 bg-white/80 dark:bg-[#262626]/80 backdrop-blur-md flex items-center justify-between border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 shrink-0 transition-colors"
        >
          <div className="flex items-center min-w-0 gap-2">
            {!isChatListOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenChatList?.(); }}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors shrink-0"
                title="Exit Focus Mode"
              >
                <span className="material-icons text-[22px]">arrow_back</span>
              </button>
            )}
            <div className="flex flex-col min-w-0">
              <h2 className="text-[#171717] dark:text-[#F5F5F5] font-bold text-base truncate">{chatName || 'Unknown Chat'}</h2>
              {isGroup ? (
                <span className="text-gray-500 dark:text-gray-400 text-xs truncate">
                  {formatGroupMemberLabel(groupMembers)}
                </span>
              ) : (
                (isOnline && showOnlineStatus) && <span className="text-[#7C3AED] dark:text-[#8B5CF6] text-xs font-medium">Online</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500 shrink-0">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isGroup && blockedByMe) {
                    toast.error("You have blocked this user. Unblock them to start a call.");
                    return;
                  }
                  handleCall('video');
                }}
                className={`px-2.5 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-[#7C3AED] transition-colors ${!isGroup && blockedByMe ? 'opacity-40' : ''}`}
              >
                <span className="material-icons-round text-[20px]">videocam</span>
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"></div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isGroup && blockedByMe) {
                    toast.error("You have blocked this user. Unblock them to start a call.");
                    return;
                  }
                  handleCall('voice');
                }}
                className={`px-1 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-[#7C3AED] transition-colors ${!isGroup && blockedByMe ? 'opacity-40' : ''}`}
              >
                <span className="material-icons-round text-[18px]">call</span>
              </button>
            </div>

            {/* 3-Dots Header Menu ΓÇö high z-index so message rows never paint over */}
            <div className="relative z-[110] header-menu-container">
              <button
                onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>

              {showHeaderMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-gray-800 shadow-lg ring-1 ring-black/20 py-2 z-[120]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowHeaderMenu(false);
                      if (isGroup && onOpenGroupDetails) {
                        onOpenGroupDetails();
                      } else if (isGroup) {
                        navigate(`/groups/${chatId}`);
                      } else if (receiverId && onOpenProfile) {
                        onOpenProfile(receiverId);
                      } else {
                        toast.error('Could not open contact profile.');
                      }
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M20 21a8 8 0 1 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                    {isGroup ? 'Group Details' : 'View Profile'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHeaderMenu(false);
                      setShowUserDetails(true);
                      setActiveSidePanel('search');
                      onChatSearchOpenChange?.(true);
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20l-3.5-3.5" />
                    </svg>
                    Search
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHeaderMenu(false);
                      setShowUserDetails(false);
                      setActiveSidePanel(null);
                      if (onOpenSharedMedia) {
                        onOpenSharedMedia();
                      } else {
                        toast.error('Shared media panel is available in your chats list.');
                      }
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="4" y="5" width="16" height="14" rx="2" />
                      <path d="M8 11l2.5 2.5L14 10l6 6" />
                      <path d="M9 9h.01" />
                    </svg>
                    Media, Links, and Docs
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHeaderMenu(false);
                      handleMuteChat();
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    {isMuted ? (
                      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Z" />
                        <path d="M18 16V11a6 6 0 1 0-12 0v5" />
                        <path d="M5 16h14" />
                        <path d="M19 8l2 2" />
                        <path d="M21 8l-2 2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Z" />
                        <path d="M18 16V11a6 6 0 1 0-12 0v5" />
                        <path d="M5 16h14" />
                        <path d="M4 4l16 16" />
                      </svg>
                    )}
                    {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                  </button>

                  {onCloseChat && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHeaderMenu(false);
                        onCloseChat();
                      }}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <span className="material-icons-round text-[18px] text-gray-400">close</span>
                      Close Chat
                    </button>
                  )}

                  <div className="h-px bg-gray-100 dark:bg-gray-700/50 my-1"></div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHeaderMenu(false);
                      handleClearChat();
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 16h10l1-16" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    Clear Chat
                  </button>

                  {!isGroup && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHeaderMenu(false);
                        handleBlockUser();
                      }}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M7 7l10 10" />
                      </svg>
                      {blockedByMe ? 'Unblock User' : 'Block User'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {messages.find(m => m.isPinned) && (
          <div className="bg-white/95 dark:bg-[#262626]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between shadow-sm z-10 shrink-0 sticky top-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-icons-round text-[#7C3AED] text-[18px] shrink-0">push_pin</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[#7C3AED] font-bold text-[11px] uppercase tracking-wide">Pinned Message</span>
                <span className="text-[#171717] dark:text-[#F5F5F5] text-sm truncate font-medium">
                  {messages.find(m => m.isPinned)?.content || 'Media Message'}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const pinnedMsg = messages.find(m => m.isPinned);
                if (pinnedMsg) handlePin(pinnedMsg.id);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0 p-1"
            >
              <span className="material-icons-round text-[18px]">close</span>
            </button>
          </div>
        )}

        <div className="relative flex-1 overflow-y-auto hide-scrollbar p-6 space-y-4">
          <div className="flex justify-center my-4">
            <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Today</span>
          </div>

          {messages.map((msg) => (
            <div id={`msg-${msg.id}`} key={msg.id} className={`group flex flex-col w-full mb-2 ${msg.isMine ? 'items-end' : 'items-start'} transition-colors duration-500 rounded-xl`}>
              <div className="relative max-w-[85%] flex flex-col">
                {msg.isPinned && (
                  <div className={`text-[10px] text-[#7C3AED] flex items-center gap-1 mb-1 ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                    <span className="material-icons-round text-[10px]">push_pin</span> Pinned
                  </div>
                )}
                {isGroup && !msg.isDeletedForEveryone && (
                  <span
                    className={`text-xs font-semibold mb-0.5 px-0.5 ${msg.isMine
                        ? 'text-[#7C3AED] dark:text-[#8B5CF6] self-end'
                        : 'text-gray-500 dark:text-gray-400 self-start'
                      }`}
                  >
                    {msg.isMine ? 'You' : (msg.senderName || 'Member')}
                  </span>
                )}
                {msg.isDeletedForEveryone ? (
                  <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 italic rounded-xl p-3 text-sm flex items-center gap-2">
                    <span className="material-icons-round text-sm">block</span>
                    This message was deleted
                  </div>
                ) : (
                  <>
                    {msg.isForwarded && (
                      <div className={`text-[10px] text-gray-500 flex items-center gap-1 mb-0.5 ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                        <span className="material-icons-round text-[10px]">forward</span> Forwarded
                      </div>
                    )}
                    {msg.type === 'text' ? (
                      <div className={`relative ${msg.isMine ? 'bg-[#7C3AED] text-white rounded-tr-none' : 'bg-white dark:bg-[#262626] text-[#171717] dark:text-[#F5F5F5] border border-gray-200 dark:border-gray-800 rounded-tl-none'} rounded-xl p-3 pr-10 shadow-sm ${msg.isPending ? 'opacity-70' : ''}`}>
                        {editingMessageId === msg.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              className="text-[#171717] px-2 py-1 rounded text-sm min-w-[200px]"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') submitEditMessage();
                                if (e.key === 'Escape') setEditingMessageId(null);
                              }}
                            />
                            <div className="flex justify-end gap-2 text-xs">
                              <button onClick={() => setEditingMessageId(null)} className="text-gray-200 hover:text-white">Cancel</button>
                              <button onClick={submitEditMessage} className="font-bold hover:text-green-300">Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.replyTo && (
                              <div
                                onClick={() => { const el = document.getElementById(`msg-${msg.replyTo._id || msg.replyTo.id}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.classList.add('bg-gray-200', 'dark:bg-gray-800'); setTimeout(() => el?.classList.remove('bg-gray-200', 'dark:bg-gray-800'), 1500); }}
                                className={`mb-2 pl-3 border-l-4 rounded-r bg-black/5 dark:bg-black/20 p-2 cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-black/30 ${msg.isMine ? 'border-white/50 text-white/90' : 'border-[#7C3AED] text-[#171717] dark:text-[#F5F5F5]'} text-xs overflow-hidden max-w-full`}
                              >
                                <div className={`font-bold mb-0.5 ${msg.isMine ? 'text-white' : 'text-[#7C3AED] dark:text-[#8B5CF6]'}`}>{msg.replyTo.senderId?.fullName || 'User'}</div>
                                <div className="opacity-80">
                                  {(() => {
                                    const fileContent = typeof msg.replyTo.content === 'string' ? msg.replyTo.content : '';
                                    const isImage = msg.replyTo.messageType === 'image' || msg.replyTo.attachments?.[0]?.fileType?.startsWith('image/') || fileContent.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                    const isAudio = msg.replyTo.messageType === 'audio' || fileContent.match(/\.(webm|mp3|wav|ogg)$/i);
                                    const isDoc = msg.replyTo.messageType === 'file' || msg.replyTo.messageType === 'document' || fileContent.match(/\.(pdf|doc|docx|txt|zip|rar)$/i);

                                    if (isImage) {
                                      const rawUrl = msg.replyTo.attachments?.[0]?.fileUrl || (fileContent.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? fileContent : null);
                                      const fullUrl = resolveChatMediaUrl(rawUrl || undefined);
                                      return (
                                        <div className="flex items-center gap-2 mt-1">
                                          {fullUrl && (
                                            <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-black/10 dark:bg-white/10">
                                              <img src={fullUrl} alt="thumb" className="w-full h-full object-cover" />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    if (isAudio) return <span className="truncate block">≡ƒÄñ Voice Message</span>;

                                    if (isDoc) {
                                      return (
                                        <span className="inline-flex items-center gap-1 align-middle truncate max-w-full">
                                          <span>≡ƒôä Document</span>
                                        </span>
                                      );
                                    }

                                    return <span className="truncate block">{fileContent || 'Media Message'}</span>;
                                  })()}
                                </div>
                              </div>
                            )}
                            {translatingMessageId === msg.id ? (
                              <div className="flex items-center gap-2 text-xs py-1 opacity-75">
                                <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="italic">Translating...</span>
                              </div>
                            ) : translatedMessages[msg.id] ? (
                              <div className="space-y-1">
                                <p className="text-xs opacity-75 flex items-center gap-1 font-medium">
                                  <span className="material-icons-round text-[10px]">g_translate</span> Translated
                                </p>
                                <p className="text-sm leading-relaxed">{translatedMessages[msg.id].translatedText}</p>
                                <button
                                  onClick={() => {
                                    setTranslatedMessages(prev => {
                                      const copy = { ...prev };
                                      delete copy[msg.id];
                                      return copy;
                                    });
                                  }}
                                  className="text-[10px] underline block hover:opacity-80 transition-opacity mt-1"
                                >
                                  Show Original / ╪╣╪▒╪╢ ╪º┘ä╪ú╪╡┘ä┘è
                                </button>
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                            )}
                          </>
                        )}
                        <div className={`flex justify-end items-center gap-1 mt-1 ${msg.isMine ? 'text-white/80' : 'text-gray-400'}`}>
                          <span className="text-[10px]">{msg.time}</span>
                          {msg.isEdited && <span className="text-[10px] italic">Edited</span>}
                          {msg.isMine && (
                            <span className={`material-icons text-[12px] ${msg.status === 'read' ? 'text-blue-300' : ''}`}>
                              {msg.isPending || msg.status === 'sending'
                                ? 'schedule'
                                : (msg.status === 'sent' ? 'done' : 'done_all')}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-800 rounded-xl rounded-tl-none p-2 pr-10 shadow-sm">
                        {msg.replyTo && (
                          <div
                            onClick={() => { const el = document.getElementById(`msg-${msg.replyTo._id || msg.replyTo.id}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.classList.add('bg-gray-200', 'dark:bg-gray-800'); setTimeout(() => el?.classList.remove('bg-gray-200', 'dark:bg-gray-800'), 1500); }}
                            className={`mb-2 pl-3 border-l-4 rounded-r bg-black/5 dark:bg-black/20 p-2 cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-black/30 border-[#7C3AED] text-[#171717] dark:text-[#F5F5F5] text-xs overflow-hidden max-w-full`}
                          >
                            <div className={`font-bold mb-0.5 text-[#7C3AED] dark:text-[#8B5CF6]`}>{msg.replyTo.senderId?.fullName || 'User'}</div>
                            <div className="opacity-80">
                              {(() => {
                                const fileContent = typeof msg.replyTo.content === 'string' ? msg.replyTo.content : '';
                                const isImage = msg.replyTo.messageType === 'image' || msg.replyTo.attachments?.[0]?.fileType?.startsWith('image/') || fileContent.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                const isAudio = msg.replyTo.messageType === 'audio' || fileContent.match(/\.(webm|mp3|wav|ogg)$/i);
                                const isDoc = msg.replyTo.messageType === 'file' || msg.replyTo.messageType === 'document' || fileContent.match(/\.(pdf|doc|docx|txt|zip|rar)$/i);

                                if (isImage) {
                                  const rawUrl = msg.replyTo.attachments?.[0]?.fileUrl || (fileContent.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? fileContent : null);
                                  const fullUrl = resolveChatMediaUrl(rawUrl || undefined);
                                  return (
                                    <div className="flex items-center gap-2 mt-1">
                                      {fullUrl && (
                                        <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-black/10 dark:bg-white/10">
                                          <img src={fullUrl} alt="thumb" className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                if (isAudio) return <span className="truncate block">≡ƒÄñ Voice Message</span>;

                                if (isDoc) {
                                  return (
                                    <span className="inline-flex items-center gap-1 align-middle truncate max-w-full">
                                      <span>≡ƒôä Document</span>
                                    </span>
                                  );
                                }

                                return <span className="truncate block">{fileContent || 'Media Message'}</span>;
                              })()}
                            </div>
                          </div>
                        )}
                        {msg.type === 'audio' ? (
                          <div className="flex flex-col">
                            <audio controls controlsList="nodownload noplaybackrate" src={resolveChatMediaUrl(msg?.content || msg?.fileUrl || undefined)} className="max-w-[200px] h-10 mb-1 [&::-webkit-media-controls-enclosure]:rounded-md [&::-webkit-media-controls-panel]:bg-gray-100 dark:[&::-webkit-media-controls-panel]:bg-gray-800 [&::-webkit-media-controls-overflow-button]:hidden" />
                            {msg.duration !== undefined && <span className="text-[10px] text-gray-400 text-right">{Math.floor(msg.duration / 60)}:{(msg.duration % 60).toString().padStart(2, '0')}</span>}
                          </div>
                        ) : (
                          (() => {
                            const fileUrl = msg?.fileUrl || msg?.content;
                            const fullUrl = resolveChatMediaUrl(fileUrl || undefined) || '#';
                            const isImage = msg?.type === 'image' || msg?.fileName?.match(/\.(jpeg|jpg|gif|png|webp)$/i) || fileUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i);

                            return (
                              <div
                                onClick={() => {
                                  if (isImage) {
                                    setViewingFile({ url: fullUrl, type: 'image' });
                                  } else {
                                    const downloadUrl = getDownloadUrl(fullUrl);
                                    const link = document.createElement('a');
                                    link.href = downloadUrl;
                                    link.setAttribute('download', msg?.fileName || 'Attachment');
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }
                                }}
                                className="block rounded-lg overflow-hidden mb-2 hover:opacity-90 transition-opacity cursor-pointer"
                              >
                                {isImage ? (
                                  <img src={fullUrl} alt={msg?.fileName || 'Attachment'} className="max-w-xs max-h-64 object-cover rounded-lg" />
                                ) : (
                                  <div className="bg-[#FAFAFA] dark:bg-[#171717] p-4 flex items-center gap-3 border border-gray-200 dark:border-gray-800">
                                    <div className="w-10 h-10 bg-white dark:bg-[#262626] rounded flex items-center justify-center border border-gray-200 dark:border-gray-800">
                                      <span className="material-icons text-[#7C3AED]">description</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[#171717] dark:text-[#F5F5F5] text-sm font-medium">{msg?.fileName || 'Attachment'}</span>
                                      {msg?.fileSize && <span className="text-gray-400 text-[10px]">{msg?.fileSize}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                        <span className="block text-right text-[10px] text-gray-400">{msg?.time}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Message Context Menu */}
                {!msg.isDeletedForEveryone && (
                  <div
                    className={`message-context-menu absolute top-1.5 right-1.5 transition-opacity duration-150 ${activeMessageMenu === msg.id ? 'z-[9999] opacity-100' : 'z-10 opacity-0 group-hover:opacity-100'
                      }`}
                  >
                    <button
                      type="button"
                      ref={activeMessageMenu === msg.id ? buttonRef : undefined}
                      onClick={(e) => handleOpenMessageMenu(msg.id, e)}
                      className={`p-1 rounded-full transition-colors ${msg.type === 'text' && msg.isMine ? 'text-white/80 hover:bg-white/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#7C3AED]'}`}
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                      </svg>
                    </button>
                    {activeMessageMenu === msg.id && (
                      <div
                        className={`w-48 overflow-hidden shadow-lg bg-white dark:bg-[#262626] rounded-md border border-gray-200 dark:border-gray-800 ${msg.isMine
                            ? dropdownDirection === 'up'
                              ? 'absolute right-0 bottom-full mb-1 z-[9999]'
                              : 'absolute right-0 top-full mt-1 z-[9999]'
                            : dropdownDirection === 'up'
                              ? 'absolute left-0 bottom-full mb-1 z-[9999]'
                              : 'absolute left-0 top-full mt-1 z-[9999]'
                          }`}
                      >
                        <button onClick={() => handleReply(msg)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
                          <span className="material-icons-round text-[18px]">reply</span> Reply
                        </button>
                        {msg.type === 'text' && (
                          <button onClick={() => handleCopy(msg.content || '')} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
                            <span className="material-icons-round text-[18px]">content_copy</span> Copy
                          </button>
                        )}
                        <button onClick={() => handleForward(msg)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
                          <span className="material-icons-round text-[18px]">forward</span> Forward
                        </button>
                        <button onClick={() => handlePin(msg.id)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
                          <span className="material-icons-round text-[18px]">push_pin</span> {msg.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        {msg.type === 'text' && (
                          <button onClick={() => handleTranslateMessage(msg)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
                            <span className="material-icons-round text-[18px]">g_translate</span> Translate
                          </button>
                        )}
                        {!msg.isMine && (
                          <button onClick={handleGenerateSmartReplies} className="w-full text-left px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-[#7C3AED] dark:text-[#a78bfa] flex items-center gap-2 font-semibold">
                            <span>💡</span> Smart Replies
                          </button>
                        )}
                        <div className="relative">
                          <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#171717] cursor-pointer">
                            <span
                              className="material-icons-round text-[18px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowReactionPicker(!showReactionPicker);
                              }}
                            >
                              add_reaction
                            </span>
                            <div className="flex gap-2">
                              {['👍', '❤️', '😂', '🔥', '🎉'].map(emoji => (
                                <button key={emoji} onClick={() => { handleReact(msg.id, emoji); setShowReactionPicker(false); }} className="hover:scale-125 transition-transform">{emoji}</button>
                              ))}
                            </div>
                          </div>
                          {showReactionPicker && (
                            <div
                              className={`absolute z-[10000] shadow-2xl rounded-2xl overflow-hidden ${msg.isMine ? 'right-0' : 'left-0'
                                } ${dropdownDirection === 'up' ? 'top-full mt-2' : 'bottom-full mb-2'}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <EmojiPicker onEmojiClick={(emojiData) => {
                                handleReact(msg.id, emojiData.emoji);
                                setShowReactionPicker(false);
                              }} />
                            </div>
                          )}
                        </div>
                        {msg.isMine && msg.type === 'text' && (
                          <button
                            onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.content || ''); setActiveMessageMenu(null); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2"
                          >
                            <span className="material-icons-round text-[18px]">edit</span> Edit
                          </button>
                        )}
                        <button
                          onClick={() => deleteMessage(msg.id, 'me')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2"
                        >
                          <span className="material-icons-round text-[18px]">delete</span> Delete for me
                        </button>
                        {msg.isMine && (
                          <button
                            onClick={() => deleteMessage(msg.id, 'everyone')}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 flex items-center gap-2"
                          >
                            <span className="material-icons-round text-[18px]">delete_forever</span> Delete for everyone
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {msg.reactions && msg.reactions.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                    {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                      const count = msg.reactions!.filter(r => r.emoji === emoji).length;
                      return (
                        <div key={emoji} onClick={() => handleReact(msg.id, emoji)} className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-xs rounded-full px-2 py-0.5 border border-white dark:border-[#171717] shadow-sm flex items-center gap-1 transition-colors">
                          <span>{emoji}</span>
                          <span className="text-[10px] text-gray-500 font-medium">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <footer className="p-4 bg-white dark:bg-[#262626] border-t border-gray-200 dark:border-gray-800 shrink-0 relative">
          {showEmojiPicker && (
            <div className="absolute bottom-20 right-4 z-50 shadow-2xl rounded-2xl overflow-hidden">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}

          {replyingTo && (
            <div className="max-w-4xl mx-auto mb-2 bg-[#FAFAFA] dark:bg-[#171717] border-l-4 border-[#7C3AED] rounded-r-xl p-3 flex justify-between items-center text-sm shadow-sm">
              <div className="flex flex-col min-w-0">
                <span className="text-[#7C3AED] font-bold text-xs">Replying to</span>
                <span className="text-gray-600 dark:text-gray-400 truncate">
                  {(() => {
                    const fileContent = typeof replyingTo.content === 'string' ? replyingTo.content : '';
                    const isImage = replyingTo.type === 'image' || fileContent.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                    const isAudio = replyingTo.type === 'audio' || fileContent.match(/\.(webm|mp3|wav|ogg)$/i);
                    const isDoc = replyingTo.type === 'file' || fileContent.match(/\.(pdf|doc|docx|txt|zip|rar)$/i);

                    if (isImage) {
                      return (
                        <span className="inline-flex items-center gap-1.5 align-middle">
                          <span>≡ƒô╖</span>
                          <span>Photo</span>
                        </span>
                      );
                    }

                    if (isAudio) return '≡ƒÄñ Voice Message';

                    if (isDoc) {
                      const rawName = replyingTo.fileName || fileContent.split('/').pop() || 'File';
                      return (
                        <span className="inline-flex items-center gap-1 align-middle truncate max-w-full">
                          <span>≡ƒôä Document</span>
                          <span className="opacity-70 truncate">- {rawName}</span>
                        </span>
                      );
                    }

                    return fileContent || 'Media Message';
                  })()}
                </span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-red-500 p-1">
                <span className="material-icons-round text-sm">close</span>
              </button>
            </div>
          )}

          {isGroupInviteView ? (
            <div className="max-w-md mx-auto py-8 px-6 text-center">
              <div className="w-16 h-16 bg-[#7C3AED]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#7C3AED]">
                <span className="material-icons-round text-3xl">mail</span>
              </div>
              <h3 className="text-lg font-bold text-[#171717] dark:text-[#F5F5F5] mb-2">
                Group Invitation
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                You have been invited to join <strong>{chatName}</strong>. Accept to see messages and participate.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void onAcceptGroupInvitation?.()}
                  className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3 rounded-xl font-bold transition-colors"
                >
                  Accept Invitation
                </button>
                <button
                  type="button"
                  onClick={() => void onDeclineGroupInvitation?.()}
                  className="w-full bg-red-50 dark:bg-red-500/10 text-red-500 py-3 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  Decline Invitation
                </button>
              </div>
            </div>
          ) : isChatInitiator && chatStatus === 'pending' ? (
            <div className="max-w-4xl mx-auto py-4 px-4 rounded-xl bg-[#7C3AED]/10 text-center text-sm text-[#7C3AED] border border-[#7C3AED]/20 font-medium">
              Request Sent... waiting for approval
            </div>
          ) : isChatRecipient && chatStatus === 'pending' ? (
            <div className="max-w-md mx-auto py-6 px-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <strong>{chatName}</strong> wants to message you.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => void onRespondToChatRequest?.('accept')}
                  className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold text-sm"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => void onRespondToChatRequest?.('reject')}
                  className="px-5 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (!isParticipant && isGroup) ? (
            <div className="max-w-4xl mx-auto py-4 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-center text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              You can't send messages to this group because you're no longer a participant.
            </div>
          ) : cannotReply && !isGroup ? (
            <div className="max-w-4xl mx-auto py-4 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-center text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              {blockedByMe ? 'You blocked this user. Unblock to send a message.' : 'You cannot reply to this conversation.'}
            </div>
          ) : (
            <>
              {/* Smart Replies Pills */}
              {(loadingReplies || smartReplies.length > 0) && (
                <div className="max-w-4xl mx-auto mb-3 bg-[#FAFAFA]/85 dark:bg-[#171717]/85 backdrop-blur-md border border-gray-200/80 dark:border-gray-800/80 rounded-2xl p-3 flex flex-col gap-2 shadow-sm relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#7C3AED] dark:text-[#a78bfa] uppercase tracking-wider flex items-center gap-1">
                      <span>≡ƒÆí</span> Smart Replies / ╪º┘é╪¬╪▒╪º╪¡╪º╪¬ ╪º┘ä╪▒╪»
                    </span>
                    <button
                      onClick={() => setSmartReplies([])}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                    >
                      <span className="material-icons-round text-sm">close</span>
                    </button>
                  </div>
                  {loadingReplies ? (
                    <div className="flex items-center gap-2 py-1 text-xs text-gray-500">
                      <svg className="animate-spin h-3.5 w-3.5 text-[#7C3AED]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Generating suggestions...</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {smartReplies.map((reply, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            handleSendSmartReplyText(reply);
                            setSmartReplies([]);
                          }}
                          className="px-3 py-1.5 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 text-[#7C3AED] dark:bg-[#7C3AED]/20 dark:hover:bg-[#7C3AED]/35 dark:text-purple-300 rounded-xl text-xs font-semibold border border-[#7C3AED]/20 hover:border-[#7C3AED]/30 transition-all active:scale-[0.97]"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {attachedFile && (
                <div className="max-w-4xl mx-auto mb-2 bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex justify-between items-center text-sm shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white dark:bg-[#262626] rounded flex items-center justify-center border border-gray-200 dark:border-gray-800 shrink-0">
                      <span className="material-icons text-[#7C3AED]">
                        {attachedFile.type.startsWith('image/') ? 'image' : attachedFile.type.startsWith('video/') ? 'videocam' : 'description'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[#171717] dark:text-[#F5F5F5] font-medium truncate">{attachedFile.name}</span>
                      <span className="text-gray-400 text-xs">{(attachedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setAttachedFile(null)} className="text-gray-400 hover:text-red-500 p-1 bg-white dark:bg-black rounded-full shadow-sm border border-gray-100 dark:border-gray-800">
                    <span className="material-icons-round text-sm">close</span>
                  </button>
                </div>
              )}

              <div className="max-w-4xl mx-auto flex items-end gap-4">
                <input type="file" ref={docInputRef} accept=".pdf,.doc,.docx,.txt" onChange={handleFileSelect} className="hidden" />
                <input type="file" ref={mediaInputRef} accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />

                <div className="relative attachment-menu-container">
                  <button
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className={`mb-2 transition-colors shrink-0 ${showAttachmentMenu ? 'text-[#7C3AED]' : 'text-gray-400 hover:text-[#7C3AED]'}`}
                  >
                    <span className="material-icons">attach_file</span>
                  </button>

                  {showAttachmentMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-[#262626] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50">
                      <button onClick={() => docInputRef.current?.click()} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-3 transition-colors">
                        <span className="material-icons text-[#7C3AED]">description</span>
                        Document
                      </button>
                      <button onClick={() => mediaInputRef.current?.click()} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-3 transition-colors">
                        <span className="material-icons text-[#EC4899]">image</span>
                        Photo & Video
                      </button>
                      <button onClick={() => { setShowAttachmentMenu(false); setShowCameraModal(true); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-3 transition-colors">
                        <span className="material-icons text-[#10B981]">photo_camera</span>
                        Camera
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-[#FAFAFA] dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-gray-700 flex items-center px-4 py-1.5 focus-within:border-[#7C3AED] transition-colors min-w-0 relative">
                  {isRecordingVoice ? (
                    <VoiceRecorder
                      onRecordingComplete={handleRecordingComplete}
                      onCancel={() => setIsRecordingVoice(false)}
                    />
                  ) : voiceUrl ? (
                    <div className="flex items-center w-full gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2 py-1">
                      <button onClick={() => { setVoiceBlob(null); setVoiceUrl(null); }} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Discard">
                        <span className="material-icons-round">delete</span>
                      </button>
                      <audio controls src={voiceUrl} className="h-8 flex-1" />
                    </div>
                  ) : (
                    <>
                      {showAiPopup && (
                        <div className="absolute bottom-[calc(100%+12px)] left-4 right-4 md:left-auto md:right-0 w-[calc(100%-2rem)] md:w-[440px] bg-white/95 dark:bg-[#131316]/98 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(124,58,237,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-white/[0.08] overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-200">
                          {/* Gradient Header Banner */}
                          <div className="bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#6366F1] p-4 text-white flex justify-between items-center relative overflow-hidden shadow-[0_4px_20px_rgba(124,58,237,0.25)] shrink-0">
                            {/* Mesh Overlay */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />

                            <div className="flex items-center gap-2.5 relative z-10">
                              <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <span className="material-icons-round text-lg animate-pulse text-yellow-300">bolt</span>
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-bold text-sm tracking-wide">Chat AI Assistant</span>
                                <span className="text-[10px] text-white/70 font-medium">Powered by Rabta AI</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowAiPopup(false)}
                              className="hover:bg-white/20 p-1.5 rounded-xl transition-all relative z-10 active:scale-90"
                            >
                              <span className="material-icons-round text-sm">close</span>
                            </button>
                          </div>

                          <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto hide-scrollbar">
                            {/* Scope Disclaimer */}
                            <div className="bg-[#7C3AED]/5 dark:bg-[#7C3AED]/10 text-purple-700 dark:text-purple-300 p-3.5 rounded-2xl text-xs leading-relaxed flex gap-3 border border-purple-500/10 dark:border-[#7C3AED]/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                              <span className="material-icons-round text-base text-[#7C3AED] dark:text-[#a78bfa] shrink-0 mt-0.5">smart_toy</span>
                              <p className="text-left font-medium">
                                I only summarize this conversation and search within its messages. For general questions, please use the <strong className="text-[#7C3AED] dark:text-[#a78bfa]">Global AI Guide</strong> in the sidebar.
                              </p>
                            </div>

                            {/* Segmented Tabs Bar */}
                            <div className="flex border border-gray-200/50 dark:border-white/[0.05] p-1 bg-gray-100/50 dark:bg-black/30 rounded-xl relative">
                              <button
                                onClick={() => setAiTab('summarize')}
                                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 ${aiTab === 'summarize'
                                    ? 'bg-white dark:bg-[#26262b] text-[#7C3AED] dark:text-[#a78bfa] shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 dark:border-white/[0.05]'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                  }`}
                              >
                                <span className="material-icons-round text-[14px]">summarize</span>
                                Summarize Chat
                              </button>
                              <button
                                onClick={() => setAiTab('search')}
                                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 ${aiTab === 'search'
                                    ? 'bg-white dark:bg-[#26262b] text-[#7C3AED] dark:text-[#a78bfa] shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-gray-100 dark:border-white/[0.05]'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                  }`}
                              >
                                <span className="material-icons-round text-[14px]">saved_search</span>
                                Smart Search
                              </button>
                            </div>

                            {/* Tab Content 1: Summarize */}
                            {aiTab === 'summarize' && (
                              <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    Summarize last:
                                  </label>
                                  <select
                                    value={summaryLimit}
                                    onChange={(e) => setSummaryLimit(e.target.value)}
                                    className="flex-1 bg-white/50 dark:bg-black/35 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25 transition-all font-medium cursor-pointer"
                                  >
                                    <option value={5}>5 Messages</option>
                                    <option value={10}>10 Messages</option>
                                    <option value={20}>20 Messages</option>
                                    <option value={50}>50 Messages</option>
                                    <option value="All">All Messages</option>
                                  </select>
                                  <button
                                    onClick={handleSummarizeChat}
                                    disabled={summarizing}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-[0_4px_12px_rgba(124,58,237,0.2)] active:scale-95"
                                  >
                                    {summarizing && (
                                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                    )}
                                    Summarize
                                  </button>
                                </div>

                                {/* Summary Error Warning */}
                                {summaryError && (
                                  <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 p-3.5 rounded-2xl text-xs flex gap-3 border border-amber-500/20 text-left">
                                    <span className="material-icons-round text-base text-amber-500 shrink-0">warning</span>
                                    <div>
                                      <h4 className="font-bold mb-0.5">Cannot Summarize</h4>
                                      <p className="font-medium leading-relaxed text-amber-700/90 dark:text-amber-300/90">{summaryError}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Summary Result Box */}
                                {summaryResult && (
                                  <div className="bg-white/45 dark:bg-black/20 rounded-2xl p-4 border border-gray-100 dark:border-white/[0.04] relative group text-start shadow-[inset_0_1px_3px_rgba(0,0,0,0.01)]">
                                    <div className="flex justify-between items-center mb-2.5 border-b border-gray-200/40 dark:border-white/[0.06] pb-2">
                                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Conversation Summary</span>
                                      <button
                                        onClick={() => handleCopy(summaryResult)}
                                        className="text-gray-400 hover:text-[#7C3AED] dark:hover:text-purple-400 p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                        title="Copy Summary"
                                      >
                                        <span className="material-icons-round text-sm">content_copy</span>
                                      </button>
                                    </div>
                                    <div dir="auto" className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin pr-1">
                                      {summaryResult}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Tab Content 2: Smart Search */}
                            {aiTab === 'search' && (
                              <div className="space-y-4">
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSmartSearch();
                                  }}
                                  className="flex gap-2.5"
                                >
                                  <input
                                    type="text"
                                    placeholder="Search past messages, details or files..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-white/50 dark:bg-black/35 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25 transition-all placeholder-gray-400 dark:placeholder-gray-500 font-medium"
                                  />
                                  <button
                                    type="submit"
                                    disabled={searching || !searchQuery.trim()}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-[0_4px_12px_rgba(124,58,237,0.2)] active:scale-95"
                                  >
                                    {searching && (
                                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                    )}
                                    Search
                                  </button>
                                </form>

                                {/* Search Result Box */}
                                {searchResult && (
                                  <div className="space-y-3.5 text-start animate-in fade-in slide-in-from-top-3 duration-255">
                                    <div className="bg-white/45 dark:bg-black/20 rounded-2xl p-4 border border-gray-100 dark:border-white/[0.04] shadow-[inset_0_1px_3px_rgba(0,0,0,0.01)]">
                                      <div className="flex justify-between items-center mb-2.5 border-b border-gray-200/40 dark:border-white/[0.06] pb-2">
                                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Search Answer</span>
                                        <button
                                          onClick={() => handleCopy(searchResult)}
                                          className="text-gray-400 hover:text-[#7C3AED] dark:hover:text-purple-400 p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                          title="Copy Answer"
                                        >
                                          <span className="material-icons-round text-sm">content_copy</span>
                                        </button>
                                      </div>
                                      <div dir="auto" className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin pr-1">
                                        {searchResult}
                                      </div>
                                    </div>

                                    {/* Redirect to Global AI Guide Button */}
                                    {searchFallback && (
                                      <button
                                        onClick={() => {
                                          setShowAiPopup(false);
                                          window.dispatchEvent(new CustomEvent('open-global-ai'));
                                        }}
                                        className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-[#7C3AED] dark:text-[#a78bfa] rounded-xl text-xs font-bold border border-indigo-500/20 dark:border-indigo-500/30 transition-all active:scale-[0.98] shadow-sm"
                                      >
                                        <span className="material-icons-round text-sm">assistant</span>
                                        Ask the Global AI Guide instead
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <textarea
                        disabled={cannotReply}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !cannotReply) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className={`w-full bg-transparent border-none focus:ring-0 text-sm py-2 resize-none text-[#171717] dark:text-[#F5F5F5] placeholder-gray-400 outline-none hide-scrollbar ${cannotReply ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder={
                          cannotReply
                            ? (blockedByMe ? 'You blocked this user.' : 'You cannot reply to this conversation.')
                            : 'Write a message...'
                        }
                        rows={1}
                      ></textarea>
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`ml-4 transition-colors shrink-0 ${showEmojiPicker ? 'text-[#7C3AED]' : 'text-gray-400 hover:text-[#7C3AED]'}`}
                      >
                        <span className="material-icons">sentiment_satisfied_alt</span>
                      </button>
                      <button
                        onClick={() => setShowAiPopup(!showAiPopup)}
                        className={`ml-4 transition-colors shrink-0 ${showAiPopup ? 'text-[#7C3AED]' : 'text-gray-400 hover:text-[#7C3AED]'}`}
                      >
                        <span className="material-icons-round">bolt</span>
                      </button>
                      <button
                        onClick={() => setIsRecordingVoice(true)}
                        className="ml-4 text-gray-400 hover:text-[#7C3AED] transition-colors shrink-0"
                      >
                        <span className="material-icons">mic</span>
                      </button>
                    </>
                  )}
                </div>

                {isGroup && (
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="bg-[#7C3AED]/10 text-[#7C3AED] w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#7C3AED]/20 transition-all shadow-sm shrink-0"
                    title="Create Post"
                  >
                    <span className="material-icons text-xl">add</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={cannotReply}
                  className={`bg-[#7C3AED] text-white w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-90 shadow-md shrink-0 ${cannotReply ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <span className="material-icons text-xl">send</span>
                </button>
              </div>
            </>
          )}
        </footer>
      </main>

      {showCreatePost && (
        <CreatePostModal
          isOpen={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          groupId={chatId}
          groupName={chatName}
          onPostSuccess={() => {
            setShowCreatePost(false);
            toast.success("Post shared in chat");
          }}
        />
      )}

      {showDetails && (
        <aside className="w-85 bg-white dark:bg-[#262626] border-l border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-300 relative z-10 shrink-0 h-full">
          {isGroup ? (
            <GroupDetails
              chatId={chatId}
              chatName={chatName}
              isPrivateGroup={isPrivateGroup}
              groupMembers={groupMembers}
              groupAdmins={groupAdmins}
              canAddMembers={canAddMembers}
              onClose={() => setShowDetails(false)}
              onAddMember={() => setShowAddMemberModal(true)}
              onLeaveGroup={() => setShowLeaveConfirmModal(true)}
              onSearchClick={() => {
                setShowDetails(false);
                onChatSearchOpenChange?.(true);
              }}
              onEditGroup={() => setShowEditGroupModal(true)}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
            />
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-6 pb-4 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 relative shrink-0">
                <button type="button" onClick={() => setShowDetails(false)} className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition-colors">
                  <span className="material-icons">close</span>
                </button>
                <h3 className="font-bold text-[#171717] dark:text-[#F5F5F5]">Contact Info</h3>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar p-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-4">
                    <div className="w-28 h-28 rounded-full bg-linear-to-tr from-[#7C3AED] to-[#ec4899] text-white flex items-center justify-center text-4xl font-bold shadow-lg">
                      {chatName.charAt(0)}
                    </div>
                    <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#10B981] border-4 border-white dark:border-[#262626] rounded-full"></div>
                  </div>
                  <h3 className="font-bold text-xl text-[#171717] dark:text-[#F5F5F5] text-center mb-1">{chatName}</h3>
                  <p className="text-sm text-gray-500 text-center">
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>

                <div className="flex justify-between items-center w-full px-2 mb-8">
                  <div
                    className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      setIsMuted(!isMuted);
                      toast.success(isMuted ? "Notifications unmuted" : "Notifications muted");
                    }}
                  >
                    <div className={`w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center ${isMuted ? 'text-[#7C3AED]' : 'text-gray-500 dark:text-gray-400'}`}>
                      <span className="material-icons-round">{isMuted ? 'notifications_off' : 'notifications'}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                  </div>

                  <div
                    className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      setShowDetails(false);
                      onChatSearchOpenChange?.(true);
                    }}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      <span className="material-icons-round">search</span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Search</span>
                  </div>
                </div>

                <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-2">About</h4>
                  <p className="text-sm text-[#171717] dark:text-[#F5F5F5] leading-relaxed">
                    Hey there! I am using Rabta.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      )}

      {(showUserDetails || !!isChatSearchOpen) && !showDetails && (
        <aside className="w-85 bg-white dark:bg-[#262626] border-l border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-300 relative z-10 shrink-0">
          <div className="p-6 pb-4 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 relative shrink-0">
            <button type="button" onClick={closeChatSidebar} className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition-colors">
              <span className="material-icons">close</span>
            </button>
            <h3 className="font-bold text-[#171717] dark:text-[#F5F5F5]">
              {activeSidePanel === 'details' ? (isGroup ? 'Group Info' : 'Contact Info') : 'Search Messages'}
            </h3>
            {activeSidePanel === 'details' ? (
              isGroup && (
                <button
                  onClick={() => setShowEditGroupModal(true)}
                  className="text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                >
                  <span className="material-icons-round text-xl">edit</span>
                </button>
              )
            ) : (
              <div className="w-6"></div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar p-6">
            {activeSidePanel === 'details' ? (
              isGroup ? (
                <GroupDetails
                  chatId={chatId}
                  chatName={chatName}
                  isPrivateGroup={isPrivateGroup}
                  groupMembers={groupMembers}
                  groupAdmins={groupAdmins}
                  canAddMembers={canAddMembers}
                  onClose={closeChatSidebar}
                  onAddMember={() => setShowAddMemberModal(true)}
                  onLeaveGroup={() => setShowLeaveConfirmModal(true)}
                  onSearchClick={() => {
                    setActiveSidePanel('search');
                    onChatSearchOpenChange?.(true);
                  }}
                  onEditGroup={() => setShowEditGroupModal(true)}
                  isMuted={isMuted}
                  onToggleMute={() => setIsMuted(!isMuted)}
                />
              ) : (
                <div className="flex flex-col">
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative mb-4">
                      <div className="w-28 h-28 rounded-full bg-linear-to-tr from-[#7C3AED] to-[#ec4899] text-white flex items-center justify-center text-4xl font-bold shadow-lg">
                        {chatName.charAt(0)}
                      </div>
                      <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#10B981] border-4 border-white dark:border-[#262626] rounded-full"></div>
                    </div>
                    <h3 className="font-bold text-xl text-[#171717] dark:text-[#F5F5F5] text-center mb-1">{chatName}</h3>
                    <p className="text-sm text-gray-500 text-center">
                      {isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>

                  <div className="flex justify-between items-center w-full px-2 mb-8">

                    <div
                      className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        setIsMuted(!isMuted);
                        toast.success(isMuted ? "Notifications unmuted" : "Notifications muted");
                      }}
                    >
                      <div className={`w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center ${isMuted ? 'text-[#7C3AED]' : 'text-gray-500 dark:text-gray-400'}`}>
                        <span className="material-icons-round">{isMuted ? 'notifications_off' : 'notifications'}</span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                    </div>

                    <div
                      className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        setActiveSidePanel('search');
                        onChatSearchOpenChange?.(true);
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                        <span className="material-icons-round">search</span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Search</span>
                    </div>
                  </div>

                  <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-800">
                    <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-2">About</h4>
                    <p className="text-sm text-[#171717] dark:text-[#F5F5F5] leading-relaxed">
                      Hey there! I am using Rabta.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-[#FAFAFA] dark:bg-[#171717] p-1 rounded-xl mb-4 border border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all bg-white dark:bg-[#262626] text-[#7C3AED] shadow-sm`}
                    >
                      Media
                    </button>
                  </div>

                  <div className="w-full">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                      <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                    </div>
                  </div>

                </div>
              )
            ) : (
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search in chat..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#7C3AED] text-[#171717] dark:text-[#F5F5F5]"
                  />
                </div>
                {chatSearchQuery.trim() ? (
                  searchMatchingMessages.length ? (
                    <ul className="flex flex-col gap-2 max-h-[min(60vh,480px)] overflow-y-auto">
                      {searchMatchingMessages.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => scrollToMessageInThread(m.id)}
                            className="w-full text-left p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 hover:border-[#7C3AED]/40 transition-colors"
                          >
                            <span className="text-xs text-gray-400 block mb-1">{m.time}{m.isMine ? ' · You' : ''}</span>
                            <span className="text-sm text-[#171717] dark:text-[#F5F5F5] line-clamp-3">
                              {m.content || m.fileName || 'Media'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center text-gray-400 text-sm mt-6">
                      No messages match &quot;{chatSearchQuery.trim()}&quot;
                    </div>
                  )
                ) : (
                  <div className="text-center text-gray-400 text-sm mt-10">
                    <span className="material-icons-round text-4xl opacity-20 mb-2 block">search</span>
                    Search for messages in this chat
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {showGroupPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">Create Group Post</h2>
              <button onClick={() => setShowGroupPostModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6">
              <textarea
                className="w-full h-32 bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-[#171717] dark:text-[#F5F5F5] resize-none focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="What's on your mind? Share with the group..."
              ></textarea>
              <div className="flex items-center gap-3 mt-4">
                <button className="text-gray-400 hover:text-[#7C3AED] transition-colors">
                  <span className="material-icons-round">image</span>
                </button>
                <button className="text-gray-400 hover:text-[#7C3AED] transition-colors">
                  <span className="material-icons-round">poll</span>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-[#1f1f1f] flex justify-end gap-3">
              <button onClick={() => setShowGroupPostModal(false)} className="px-5 py-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium">
                Cancel
              </button>
              <button onClick={() => { setShowGroupPostModal(false); toast.success("Post created in group!"); }} className="px-6 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-medium transition-colors">
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">Edit Group Info</h2>
              <button onClick={() => setShowEditGroupModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-500 mb-2">Group Name</label>
              <input type="text" defaultValue={chatName} className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl py-3 px-4 text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:border-[#7C3AED] mb-4" />

              <label className="block text-sm font-medium text-gray-500 mb-2">Description</label>
              <textarea rows={3} defaultValue="Welcome to the group! We discuss frontend development, React, and modern UI/UX design patterns." className="w-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl py-3 px-4 text-[#171717] dark:text-[#F5F5F5] resize-none focus:outline-none focus:border-[#7C3AED]"></textarea>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-[#1f1f1f] flex justify-end gap-3">
              <button onClick={() => setShowEditGroupModal(false)} className="px-5 py-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium">Cancel</button>
              <button onClick={() => { setShowEditGroupModal(false); toast.success("Group info updated"); }} className="px-6 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-medium transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5]">Add Member</h2>
              <button onClick={() => { setShowAddMemberModal(false); setUserSearchQuery(""); }} className="text-gray-400 hover:text-red-500 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="relative mb-6">
                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="w-full pl-10 pr-4 py-3 bg-[#FAFAFA] dark:bg-[#171717] border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:border-[#7C3AED] transition-colors text-[#171717] dark:text-[#F5F5F5]"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                {isSearchingUsers ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div key={user._id} className="flex items-center justify-between p-3 bg-[#FAFAFA] dark:bg-[#171717] rounded-xl border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold">
                          {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" /> : user.fullName.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-[#171717] dark:text-[#F5F5F5] truncate">{user.fullName}</span>
                          <span className="text-xs text-gray-500 truncate">{user.email || user.role}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddUserToGroup(user._id)}
                        className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))
                ) : userSearchQuery.trim().length >= 2 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">No users found matching "{userSearchQuery}"</div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm italic">Type at least 2 characters to search...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-round text-3xl">warning</span>
              </div>
              <h2 className="text-xl font-bold text-[#171717] dark:text-[#F5F5F5] mb-2">Leave Group?</h2>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to leave this group? You won't receive any more messages from it.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowLeaveConfirmModal(false)} className="flex-1 py-3 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium">Cancel</button>
                <button
                  onClick={async () => {
                    try {
                      await axiosInstance.put(`/chats/group/${chatId}/leave`);
                      toast.success("You left the group");
                      setShowLeaveConfirmModal(false);
                      setActiveSidePanel(null);
                    } catch {
                      toast.error("Failed to leave group");
                    }
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(file) => uploadFileToServer(file)}
      />

      {viewingFile && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <button
            onClick={() => setViewingFile(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 z-50"
          >
            <span className="material-icons-round text-3xl">close</span>
          </button>

          {viewingFile.type === 'image' ? (
            <img src={viewingFile.url} alt="Attachment Fullscreen" className="max-h-full max-w-full object-contain rounded-lg" />
          ) : (
            <iframe src={viewingFile.url} className="w-full max-w-5xl h-[80vh] bg-white rounded-xl shadow-2xl" />
          )}
        </div>
      )}

      {/* Local Audio Element for Message Notifications */}
      <audio ref={msgRef} src="/notification.mp3" preload="auto" style={{ display: 'none' }} />

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        messageToForward={forwardingMessage}
        chats={chats}
        onForward={handleForwardMessage}
      />
    </div>
  );
};
