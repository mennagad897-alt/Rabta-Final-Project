import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { useCommunityChat, type ChatMessage } from "../../hooks/useCommunityChat";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { CreatePostModal } from "../CreatePostModal";
import axiosInstance from "../../api/axiosInstance";

// ── Helpers ─────────────────────────────────────────────────────────────────
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const getSenderId = (msg: ChatMessage): string =>
  typeof msg.senderId === "string" ? msg.senderId : msg.senderId._id;

const getSenderName = (msg: ChatMessage): string =>
  typeof msg.senderId === "string" ? "Unknown" : msg.senderId.fullName;

const getSenderAvatar = (msg: ChatMessage): string | undefined =>
  typeof msg.senderId === "string" ? undefined : msg.senderId.avatar;

const isOnlyEmojis = (str: string) => {
  const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[ \t\n\r\f\v])+$/gu;
  return emojiRegex.test(str.trim());
};

// ── Sub-components ───────────────────────────────────────────────────────────

/** A single message bubble */
const MessageBubble = React.memo(
  ({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) => {
    // Check if it's a call system message
    const isVoiceCall = msg.content.toLowerCase().includes("voice call");
    const isVideoCall = msg.content.toLowerCase().includes("video call");
    const isCallMessage = isVoiceCall || isVideoCall;

    if (isCallMessage) {
      return (
        <div className="flex justify-center w-full my-4">
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gray-100 dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/5 text-[#171717] dark:text-gray-300 text-xs font-semibold shadow-sm">
            <span className="material-icons-round text-[#7C3AED] text-base">
              {isVideoCall ? 'videocam' : 'call'}
            </span>
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : "flex-row"} group mb-1`}>
        {/* Avatar — only shown for others */}
        {!isMine && (
          <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center shrink-0 overflow-hidden self-end mb-5">
            {getSenderAvatar(msg) ? (
              <img src={getSenderAvatar(msg)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-icons-round text-[#7C3AED] text-sm">person</span>
            )}
          </div>
        )}

        <div className={`flex flex-col max-w-[72%] ${isMine ? "items-end" : "items-start"}`}>
          {/* Sender name for group context */}
          {!isMine && (
            <span className="text-[11px] font-semibold text-[#7C3AED] mb-1 pl-1">
              {getSenderName(msg)}
            </span>
          )}

          {/* Bubble */}
          <div
            className={`transition-opacity ${
              isOnlyEmojis(msg.content)
                ? "text-4xl py-1"
                : `px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                    isMine
                      ? `bg-[#7C3AED] text-white rounded-br-sm ${msg.isPending ? "opacity-60" : "opacity-100"}`
                      : "bg-white dark:bg-[#262626] text-[#171717] dark:text-[#F5F5F5] border border-gray-200 dark:border-gray-800 rounded-bl-sm"
                  }`
            }`}
          >
            {msg.content}
          </div>

          {/* Timestamp + status */}
          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
            {isMine && (
              <span className="material-icons text-[11px] text-gray-400">
                {msg.isPending ? "schedule" : "done_all"}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);
MessageBubble.displayName = "MessageBubble";

/** Animated typing indicator */
const TypingIndicator = ({ count }: { count: number }) =>
  count === 0 ? null : (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-[11px] text-gray-400">
        {count === 1 ? "Someone is typing…" : `${count} people are typing…`}
      </span>
    </div>
  );

// ── Main Component ───────────────────────────────────────────────────────────
interface CommunityChatWindowProps {
  communityId: string;
  communityName: string;
  memberCount?: number;
}

/**
 * Community chat window.
 *
 * All socket state (messages, typing, room) is kept inside `useCommunityChat`.
 * This component NEVER touches Redux, so the global Sidebar is not re-rendered
 * when a message arrives.
 */
export const CommunityChatWindow: React.FC<CommunityChatWindowProps> = ({
  communityId,
  communityName,
  memberCount,
}) => {
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const {
    messages,
    isLoading,
    typingUsers,
    isConnectedToRoom,
    sendMessage,
    emitTyping,
    emitStopTyping,
  } = useCommunityChat(communityId, currentUser?._id ?? null);

  const [inputValue, setInputValue] = useState("");
  const [isCallMenuOpen, setIsCallMenuOpen] = useState(false);
  const [isCalling, setIsCalling] = useState<{ active: boolean; type: "video" | "voice" | null }>({ active: false, type: null });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const callMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (callMenuRef.current && !callMenuRef.current.contains(event.target as Node)) {
        setIsCallMenuOpen(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Simulate call and log to history
  const handleInitiateCall = useCallback(async (type: "video" | "voice") => {
    setIsCallMenuOpen(false);
    setIsCalling({ active: true, type });

    // Simulate ringing for 3 seconds
    setTimeout(async () => {
      setIsCalling({ active: false, type: null });
      
      // 1. Send chat message
      sendMessage(`Missed ${type} call`);

      // 2. Log to backend Call History
      try {
        await axiosInstance.post("/calls/initiate", {
          type: "group",
          communityId: communityId,
        });
      } catch (err) {
        console.error("Failed to log call to history", err);
      }
    }, 3000);
  }, [communityId, sendMessage]);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Auto-resize textarea
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      emitTyping();
      // Reset height then grow
      e.target.style.height = "auto";
      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    },
    [emitTyping]
  );

  // Handle Emoji Selection
  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (textareaRef.current) {
      const cursorStart = textareaRef.current.selectionStart;
      const textBeforeCursor = inputValue.slice(0, cursorStart);
      const textAfterCursor = inputValue.slice(cursorStart);
      setInputValue(textBeforeCursor + emojiData.emoji + textAfterCursor);
      
      // Keep focus on textarea
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          cursorStart + emojiData.emoji.length,
          cursorStart + emojiData.emoji.length
        );
      }, 0);
    } else {
      setInputValue((prev) => prev + emojiData.emoji);
    }
  };

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      // TODO: Upload file to an endpoint, get URL, then sendMessage(url, "file")
      console.log("Selected file for chat upload:", selectedFile);
      alert(`File selected: ${selectedFile.name}\nReady to be uploaded to backend API.`);
      
      // Reset input
      e.target.value = '';
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInputValue("");
    setShowEmojiPicker(false);
    emitStopTyping();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, sendMessage, emitStopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FAFAFA] dark:bg-[#171717] transition-colors duration-300">
      {/* ── Header ── */}
      <header className="h-16 px-6 bg-white/80 dark:bg-[#262626]/80 backdrop-blur-md flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
            <span className="material-icons-round text-[#7C3AED] text-lg">groups</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-[#171717] dark:text-[#F5F5F5] font-bold text-sm truncate leading-tight">
              {communityName}
            </h2>
            <span className="text-[10px] text-gray-400">
              {memberCount ? `${memberCount} members` : ""}
              {isConnectedToRoom && (
                <span className="ml-1.5 text-green-500 font-medium">● Live</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-400 shrink-0 relative" ref={callMenuRef}>
          <button 
            onClick={() => setIsCallMenuOpen(!isCallMenuOpen)}
            className="flex items-center gap-0.5 bg-[#7C3AED]/10 text-[#7C3AED] transition-colors pl-3 pr-2 py-1.5 rounded-xl hover:bg-[#7C3AED]/20"
          >
            <span className="material-icons-round text-[20px]">videocam</span>
            <span className="material-icons-round text-[18px]">arrow_drop_down</span>
          </button>

          {/* Call Options Dropdown */}
          {isCallMenuOpen && (
            <div className="absolute top-full right-8 mt-1 w-40 bg-white dark:bg-[#262626] border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
              <button 
                onClick={() => handleInitiateCall("video")}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1E1E1E] text-[#171717] dark:text-[#F5F5F5] transition-colors text-sm font-semibold"
              >
                <span className="material-icons-round text-[#7C3AED] text-[18px]">videocam</span>
                Video Call
              </button>
              <button 
                onClick={() => handleInitiateCall("voice")}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1E1E1E] text-[#171717] dark:text-[#F5F5F5] transition-colors text-sm font-semibold"
              >
                <span className="material-icons-round text-[#7C3AED] text-[18px]">call</span>
                Voice Call
              </button>
            </div>
          )}

          <button className="hover:text-[#7C3AED] transition-colors p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-icons-round text-[20px]">more_vert</span>
          </button>
        </div>
      </header>

      {/* ── Message List ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 hide-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <span className="material-icons-round animate-spin text-3xl text-[#7C3AED]">sync</span>
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <span className="material-icons-round text-5xl opacity-20">forum</span>
            <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>

            {messages.map((msg) => (
              <MessageBubble
                key={msg._id}
                msg={msg}
                isMine={getSenderId(msg) === currentUser?._id}
              />
            ))}
          </>
        )}

        {/* Typing indicator */}
        <TypingIndicator count={typingUsers.length} />

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input Bar ── */}
      <footer className="shrink-0 px-4 py-3 bg-white dark:bg-[#262626] border-t border-gray-200 dark:border-gray-800 relative">
        <div className="flex items-end gap-3">
          <button 
            onClick={() => setIsPostModalOpen(true)}
            className="mb-1 w-10 h-10 bg-[#7C3AED]/10 text-[#7C3AED] rounded-full flex items-center justify-center hover:bg-[#7C3AED]/20 transition-colors shrink-0"
            title="Create Post"
          >
            <span className="material-icons text-xl">add</span>
          </button>

          <input 
            type="file" 
            multiple 
            hidden 
            ref={fileInputRef} 
            onChange={handleFileChange}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="mb-2 text-gray-400 hover:text-[#7C3AED] transition-colors shrink-0"
            title="Attach File"
          >
            <span className="material-icons text-xl">attach_file</span>
          </button>

          <div className="flex-1 bg-[#FAFAFA] dark:bg-[#1E1E1E] rounded-full border border-gray-200 dark:border-white/5 flex items-end px-4 py-2.5 focus-within:border-[#7C3AED]/50 transition-colors min-w-0 relative">
            
            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute bottom-full left-0 md:left-auto md:right-0 mb-4 z-50 shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 max-w-[90vw]">
                <EmojiPicker onEmojiClick={onEmojiClick} theme={'auto' as any} />
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onBlur={emitStopTyping}
              rows={1}
              placeholder="Write a message..."
              className="w-full bg-transparent border-none focus:ring-0 text-sm py-0.5 resize-none text-[#171717] dark:text-[#F5F5F5] placeholder-gray-500 outline-none hide-scrollbar max-h-[120px]"
            />
            <div className="flex items-center gap-2 ml-3 mb-0.5 shrink-0 text-gray-400">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`transition-colors flex items-center ${showEmojiPicker ? 'text-[#7C3AED]' : 'hover:text-[#7C3AED]'}`}
              >
                <span className="material-icons text-[22px]">sentiment_satisfied_alt</span>
              </button>
              <button className="hover:text-[#7C3AED] transition-colors flex items-center">
                <span className="material-icons text-[22px]">mic</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="mb-1 text-gray-400 hover:text-[#7C3AED] disabled:opacity-40 disabled:hover:text-gray-400 w-10 h-10 flex items-center justify-center rounded-full transition-colors shrink-0"
          >
            <span className="material-icons text-2xl">send</span>
          </button>
        </div>
      </footer>

      {/* ── Calling Overlay ── */}
      {isCalling.active && (
        <div className="absolute inset-0 bg-[#FAFAFA]/95 dark:bg-[#171717]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-24 h-24 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mb-6 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-[#7C3AED] flex items-center justify-center text-white shadow-xl shadow-[#7C3AED]/40">
              <span className="material-icons-round text-3xl">
                {isCalling.type === "video" ? "videocam" : "call"}
              </span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[#171717] dark:text-white mb-2">
            Calling {communityName}...
          </h2>
          <p className="text-gray-500 font-medium tracking-widest uppercase text-sm">
            Ringing
          </p>
          <button 
            onClick={() => setIsCalling({ active: false, type: null })}
            className="mt-12 w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-colors hover:scale-105 active:scale-95"
          >
            <span className="material-icons-round text-2xl">call_end</span>
          </button>
        </div>
      )}

      {/* ── Create Post Modal ── */}
      <CreatePostModal 
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        groupId={communityId}
        groupName={communityName}
        onPostSuccess={() => {
          console.log("Post created successfully from chat!");
        }}
      />
    </div>
  );
};
