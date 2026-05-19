import mongoose from "mongoose";
import Chat from "../models/chat";
import Message from "../models/Message";
import Community from "../models/Community";
import { User } from "../models/user";
import { AppError } from "../utils/AppError";

export type ClearStateEntry = {
  user?: mongoose.Types.ObjectId | { toString(): string };
  clearedAt?: Date;
};

export type ChatClearContext = {
  clearStates?: ClearStateEntry[];
  isGroup?: boolean;
};

/** Returns the user's soft-clear timestamp, if any. */
export const getClearedAtForUser = (
  chat: ChatClearContext,
  userId: string,
): Date | null => {
  const entry = chat.clearStates?.find(
    (s) => s.user?.toString() === userId,
  );
  return entry?.clearedAt ? new Date(entry.clearedAt) : null;
};

/** Message visibility filter: after clearStates.clearedAt + not hiddenFor user. */
export const buildVisibleMessageFilter = (
  chatId: mongoose.Types.ObjectId | string,
  userId: string,
  chat: ChatClearContext,
  extraAnd: Record<string, unknown>[] = [],
): Record<string, unknown> => {
  const userOid = new mongoose.Types.ObjectId(userId);
  const andClauses: Record<string, unknown>[] = [...extraAnd];

  const clearedAt = getClearedAtForUser(chat, userId);
  if (clearedAt) {
    andClauses.push({ createdAt: { $gt: clearedAt } });
  }

  andClauses.push({
    $or: [
      { hiddenFor: { $exists: false } },
      { hiddenFor: { $size: 0 } },
      { hiddenFor: { $not: { $elemMatch: { $eq: userOid } } } },
    ],
  });

  const filter: Record<string, unknown> = {
    chatId:
      typeof chatId === "string"
        ? new mongoose.Types.ObjectId(chatId)
        : chatId,
  };
  if (andClauses.length) filter.$and = andClauses;
  return filter;
};

/** Per-user soft clear: upsert clearStates entry with current timestamp. */
export const upsertChatClearState = async (
  chatId: string,
  userId: string,
): Promise<Date> => {
  const clearedAt = new Date();
  const userOid = new mongoose.Types.ObjectId(userId);

  const updated = await Chat.findOneAndUpdate(
    { _id: chatId, "clearStates.user": userOid },
    { $set: { "clearStates.$.clearedAt": clearedAt } },
    { new: true },
  );

  if (!updated) {
    await Chat.findByIdAndUpdate(chatId, {
      $push: { clearStates: { user: userOid, clearedAt } },
    });
  }

  return clearedAt;
};

/** Unread count respecting clearStates, hiddenFor, and chat type. */
export const countUnreadMessages = async (
  chatId: string,
  userId: string,
  chat?: ChatClearContext | null,
): Promise<number> => {
  const chatDoc =
    chat && chat.clearStates !== undefined
      ? chat
      : await Chat.findById(chatId).select("clearStates isGroup");
  if (!chatDoc) throw new AppError("Chat not found", 404);

  const userOid = new mongoose.Types.ObjectId(userId);
  const visibilityFilter = buildVisibleMessageFilter(chatId, userId, chatDoc);

  const unreadFilter: Record<string, unknown> = {
    ...visibilityFilter,
    senderId: { $ne: userOid },
  };

  if (chatDoc.isGroup) {
    unreadFilter.readBy = { $nin: [userOid] };
  } else {
    unreadFilter.status = { $ne: "read" };
  }

  return Message.countDocuments(unreadFilter);
};

/** Check block status between users in a direct chat. */
export const checkDirectChatBlockStatus = async (
  senderId: string,
  chatId: string,
) => {
  const chat = await Chat.findById(chatId).select("users isGroup");
  if (!chat || chat.isGroup)
    return { senderBlockedOther: false, receiverBlockedSender: false };

  const otherUserId = chat.users
    .map((u) => u.toString())
    .find((id) => id !== senderId);
  if (!otherUserId)
    return { senderBlockedOther: false, receiverBlockedSender: false };

  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select("blockedUsers"),
    User.findById(otherUserId).select("blockedUsers"),
  ]);

  const senderBlockedOther = !!sender?.blockedUsers?.some(
    (id: mongoose.Types.ObjectId) => id.toString() === otherUserId,
  );
  const receiverBlockedSender = !!receiver?.blockedUsers?.some(
    (id: mongoose.Types.ObjectId) => id.toString() === senderId,
  );

  return { senderBlockedOther, receiverBlockedSender };
};

/** Block check for calls when chat id may be unresolved â€” uses user pair only. */
export const checkUsersBlockStatusPair = async (
  userA: string,
  userB: string,
) => {
  const [a, b] = await Promise.all([
    User.findById(userA).select("blockedUsers"),
    User.findById(userB).select("blockedUsers"),
  ]);
  const aBlockedB = !!a?.blockedUsers?.some(
    (id: mongoose.Types.ObjectId) => id.toString() === userB,
  );
  const bBlockedA = !!b?.blockedUsers?.some(
    (id: mongoose.Types.ObjectId) => id.toString() === userA,
  );

  return { senderBlockedOther: aBlockedB, receiverBlockedSender: bBlockedA };
};

