import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../context/ChatContext";
import axiosInstance from "../api/axiosInstance";

// ── Types ──────────────────────────────────────────────────────────────
export interface ChatMessage {
  _id: string;          // Real DB id (used for dedup)
  tempId?: string;      // Optimistic UI id (before server confirms)
  senderId: {
    _id: string;
    fullName: string;
    avatar?: string;
  } | string;
  content: string;
  messageType: "text" | "code_snippet" | "image" | "file";
  createdAt: string;
  isPending?: boolean;  // True while the server hasn't confirmed yet
}

interface UseCommunityChat {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  typingUsers: string[];
  isConnectedToRoom: boolean;
  sendMessage: (content: string) => void;
  emitTyping: () => void;
  emitStopTyping: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────
/**
 * Manages all real-time chat state for a single community.
 *
 * Key design decisions:
 * 1. Room isolation: we join `chatId` as the socket room, not `communityId`.
 *    The server associates each community with a dedicated Chat document.
 * 2. Duplicate prevention: before the server echoes back, we push an optimistic
 *    message with a tempId. When `receive-message` fires we replace it by _id.
 * 3. State locality: all chat state lives HERE, not in Redux, so Redux (and
 *    therefore the Sidebar) is never re-rendered by a chat update.
 */
export const useCommunityChat = (
  communityId: string | null,
  currentUserId: string | null
): UseCommunityChat => {
  const { socket } = useChat();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnectedToRoom, setIsConnectedToRoom] = useState(false);

  // chatId fetched from the server — the actual socket room identifier
  const chatIdRef = useRef<string | null>(null);
  // Tracks message _ids we've already rendered (dedup guard)
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Typing debounce timer
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Fetch history + join room whenever communityId changes ──────
  useEffect(() => {
    if (!communityId || !socket) return;

    let active = true; // cleanup guard for stale async results

    const bootstrap = async () => {
      setIsLoading(true);
      setMessages([]);
      seenIdsRef.current.clear();

      try {
        // REST call: get chatId + last 30 messages
        const { data } = await axiosInstance.get(
          `/groups/${communityId}/chat`
        );
        const { chatId, messages: history } = data.data;

        if (!active) return;

        chatIdRef.current = chatId._id ?? chatId; // chatId can be a populated object or plain string

        // Seed the dedup set from history
        const historySeed = (history as ChatMessage[]).map((m) => m._id);
        seenIdsRef.current = new Set(historySeed);
        setMessages(history);

        // Join the Socket.io room scoped to THIS community's chat
        socket.emit("join-room", chatIdRef.current);
        setIsConnectedToRoom(true);
        console.log(`🏠 Joined community room: ${chatIdRef.current}`);
      } catch (err) {
        console.error("Failed to load community chat:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    bootstrap();

    return () => {
      active = false;
      // Leave the room when the user navigates away or switches community
      if (chatIdRef.current) {
        socket.emit("leave-room", chatIdRef.current);
        console.log(`🚪 Left community room: ${chatIdRef.current}`);
      }
      setIsConnectedToRoom(false);
      chatIdRef.current = null;
    };
  }, [communityId, socket]);

  // ── 2. Listen for incoming messages ───────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (incomingMessage: ChatMessage) => {
      console.log("📥 Received socket message:", incomingMessage);
      
      setMessages((prev) => {
        // If it's our own optimistic message coming back
        if (incomingMessage.tempId && prev.some(m => m.tempId === incomingMessage.tempId)) {
          seenIdsRef.current.add(incomingMessage._id);
          return prev.map(m => 
            m.tempId === incomingMessage.tempId ? { ...incomingMessage, isPending: false } : m
          );
        }
        
        // Prevent exact duplicates
        if (seenIdsRef.current.has(incomingMessage._id)) {
          return prev;
        }
        
        seenIdsRef.current.add(incomingMessage._id);
        // EXACT functional update requested by user:
        return [...prev, { ...incomingMessage, isPending: false }];
      });
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("receive_message", handleReceiveMessage); // Fallback listener just in case

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [socket]);

  // ── 3. Listen for typing indicators ───────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    };
    const onStopTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    socket.on("user-typing", onTyping);
    socket.on("user-stop-typing", onStopTyping);

    return () => {
      socket.off("user-typing", onTyping);
      socket.off("user-stop-typing", onStopTyping);
    };
  }, [socket]);

  // ── 4. Listen for send errors (show feedback) ─────────────────────
  useEffect(() => {
    if (!socket) return;
    const onError = (err: { message: string }) => {
      console.error("Message send error:", err.message);
      setIsSending(false);
      // Remove the pending optimistic message on failure
      setMessages((prev) => prev.filter((m) => !m.isPending));
    };
    socket.on("message-error", onError);
    return () => { socket.off("message-error", onError); };
  }, [socket]);

  // ── 5. Send a message (optimistic UI) ─────────────────────────────
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !socket || !chatIdRef.current || !currentUserId) return;

      // Generate a temporary ID for dedup + optimistic rendering
      const tempId = `temp-${Date.now()}`;

      // Optimistic update: show message immediately before server confirms
      const newOptimisticMessage: ChatMessage = {
        _id: tempId,
        tempId,
        senderId: currentUserId,
        content: content.trim(),
        messageType: "text",
        createdAt: new Date().toISOString(),
        isPending: true,
      };

      console.log("📤 Sending message instantly to UI:", newOptimisticMessage);
      
      seenIdsRef.current.add(tempId);
      
      // EXACT functional update requested by user:
      setMessages((prev) => [...prev, newOptimisticMessage]);
      
      setIsSending(true);

      // Emit to the community's isolated room
      socket.emit("send-message", {
        chatId: chatIdRef.current,
        content: content.trim(),
        messageType: "text",
        tempId: tempId,
      });

      // Server will echo `receive-message`; our handler will replace the
      // optimistic entry using the tempId ↔ _id match
      setIsSending(false);
    },
    [socket, currentUserId]
  );

  // ── 6. Typing indicator helpers ────────────────────────────────────
  const emitTyping = useCallback(() => {
    if (!socket || !chatIdRef.current) return;
    socket.emit("typing", { chatId: chatIdRef.current });

    // Auto stop-typing after 2 s of silence
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("stop-typing", { chatId: chatIdRef.current });
    }, 2000);
  }, [socket]);

  const emitStopTyping = useCallback(() => {
    if (!socket || !chatIdRef.current) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socket.emit("stop-typing", { chatId: chatIdRef.current });
  }, [socket]);

  return {
    messages,
    isLoading,
    isSending,
    typingUsers,
    isConnectedToRoom,
    sendMessage,
    emitTyping,
    emitStopTyping,
  };
};