// ==========================================
// ðŸ’¬ Ø³ÙŠØ±ÙØ³ Ø§Ù„Ø´Ø§Øª ÙˆØ§Ù„Ø±Ø³Ø§Ø¦Ù„
// ==========================================
// Ù„ÙŠÙ‡ Ø¹Ù†Ø¯Ù†Ø§ Chat Ùˆ Message ÙƒÙ…ÙˆØ¯ÙŠÙ„ÙŠÙ† Ù…Ù†ÙØµÙ„ÙŠÙ†ØŸ
// 1. Ø§Ù„Ù€ Chat Ù‡Ùˆ "Ø§Ù„ØºØ±ÙØ©" Ø£Ùˆ "Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø©" - Ø¨ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø´Ø§Ø±ÙƒÙŠÙ† ÙˆÙ†ÙˆØ¹ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© (ÙØ±Ø¯ÙŠ/Ø¬Ù…Ø§Ø¹ÙŠ)
// 2. Ø§Ù„Ù€ Message Ù‡Ùˆ "Ø§Ù„Ø±Ø³Ø§Ù„Ø©" Ù†ÙØ³Ù‡Ø§ - Ø¨ØªÙ†ØªÙ…ÙŠ Ù„Ø´Ø§Øª Ù…Ø¹ÙŠÙ† ÙˆØ¨ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ÙˆØ§Ù„Ù…Ø±Ø³Ù„
// 3. Ø§Ù„ÙØµÙ„ Ø¯Ù‡ Ø¨ÙŠØ®Ù„ÙŠÙ†Ø§ Ù†Ù‚Ø¯Ø± Ù†Ø¬ÙŠØ¨ Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ Ø¨Ø§Ù„Ù€ pagination Ù…Ù† ØºÙŠØ± Ù…Ø§ Ù†Ø­Ù…Ù‘Ù„ ÙƒÙ„ Ø­Ø§Ø¬Ø© Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø©
// 4. Ù„Ùˆ Ø­Ø·ÙŠÙ†Ø§ Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ Ø¬ÙˆØ§ Ø§Ù„Ø´Ø§ØªØŒ Ø§Ù„Ù€ document Ù‡ÙŠÙƒØ¨Ø± Ø¬Ø¯Ø§Ù‹ ÙˆÙŠØ¨Ù‚Ù‰ Ø¨Ø·ÙŠØ¡ (MongoDB document size limit = 16MB)

// ==========================================
// ðŸ“¨ Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø© Ø¬Ø¯ÙŠØ¯Ø© ÙˆØ­ÙØ¸Ù‡Ø§ ÙÙŠ Ø§Ù„Ø¯Ø§ØªØ§ Ø¨ÙŠØ²
// ==========================================
export const createMessage = async (data: {
  chatId: string;
  senderId: string;
  content?: string;
  messageType?: string;
  status?: "sent" | "delivered" | "read" | "sending";
  audioUrl?: string;
  duration?: number;
  replyTo?: string;
  isForwarded?: boolean;
  attachments?: { fileUrl: string; fileType: string; fileSize?: number }[];
  embedding?: number[];
}) => {
  // Ø§Ù„ØªØ£ÙƒØ¯ Ø¥Ù† Ø§Ù„Ø´Ø§Øª Ù…ÙˆØ¬ÙˆØ¯ ÙØ¹Ù„Ø§Ù‹
  const chat = await Chat.findById(data.chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  if (!chat.isGroup && chat.status === "pending") {
    throw new AppError("This chat request has not been accepted yet", 403);
  }

  // Ø§Ù„ØªØ£ÙƒØ¯ Ø¥Ù† Ø§Ù„Ù…Ø±Ø³Ù„ Ø¹Ø¶Ùˆ ÙÙŠ Ø§Ù„Ø´Ø§Øª Ø¯Ù‡ (Ø­Ù…Ø§ÙŠØ© Ù…Ù‡Ù…Ø©)
  const isMember = chat.users.some(
    (userId) => userId.toString() === data.senderId,
  );
  if (!isMember) throw new AppError("You are not a member of this chat", 403);

  const blockStatus = await checkDirectChatBlockStatus(
    data.senderId,
    data.chatId,
  );
  if (blockStatus.senderBlockedOther || blockStatus.receiverBlockedSender) {
    throw new AppError("You cannot interact with this user.", 403);
  }

  const newMessage = new Message({
    chatId: data.chatId,
    senderId: data.senderId,
    content: data.content,
    audioUrl: data.audioUrl,
    duration: data.duration,
    messageType: data.messageType || "text",
    status: data.status || "sent",
    attachments: data.attachments || [],
    replyTo: data.replyTo,
    isForwarded: data.isForwarded || false,
    embedding: data.embedding,
  });
  await newMessage.save();

  // ØªØ­Ø¯ÙŠØ« Ø¢Ø®Ø± Ø±Ø³Ø§Ù„Ø© ÙÙŠ Ø§Ù„Ø´Ø§Øª Ø¹Ø´Ø§Ù† Ø§Ù„ÙØ±ÙˆÙ†Øª Ø¥Ù†Ø¯ ÙŠØ¹Ø±Ø¶Ù‡Ø§ ÙÙŠ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª
  await Chat.findByIdAndUpdate(data.chatId, { latestMessage: newMessage._id });

  // Ø¨Ù†Ø±Ø¬Ø¹ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ù…Ø¹ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø±Ø³Ù„ (Ø§Ù„Ø§Ø³Ù… ÙˆØ§Ù„ØµÙˆØ±Ø©)
  const populatedMessage = await Message.findById(newMessage._id)
    .populate("senderId", "fullName avatar")
    .populate({
      path: "replyTo",
      select: "content senderId messageType attachments",
      populate: { path: "senderId", select: "fullName" },
    });

  return populatedMessage;
};

// Phase 3: Sidebar sync for community chats
type SocketEmitter = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
};

export const emitNewCommunityMessage = async (
  io: SocketEmitter | undefined,
  chatId: string,
  savedMessage: { toObject?: () => Record<string, unknown> } & Record<string, unknown>,
) => {
  if (!io) return;

  const community = await Community.findOne({ chatId }).select("_id");
  if (!community) return;

  const messageObj = savedMessage.toObject?.() ?? savedMessage;
  const rawSender = messageObj.senderId as
    | {
        _id?: { toString(): string };
        fullName?: string;
        name?: string;
        avatar?: string;
        toString?: () => string;
      }
    | string
    | undefined;

  let senderId: string;
  let sender: { _id: string; fullName?: string; name?: string; avatar?: string };

  if (typeof rawSender === "object" && rawSender !== null) {
    senderId =
      rawSender._id?.toString?.() ??
      rawSender.toString?.() ??
      String(rawSender);
    const displayName = rawSender.fullName || rawSender.name;
    sender = {
      _id: senderId,
      fullName: displayName,
      name: displayName,
      avatar: rawSender.avatar,
    };
  } else {
    senderId = rawSender?.toString?.() ?? String(rawSender);
    const userDoc = await User.findById(senderId).select("fullName avatar").lean();
    const displayName = userDoc?.fullName;
    sender = {
      _id: senderId,
      fullName: displayName,
      name: displayName,
      avatar: userDoc?.avatar,
    };
  }

  const communityId = community._id.toString();
  const rawId = messageObj._id as { toString(): string } | string | undefined;

  io.to(communityId).emit("new-community-message", {
    communityId,
    lastMessage: {
      _id: rawId?.toString?.() ?? rawId,
      content: messageObj.content,
      messageType: messageObj.messageType,
    },
    timestamp: messageObj.createdAt ?? new Date(),
    senderId,
    sender,
  });
};

// ==========================================
// ðŸ“œ Ø¬Ù„Ø¨ ØªØ§Ø±ÙŠØ® Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ (History) Ù„Ø´Ø§Øª Ù…Ø¹ÙŠÙ†
// ==========================================
// Ù„ÙŠÙ‡ Ø¨Ù†Ø¬ÙŠØ¨ history Ø¨Ø§Ù„Ù€ limitØŸ
// 1. Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© Ù…Ù…ÙƒÙ† ÙŠÙƒÙˆÙ† ÙÙŠÙ‡Ø§ Ø¢Ù„Ø§Ù Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ØŒ Ù…ÙŠÙ†ÙØ¹Ø´ Ù†Ø¬ÙŠØ¨Ù‡Ù… ÙƒÙ„Ù‡Ù… Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© (Ù‡ÙŠØ¨Ø·Ø¦ Ø§Ù„Ø³ÙŠØ±ÙØ± ÙˆØ§Ù„ÙØ±ÙˆÙ†Øª Ø¥Ù†Ø¯)
// 2. Ø¨Ù†Ø³ØªØ®Ø¯Ù… cursor-based pagination (Ù‚Ø¨Ù„ Ø±Ø³Ø§Ù„Ø© Ù…Ø¹ÙŠÙ†Ø©) Ø¹Ø´Ø§Ù† Ø§Ù„Ø£Ø¯Ø§Ø¡ ÙŠÙƒÙˆÙ† Ø£Ø­Ø³Ù† Ù…Ù† skip/limit
// 3. Ø§Ù„ÙØ±ÙˆÙ†Øª Ø¥Ù†Ø¯ Ø¨ÙŠØ¬ÙŠØ¨ Ø£ÙˆÙ„ 30 Ø±Ø³Ø§Ù„Ø©ØŒ ÙˆÙ„Ù…Ø§ Ø§Ù„ÙŠÙˆØ²Ø± ÙŠØ¹Ù…Ù„ scroll Ù„ÙÙˆÙ‚ Ø¨ÙŠØ¬ÙŠØ¨ Ø§Ù„Ù€ 30 Ø§Ù„Ù„ÙŠ Ù‚Ø¨Ù„Ù‡Ù…
export const getChatMessages = async (
  chatId: string,
  userId: string,
  limit: number = 30,
  before?: string, // cursor: Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ Ø§Ù„Ù„ÙŠ Ù‚Ø¨Ù„ Ø§Ù„Ù€ ID Ø¯Ù‡
) => {
  // Ø§Ù„ØªØ£ÙƒØ¯ Ø¥Ù† Ø§Ù„Ø´Ø§Øª Ù…ÙˆØ¬ÙˆØ¯ ÙˆØ§Ù„ÙŠÙˆØ²Ø± Ø¹Ø¶Ùˆ ÙÙŠÙ‡
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isMember = chat.users.some((userId_) => userId_.toString() === userId);
  if (!isMember) throw new AppError("You are not a member of this chat", 403);

  const andClauses: Record<string, unknown>[] = [];
  if (before) {
    andClauses.push({ _id: { $lt: new mongoose.Types.ObjectId(before) } });
  }

  const query = buildVisibleMessageFilter(chatId, userId, chat, andClauses);

  const safeLimit = Math.min(Math.max(limit, 20), 50);

  const latestBatch = await Message.find(query)
    .populate("senderId", "fullName avatar")
    .populate({
      path: "replyTo",
      select: "content senderId messageType attachments",
      populate: { path: "senderId", select: "fullName" },
    })
    // Fetch newest first so limit returns the latest persisted messages
    .sort({ createdAt: -1 })
    .limit(safeLimit);

  // Return ascending for UI rendering (newest appears at bottom)
  return latestBatch.reverse();
};

// ==========================================
// ðŸ¤ Ø¥Ù†Ø´Ø§Ø¡ Ø£Ùˆ Ø¬Ù„Ø¨ Ù…Ø­Ø§Ø¯Ø«Ø© ÙØ±Ø¯ÙŠØ© (One-to-One)
// ==========================================
export const accessOrCreateChat = async (
  currentUserId: string,
  otherUserId: string,
) => {
  // Ø¨Ù†Ø¨Ø­Ø« Ù‡Ù„ ÙÙŠÙ‡ Ø´Ø§Øª ÙØ±Ø¯ÙŠ (Ù…Ø´ Ø¬Ø±ÙˆØ¨) Ø¨ÙŠÙ† Ø§Ù„ÙŠÙˆØ²Ø±ÙŠÙ† Ø¯ÙˆÙ„
  let chat = await Chat.findOne({
    isGroup: false,
    users: { $all: [currentUserId, otherUserId], $size: 2 },
  })
    .populate("users", "fullName avatar status showOnlineStatus")
    .populate("latestMessage");

  // Ù„Ùˆ Ù…Ø´ Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ù†Ù†Ø´Ø¦ ÙˆØ§Ø­Ø¯ Ø¬Ø¯ÙŠØ¯
  if (!chat) {
    chat = await Chat.create({
      isGroup: false,
      users: [currentUserId, otherUserId],
      status: "pending",
      initiatedBy: currentUserId,
    });
    chat = await Chat.findById(chat._id).populate(
      "users",
      "fullName avatar status showOnlineStatus",
    );
  } else {
    // If the chat exists but was hidden by the user, unhide it
    if (
      chat.hiddenBy &&
      chat.hiddenBy.some((id) => id.toString() === currentUserId)
    ) {
      await Chat.findByIdAndUpdate(chat._id, {
        $pull: { hiddenBy: currentUserId },
      });
      chat.hiddenBy = chat.hiddenBy.filter(
        (id) => id.toString() !== currentUserId,
      );
    }
  }

  return chat;
};

export const respondToChatRequest = async (
  chatId: string,
  userId: string,
  action: "accept" | "reject",
) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (chat.isGroup) throw new AppError("Not a direct chat request", 400);
  if (chat.status !== "pending") {
    throw new AppError("This chat request has already been processed", 400);
  }

  const initiatorId = chat.initiatedBy?.toString();
  const isInitiator = initiatorId === userId;
  const isParticipant = chat.users.some((u) => u.toString() === userId);
  if (!isParticipant) throw new AppError("You are not part of this chat", 403);

  if (action === "accept") {
    if (isInitiator) {
      throw new AppError("Only the recipient can accept this request", 403);
    }
    chat.status = "accepted";
    await chat.save();
    return await Chat.findById(chat._id)
      .populate("users", "fullName avatar status showOnlineStatus")
      .populate("latestMessage");
  }

  await Message.deleteMany({ chatId: chat._id });
  await Chat.findByIdAndDelete(chatId);
  return null;
};

// ==========================================
// ðŸ‘¥ Ø¥Ù†Ø´Ø§Ø¡ Ù…Ø­Ø§Ø¯Ø«Ø© Ø¬Ù…Ø§Ø¹ÙŠØ© (Group Chat)
// ==========================================
export const createGroupChat = async (
  adminId: string,
  groupName: string,
  memberIds: string[],
  isPrivate: boolean = false,
) => {
  // Ù„Ø§Ø²Ù… ÙŠÙƒÙˆÙ† ÙÙŠÙ‡ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„ Ø¹Ø¶ÙˆÙŠÙ† ØºÙŠØ± Ø§Ù„Ø£Ø¯Ù…Ù†
  if (!memberIds || memberIds.length < 2) {
    throw new AppError(
      "Group chat must have at least 2 members besides admin",
      400,
    );
  }

  // Ø§Ù„Ø£Ø¯Ù…Ù† Ø¨ÙŠÙƒÙˆÙ† Ø¹Ø¶Ùˆ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
  const allUsers = [adminId, ...memberIds.filter((id) => id !== adminId)];

  const groupChat = await Chat.create({
    isGroup: true,
    groupName,
    users: allUsers,
    admins: [adminId],
    isPrivate,
  });

  const populatedChat = await Chat.findById(groupChat._id)
    .populate("users", "fullName avatar status showOnlineStatus")
    .populate("admins", "fullName avatar");

  return populatedChat;
};

// ==========================================
// âž• Ø¥Ø¶Ø§ÙØ© Ø¹Ø¶Ùˆ Ù„Ù„Ø¬Ø±ÙˆØ¨ (Admin Only)
// ==========================================
export const addMemberToGroup = async (
  chatId: string,
  adminId: string,
  newMemberId: string,
) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("This is not a group chat", 400);

  // Check permissions based on group privacy
  const isAdmin = chat.admins?.some((id) => id.toString() === adminId);
  if (chat.isPrivate) {
    if (!isAdmin)
      throw new AppError(
        "Only the admin can add members to this private group",
        403,
      );
  } else {
    const isMember = chat.users.some((id) => id.toString() === adminId);
    if (!isMember && !isAdmin)
      throw new AppError(
        "Only existing members can add users to this group",
        403,
      );
  }

  // Ø§Ù„ØªØ£ÙƒØ¯ Ø¥Ù† Ø§Ù„Ø¹Ø¶Ùˆ Ù…Ø´ Ù…ÙˆØ¬ÙˆØ¯ Ø£ØµÙ„Ø§Ù‹
  const alreadyMember = chat.users.some((id) => id.toString() === newMemberId);
  if (alreadyMember) throw new AppError("User is already a member", 400);

  chat.users.push(new mongoose.Types.ObjectId(newMemberId));
  await chat.save();

  const updatedChat = await Chat.findById(chatId)
    .populate("users", "fullName avatar status showOnlineStatus")
    .populate("admins", "fullName avatar");

  return updatedChat;
};

// ==========================================
// âž– Ø¥Ø²Ø§Ù„Ø© Ø¹Ø¶Ùˆ Ù…Ù† Ø§Ù„Ø¬Ø±ÙˆØ¨ (Admin Only)
// ==========================================
export const removeMemberFromGroup = async (
  chatId: string,
  adminId: string,
  memberId: string,
) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("This is not a group chat", 400);

  const isAdmin = chat.admins?.some((id) => id.toString() === adminId);
  if (!isAdmin) throw new AppError("Only admins can remove members", 403);

  // Ù…ÙŠÙ†ÙØ¹Ø´ Ø§Ù„Ø£Ø¯Ù…Ù† ÙŠØ´ÙŠÙ„ Ù†ÙØ³Ù‡ (Ù„Ø§Ø²Ù… ÙŠØ³ÙŠØ¨ Ø§Ù„Ø¬Ø±ÙˆØ¨ Ø¨Ø¯Ù„ ÙƒØ¯Ù‡)
  if (memberId === adminId)
    throw new AppError(
      "Admin cannot remove themselves, use leave instead",
      400,
    );

  chat.users = chat.users.filter((id) => id.toString() !== memberId);
  // Ù„Ùˆ Ø§Ù„Ø¹Ø¶Ùˆ ÙƒØ§Ù† Ø£Ø¯Ù…Ù† ÙƒÙ…Ø§Ù†ØŒ Ù†Ø´ÙŠÙ„Ù‡ Ù…Ù† Ø§Ù„Ø£Ø¯Ù…Ù†Ø²
  if (chat.admins) {
    chat.admins = chat.admins.filter((id) => id.toString() !== memberId);
  }
  await chat.save();

  const updatedChat = await Chat.findById(chatId)
    .populate("users", "fullName avatar status showOnlineStatus")
    .populate("admins", "fullName avatar");

  return updatedChat;
};

// ==========================================
// ðŸšª Ù…ØºØ§Ø¯Ø±Ø© Ø§Ù„Ø¬Ø±ÙˆØ¨ (Ø£ÙŠ Ø¹Ø¶Ùˆ)
// ==========================================
export const leaveGroup = async (chatId: string, userId: string) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  if (!chat.isGroup) throw new AppError("This is not a group chat", 400);

  const isMember = chat.users.some((id) => id.toString() === userId);
  if (!isMember) throw new AppError("You are not a member of this group", 400);

  // Ø´ÙŠÙ„ Ø§Ù„ÙŠÙˆØ²Ø± Ù…Ù† Ø§Ù„Ø£Ø¹Ø¶Ø§Ø¡ ÙˆØ§Ù„Ø£Ø¯Ù…Ù†Ø²
  chat.users = chat.users.filter((id) => id.toString() !== userId);
  if (chat.admins) {
    chat.admins = chat.admins.filter((id) => id.toString() !== userId);
  }

  // Ù„Ùˆ Ù…ÙÙŠØ´ Ø£Ø¯Ù…Ù†Ø² ØªØ§Ù†ÙŠØŒ Ø£ÙˆÙ„ Ø¹Ø¶Ùˆ ÙŠØ¨Ù‚Ù‰ Ø£Ø¯Ù…Ù† ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
  if (chat.admins && chat.admins.length === 0 && chat.users.length > 0) {
    chat.admins.push(chat.users[0]);
  }

  await chat.save();

  // Remove the user from the related Community if it exists
  const community = await Community.findOne({ chatId: chat._id });
  if (community) {
    community.members = community.members.filter(
      (id: any) => id.toString() !== userId,
    );
    // If we updated admins in chat, also sync community admins
    community.admins = chat.admins || [];
    await community.save();
  }

  return { message: "You have left the group successfully" };
};

// ==========================================
// ðŸ˜ï¸ Ø¥Ù†Ø´Ø§Ø¡ Ù…Ø¬ØªÙ…Ø¹ Ù…ØªØ®ØµØµ (Community)
// ==========================================
export const createCommunity = async (
  ownerId: string,
  name: string,
  description: string,
  tags?: string[],
) => {
  // Ø¨Ù†Ù†Ø´Ø¦ Ø´Ø§Øª Ø¬Ù…Ø§Ø¹ÙŠ Ù…Ø±ØªØ¨Ø· Ø¨Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
  const communityChat = await Chat.create({
    isGroup: true,
    groupName: name,
    users: [ownerId],
    admins: [ownerId],
  });

  const community = await Community.create({
    name,
    description,
    owner: ownerId,
    admins: [ownerId],
    members: [ownerId],
    chatId: communityChat._id,
    tags: tags || [],
  });

  const populatedCommunity = await Community.findById(community._id)
    .populate("owner", "fullName avatar")
    .populate("members", "fullName avatar")
    .populate("chatId");

  return populatedCommunity;
};

// ==========================================
// ðŸšª Ø§Ù„Ø§Ù†Ø¶Ù…Ø§Ù… Ù„Ù…Ø¬ØªÙ…Ø¹ (Join Community)
// ==========================================
export const joinCommunity = async (communityId: string, userId: string) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError("Community not found", 404);

  // Ø§Ù„ØªØ£ÙƒØ¯ Ø¥Ù† Ø§Ù„ÙŠÙˆØ²Ø± Ù…Ø´ Ø¹Ø¶Ùˆ Ø£ØµÙ„Ø§Ù‹
  const alreadyMember = community.members.some(
    (id) => id.toString() === userId,
  );
  if (alreadyMember) throw new AppError("You are already a member", 400);

  // Ù„Ùˆ Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ Ø®Ø§ØµØŒ Ù…ÙŠÙ†ÙØ¹Ø´ ÙŠÙ†Ø¶Ù… Ù…Ù† ØºÙŠØ± Ø¯Ø¹ÙˆØ©
  if (!community.isPublic) {
    throw new AppError(
      "This is a private community, you need an invitation",
      403,
    );
  }

  // Ø¶ÙŠÙ Ø§Ù„ÙŠÙˆØ²Ø± ÙƒØ¹Ø¶Ùˆ ÙÙŠ Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ ÙˆÙÙŠ Ø§Ù„Ø´Ø§Øª Ø§Ù„Ù…Ø±ØªØ¨Ø·
  community.members.push(new mongoose.Types.ObjectId(userId));
  await community.save();

  // Ø¶ÙŠÙÙ‡ ÙÙŠ Ø§Ù„Ø´Ø§Øª Ø§Ù„Ø¬Ù…Ø§Ø¹ÙŠ ÙƒÙ…Ø§Ù†
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $addToSet: { users: userId },
    });
  }

  return { message: "Joined community successfully" };
};

// ==========================================
// ðŸšª Ù…ØºØ§Ø¯Ø±Ø© Ù…Ø¬ØªÙ…Ø¹ (Leave Community)
// ==========================================
export const leaveCommunity = async (communityId: string, userId: string) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError("Community not found", 404);

  // ØµØ§Ø­Ø¨ Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ Ù…ÙŠÙ†ÙØ¹Ø´ ÙŠØºØ§Ø¯Ø± (Ù„Ø§Ø²Ù… ÙŠÙ…Ø³Ø­ Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ Ø£Ùˆ ÙŠÙ†Ù‚Ù„ Ø§Ù„Ù…Ù„ÙƒÙŠØ©)
  if (community.owner.toString() === userId) {
    throw new AppError(
      "Owner cannot leave the community, transfer ownership first",
      400,
    );
  }

  community.members = community.members.filter(
    (id) => id.toString() !== userId,
  );
  community.admins = community.admins.filter((id) => id.toString() !== userId);
  await community.save();

  // Ø´ÙŠÙ„Ù‡ Ù…Ù† Ø§Ù„Ø´Ø§Øª ÙƒÙ…Ø§Ù†
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $pull: { users: userId },
    });
  }

  return { message: "Left community successfully" };
};

// ==========================================
// âž• Ø¥Ø¶Ø§ÙØ© Ø¹Ø¶Ùˆ Ù„Ù„Ù…Ø¬ØªÙ…Ø¹ (Admin Only)
// ==========================================
export const addMemberToCommunity = async (
  communityId: string,
  adminId: string,
  newMemberId: string,
) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError("Community not found", 404);

  const isAdmin =
    community.owner.toString() === adminId ||
    community.admins.some((id) => id.toString() === adminId);
  if (!isAdmin) throw new AppError("Only admins can add members", 403);

  const alreadyMember = community.members.some(
    (id) => id.toString() === newMemberId,
  );
  if (alreadyMember) throw new AppError("User is already a member", 400);

  community.members.push(new mongoose.Types.ObjectId(newMemberId));
  await community.save();

  // Ø¶ÙŠÙÙ‡ ÙÙŠ Ø§Ù„Ø´Ø§Øª ÙƒÙ…Ø§Ù†
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $addToSet: { users: newMemberId },
    });
  }

  const updatedCommunity = await Community.findById(communityId).populate(
    "members",
    "fullName avatar",
  );

  return updatedCommunity;
};

// ==========================================
// âž– Ø¥Ø²Ø§Ù„Ø© Ø¹Ø¶Ùˆ Ù…Ù† Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ (Admin Only)
// ==========================================
export const removeMemberFromCommunity = async (
  communityId: string,
  adminId: string,
  memberId: string,
) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError("Community not found", 404);

  const isAdmin = community.admins.some((id) => id.toString() === adminId);
  if (!isAdmin) throw new AppError("Only admins can remove members", 403);

  if (community.owner.toString() === memberId) {
    throw new AppError("Cannot remove the community owner", 400);
  }

  community.members = community.members.filter(
    (id) => id.toString() !== memberId,
  );
  community.admins = community.admins.filter(
    (id) => id.toString() !== memberId,
  );
  await community.save();

  // Ø´ÙŠÙ„Ù‡ Ù…Ù† Ø§Ù„Ø´Ø§Øª ÙƒÙ…Ø§Ù†
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $pull: { users: memberId },
    });
  }

  const updatedCommunity = await Community.findById(communityId).populate(
    "members",
    "fullName avatar",
  );

  return updatedCommunity;
};

// ==========================================
// ðŸ”„ ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¬ØªÙ…Ø¹ (Admin Only)
// ==========================================
export const updateCommunity = async (
  communityId: string,
  adminId: string,
  updates: {
    name?: string;
    description?: string;
    avatar?: string;
    tags?: string[];
    isPublic?: boolean;
  },
) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError("Community not found", 404);

  const isAdmin = community.admins.some((id) => id.toString() === adminId);
  if (!isAdmin) throw new AppError("Only admins can update community", 403);

  // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ù…Ø³Ù…ÙˆØ­ Ø¨ÙŠÙ‡Ø§ Ø¨Ø³
  const allowedUpdates: any = {};
  if (updates.name !== undefined) allowedUpdates.name = updates.name;
  if (updates.description !== undefined)
    allowedUpdates.description = updates.description;
  if (updates.avatar !== undefined) allowedUpdates.avatar = updates.avatar;
  if (updates.tags !== undefined) allowedUpdates.tags = updates.tags;
  if (updates.isPublic !== undefined)
    allowedUpdates.isPublic = updates.isPublic;

  const updatedCommunity = await Community.findByIdAndUpdate(
    communityId,
    allowedUpdates,
    {
      new: true,
      runValidators: true,
    },
  )
    .populate("owner", "fullName avatar")
    .populate("members", "fullName avatar");

  return updatedCommunity;
};

// ==========================================
// ðŸ“‹ Ø¬Ù„Ø¨ ÙƒÙ„ Ø§Ù„Ù…Ø¬ØªÙ…Ø¹Ø§Øª (Ù…Ø¹ pagination)
// ==========================================
export const getAllCommunities = async (
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  const communities = await Community.find({ isPublic: true })
    .populate("owner", "fullName avatar")
    .select("name description avatar members tags createdAt")
    .skip(skip)
    .limit(limit)
    .sort("-createdAt");

  const total = await Community.countDocuments({ isPublic: true });

  return {
    communities,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCommunities: total,
    },
  };
};

// ==========================================
// ðŸ” Ø¬Ù„Ø¨ Ù…Ø¬ØªÙ…Ø¹ Ø¨Ø§Ù„ØªÙØµÙŠÙ„
// ==========================================
export const getCommunityById = async (communityId: string) => {
  const community = await Community.findById(communityId)
    .populate("owner", "fullName avatar")
    .populate("admins", "fullName avatar")
    .populate("members", "fullName avatar status")
    .populate("chatId");

  if (!community) throw new AppError("Community not found", 404);

  return community;
};

// ==========================================
// ðŸ“‹ Ø¬Ù„Ø¨ Ù…Ø­Ø§Ø¯Ø«Ø§Øª Ø§Ù„ÙŠÙˆØ²Ø± (ÙƒÙ„ Ø§Ù„Ø´Ø§ØªØ§Øª Ø§Ù„Ù„ÙŠ Ù‡Ùˆ Ø¹Ø¶Ùˆ ÙÙŠÙ‡Ø§)
// ==========================================
export const getUserChats = async (userId: string) => {
  const chats = await Chat.find({
    users: userId,
    isGroup: false,
    $or: [{ hiddenBy: { $exists: false } }, { hiddenBy: { $ne: userId } }],
  })
    .populate("users", "fullName avatar status showOnlineStatus")
    .populate({
      path: "latestMessage",
      populate: { path: "senderId", select: "fullName _id" },
    })
    .populate("admins", "fullName avatar")
    .sort("-updatedAt");

  const chatsWithUnread = await Promise.all(
    chats.map(async (chat) => {
      let latestMsg: any = chat.latestMessage;

      // If the globally stored latest message is hidden for this user, find the true latest visible message
      if (
        latestMsg &&
        (latestMsg as any).hiddenFor?.some(
          (id: any) => id.toString() === userId.toString(),
        )
      ) {
        const visibleFilter = buildVisibleMessageFilter(
          chat._id,
          userId,
          chat,
        );
        const realLatestMessage = await Message.findOne(visibleFilter)
          .sort({ createdAt: -1 })
          .populate("senderId", "fullName _id");

        latestMsg = realLatestMessage;
      }

      const unreadCount = await countUnreadMessages(
        chat._id.toString(),
        userId,
        chat,
      );
      const chatObj = chat.toObject();
      chatObj.latestMessage = latestMsg;
      chatObj.users = chatObj.users.map(
        (u: any) =>
          u || {
            _id: "deleted",
            fullName: "Deleted User",
            avatar: "/default-avatar.png",
            status: "offline",
          },
      );
      return { ...chatObj, unreadCount };
    }),
  );

  return chatsWithUnread;
};

export type SharedContentCategory = "all" | "media" | "docs" | "photos";

export type SharedItem = {
  id: string;
  url: string;
  fileName?: string;
  messageType: string;
  createdAt: Date;
};

function classifySharedMessage(msg: {
  messageType: string;
  content?: string;
  audioUrl?: string;
  attachments?: { fileUrl?: string; fileType?: string; fileSize?: number }[];
}): "photos" | "docs" | "media" | null {
  const att0 = msg.attachments?.[0];
  const mime = (att0?.fileType || "").toLowerCase();
  const url = (
    att0?.fileUrl ||
    msg.content ||
    msg.audioUrl ||
    ""
  ).toLowerCase();

  if (msg.messageType === "image" || mime.startsWith("image/")) return "photos";
  if (msg.messageType === "audio" || mime.startsWith("audio/")) return "media";
  if (
    mime.startsWith("video/") ||
    /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(url)
  )
    return "media";

  if (msg.messageType === "file") {
    if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url))
      return "photos";
    if (mime.startsWith("video/") || /\.(mp4|webm|mov)(\?|$)/i.test(url))
      return "media";
    if (
      /pdf|msword|word|spreadsheet|excel|powerpoint|text\/plain|zip|rar|octet-stream/.test(
        mime,
      ) ||
      /\.(pdf|doc|docx|txt|xlsx?|pptx?|zip|rar)(\?|$)/i.test(url)
    ) {
      return "docs";
    }
    return "docs";
  }

  return null;
}

function messageToSharedItem(msg: any): SharedItem | null {
  const url =
    msg.attachments?.[0]?.fileUrl ||
    msg.audioUrl ||
    (typeof msg.content === "string" && /^https?:\/\//i.test(msg.content)
      ? msg.content
      : undefined);
  if (!url) return null;
  return {
    id: String(msg._id),
    url,
    fileName:
      msg.attachments?.[0]?.fileType ||
      (msg.content as string)?.split("/").pop(),
    messageType: msg.messageType,
    createdAt: msg.createdAt,
  };
}

/**
 * Shared files in a chat for the current user (respects clearStates + hiddenFor).
 * category=all â†’ legacy buckets { media, files, links }; otherwise { items, category }.
 */
export const getSharedContent = async (
  chatId: string,
  userId: string,
  category: SharedContentCategory = "all",
): Promise<
  | { media: any[]; files: any[]; links: any[] }
  | { items: SharedItem[]; category: SharedContentCategory }
> => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);

  const isMember = chat.users.some((u: any) => u.toString() === userId);
  if (!isMember) throw new AppError("You are not a member of this chat", 403);

  const andClauses: Record<string, unknown>[] = [
    { isDeletedForEveryone: { $ne: true } },
  ];

  const query = buildVisibleMessageFilter(chatId, userId, chat, andClauses);

  andClauses.push({
    $or: [
      { messageType: { $in: ["image", "file", "audio"] } },
      { "attachments.0": { $exists: true } },
      { audioUrl: { $exists: true, $nin: [null, ""] } },
    ],
  });

  if (andClauses.length) query.$and = andClauses;

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(400)
    .lean();

  if (category !== "all") {
    const items: SharedItem[] = [];
    for (const msg of messages) {
      const bucket = classifySharedMessage(msg as any);
      if (bucket !== category) continue;
      const item = messageToSharedItem(msg);
      if (item) items.push(item);
    }
    return { items, category };
  }

  const shared = {
    media: [] as any[],
    files: [] as any[],
    links: [] as any[],
  };

  messages.forEach((msg: any) => {
    if (msg.messageType === "image") {
      shared.media.push({
        url: msg.content || msg.attachments?.[0]?.fileUrl,
        createdAt: msg.createdAt,
      });
    } else if (msg.messageType === "file") {
      shared.files.push({
        url: msg.content || msg.attachments?.[0]?.fileUrl,
        name: msg.attachments?.[0]?.fileType,
        createdAt: msg.createdAt,
      });
    }
    if (msg.messageType === "audio" && (msg.audioUrl || msg.content)) {
      shared.media.push({
        url: msg.audioUrl || msg.content,
        createdAt: msg.createdAt,
      });
    }

    if (msg.content && typeof msg.content === "string") {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const links = msg.content.match(urlRegex);
      if (links) {
        links.forEach((link: string) =>
          shared.links.push({ url: link, createdAt: msg.createdAt }),
        );
      }
    }
  });

  return shared;
};
