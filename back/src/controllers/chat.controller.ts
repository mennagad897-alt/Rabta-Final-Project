import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import * as chatService from "../services/chat.service";
import Message from "../models/Message";
import Chat from "../models/chat";
import fs from "fs";
import path from "path";
import { isUserOnline } from "../server";
import { embeddingsModel } from "../services/Ai/core.ai.service";
import { autoIngestSingleMessage } from "../services/Ai/chat.ai.service"; // اتأكدي من مسار الملف الصح عندك
import { uploadBufferToCloudinary } from "../services/cloudinary.service";
// ==========================================
// 💬 كنترولر الشات والرسائل والجروبات والمجتمعات
// ==========================================

// ==========================================
// 📜 جلب تاريخ الرسائل (History API)
// ==========================================
// ليه عندنا History endpoint منفصل؟
// 1. الفرونت إند بيحتاج يجيب الرسائل القديمة لما اليوزر يفتح شات
// 2. بنستخدم الـ limit عشان منحملش السيرفر (30 رسالة مثلاً مش 10000)
// 3. الـ before cursor بيخلي الفرونت إند يجيب رسائل أقدم لما اليوزر يعمل scroll لفوق
export const getMessageHistory = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { chatId } = req.params;
    const userId = (req.user as any)._id.toString();

    // الـ limit بين 20 و 50 عشان نحمي السيرفر من الطلبات الكبيرة
    const limit = parseInt(req.query.limit as string) || 30;
    const before = req.query.before as string; // cursor-based pagination

    const ChatModel = require("../models/chat").default;
    const chatDoc = await ChatModel.findById(chatId).select(
      "isGroup status initiatedBy users",
    );
    if (
      chatDoc &&
      !chatDoc.isGroup &&
      chatDoc.status === "pending"
    ) {
      return res.status(200).json({
        status: "success",
        results: 0,
        data: { messages: [] },
      });
    }

    const messages = await chatService.getChatMessages(
      chatId as string,
      userId,
      limit,
      before,
    );

    res.status(200).json({
      status: "success",
      results: messages.length,
      data: { messages },
    });
  },
);

// ==========================================
// 🤝 إنشاء أو جلب محادثة فردية
// ==========================================
export const accessChat = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const currentUserId = (req.user as any)._id.toString();
    const { userId } = req.body;

    if (!userId) {
      return next(new AppError("userId is required to start a chat", 400));
    }

    // مينفعش تفتح شات مع نفسك
    if (userId === currentUserId) {
      return next(new AppError("You cannot chat with yourself", 400));
    }

    const chat = await chatService.accessOrCreateChat(currentUserId, userId);

    const io = req.app.get("io");
    if (io) {
      // Explicitly emit ONLY to the specific users involved (Targeted Emits)
      io.to(currentUserId).to(userId).emit("newChatCreated", chat);
    }

    res.status(200).json({
      status: "success",
      data: { chat },
    });
  },
);

export const respondToChatRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const chatId = String(req.params.id);
    const { action } = req.body;

    if (!["accept", "reject"].includes(action)) {
      return next(new AppError("Action must be 'accept' or 'reject'", 400));
    }

    const chat = await chatService.respondToChatRequest(
      chatId,
      userId,
      action,
    );

    const io = req.app.get("io");
    if (io && chat) {
      const payload = { chat };
      chat.users.forEach((u: { _id?: { toString(): string }; toString?: () => string }) => {
        const uid =
          typeof u === "object" && u !== null && "_id" in u
            ? u._id?.toString()
            : u?.toString?.();
        if (uid) io.to(uid).emit("chat-request-updated", payload);
      });
    } else if (io && action === "reject") {
      io.to(userId).emit("chat-request-rejected", { chatId });
    }

    res.status(200).json({
      status: "success",
      message:
        action === "accept"
          ? "Chat request accepted"
          : "Chat request declined",
      data: { chat },
    });
  },
);

// ==========================================
// 📋 جلب كل محادثات اليوزر
// ==========================================
export const getMyChats = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const chats = await chatService.getUserChats(userId);

    res.status(200).json({
      status: "success",
      results: chats.length,
      data: { chats },
    });
  },
);

// ==========================================
// 👥 إنشاء جروب جديد
// ==========================================
export const createGroup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const adminId = (req.user as any)._id.toString();
    const { groupName, members, isPrivate } = req.body;

    if (!groupName) {
      return next(new AppError("Group name is required", 400));
    }

    const groupChat = await chatService.createGroupChat(
      adminId,
      groupName,
      members,
      isPrivate,
    );

    const io = req.app.get("io");
    if (io && groupChat && groupChat.users) {
      // Explicitly emit ONLY to the specific members of the new group
      groupChat.users.forEach((user: any) => {
        io.to(user._id.toString()).emit("newChatCreated", groupChat);
      });
    }

    res.status(201).json({
      status: "success",
      data: { chat: groupChat },
    });
  },
);

// ==========================================
// ➕ إضافة عضو للجروب
// ==========================================
export const addToGroup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const adminId = (req.user as any)._id.toString();
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return next(new AppError("chatId and userId are required", 400));
    }

    const updatedChat = await chatService.addMemberToGroup(
      chatId,
      adminId,
      userId,
    );

    res.status(200).json({
      status: "success",
      data: { chat: updatedChat },
    });
  },
);

// ==========================================
// ➖ إزالة عضو من الجروب
// ==========================================
export const removeFromGroup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const adminId = (req.user as any)._id.toString();
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return next(new AppError("chatId and userId are required", 400));
    }

    const updatedChat = await chatService.removeMemberFromGroup(
      chatId,
      adminId,
      userId,
    );

    res.status(200).json({
      status: "success",
      data: { chat: updatedChat },
    });
  },
);

// ==========================================
// 🚪 مغادرة جروب
// ==========================================
export const leaveGroupChat = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const { chatId } = req.params;

    const result = await chatService.leaveGroup(chatId as string, userId);

    res.status(200).json({
      status: "success",
      message: result.message,
    });
  },
);

// ==========================================
// 🏘️ كنترولر المجتمعات (Communities)
// ==========================================

// إنشاء مجتمع جديد
export const createCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req.user as any)._id.toString();
    const { name, description, tags } = req.body;

    if (!name || !description) {
      return next(
        new AppError("Community name and description are required", 400),
      );
    }

    const community = await chatService.createCommunity(
      ownerId,
      name,
      description,
      tags,
    );

    res.status(201).json({
      status: "success",
      data: { community },
    });
  },
);

// الانضمام لمجتمع
export const joinCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const { communityId } = req.params;

    const result = await chatService.joinCommunity(
      communityId as string,
      userId,
    );

    res.status(200).json({
      status: "success",
      message: result.message,
    });
  },
);

// مغادرة مجتمع
export const leaveCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const { communityId } = req.params;

    const result = await chatService.leaveCommunity(
      communityId as string,
      userId,
    );

    res.status(200).json({
      status: "success",
      message: result.message,
    });
  },
);

// إضافة عضو للمجتمع (Admin Only)
export const addCommunityMember = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const adminId = (req.user as any)._id.toString();
    const { communityId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return next(new AppError("userId is required", 400));
    }

    const community = await chatService.addMemberToCommunity(
      communityId as string,
      adminId,
      userId,
    );

    res.status(200).json({
      status: "success",
      data: { community },
    });
  },
);

// إزالة عضو من المجتمع (Admin Only)
export const removeCommunityMember = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const adminId = (req.user as any)._id.toString();
    const { communityId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return next(new AppError("userId is required", 400));
    }

    const community = await chatService.removeMemberFromCommunity(
      communityId as string,
      adminId,
      userId,
    );

    res.status(200).json({
      status: "success",
      data: { community },
    });
  },
);

// تحديث بيانات المجتمع (Admin Only)
export const updateCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const adminId = (req.user as any)._id.toString();
    const { communityId } = req.params;

    const community = await chatService.updateCommunity(
      communityId as string,
      adminId,
      req.body,
    );

    res.status(200).json({
      status: "success",
      data: { community },
    });
  },
);

// جلب كل المجتمعات العامة
export const getAllCommunities = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await chatService.getAllCommunities(page, limit);

    res.status(200).json({
      status: "success",
      results: result.communities.length,
      pagination: result.pagination,
      data: { communities: result.communities },
    });
  },
);

// جلب تفاصيل مجتمع معين
export const getCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const community = await chatService.getCommunityById(
      req.params.communityId as string,
    );

    res.status(200).json({
      status: "success",
      data: { community },
    });
  },
);

export const sendMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      content,
      type,
      replyTo,
      isForwarded,
      audioUrl,
      duration,
      attachments,
    } = req.body;
    const id = req.params.id as string;
    const senderId = (req.user as any)._id.toString();
    const chat = await Chat.findById(id).select("users");
    const recipientId = chat?.users
      ?.find((u: any) => u.toString() !== senderId)
      ?.toString();
    const initialStatus: "sent" | "delivered" =
      recipientId && isUserOnline(recipientId) ? "delivered" : "sent";

    let savedMsg;
    try {
      // 1. نعمل الـ Embedding الأول (لو في محتوى نصي)
      let messageEmbedding: number[] = [];
      if (content) {
        try {
          messageEmbedding = await embeddingsModel.embedQuery(content);
          console.log("✅ Embedding success! Length:", messageEmbedding.length); // سطر التيست ده مهم جداً
        } catch (error) {
          console.error("❌ Error from OpenAI Embeddings:", error);
        }
      }
      // 2. بعد ما الأرقام جهزت، نحفظ الرسالة في الداتابيز
      savedMsg = await chatService.createMessage({
        chatId: id,
        senderId,
        content,
        messageType: type || "text",
        replyTo,
        isForwarded,
        audioUrl,
        duration,
        attachments,
        status: initialStatus,
        embedding: messageEmbedding // دلوقتي الكود شايف الأرقام صح وهيبعتها
      });
    } catch (error) {
      console.error("Validation Error in sendMessage:", error);
      throw error;
    }

    // Retrieve io from Express app to avoid circular dependencies
    const io = req.app.get("io");
    // Emit the message in real-time to everyone in the chat room
    io.to(id).emit("receiveMessage", savedMsg);
    io.to(id).emit("receive-message", savedMsg);

    if (initialStatus === "delivered") {
      io.to(senderId).emit("messageDelivered", {
        chatId: id,
        messageId: (savedMsg as any)._id?.toString?.() || (savedMsg as any)._id,
        status: "delivered",
      });
    }

    await chatService.emitNewCommunityMessage(io, id, savedMsg as any);

    // ... الكود القديم بتاع الـ socket.io ...
    await chatService.emitNewCommunityMessage(io, id, savedMsg as any);

    // 🔥 السطرين الجداد: تشغيل التغذية التلقائية في الخلفية للـ AI
    // بنجيب اسم اليوزر سواء كان متخزن في fullName أو name
    const senderName = (req.user as any).fullName || (req.user as any).name || "مستخدم في الشات";
    autoIngestSingleMessage(savedMsg, senderName);

    // الرد الطبيعي لليوزر
    res.status(201).json({
      status: "success",
      data: { message: savedMsg },
    });
  }
);



export const sendAudioMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const senderId = (req.user as any)._id.toString();

    if (!req.file) {
      return next(new AppError("Audio file is required", 400));
    }

    // Construct URL for the uploaded file
    const fileUrl = req.file.path;

    let message;
    try {
      message = await chatService.createMessage({
        chatId: id,
        senderId,
        content: fileUrl, // Keep for backward compatibility
        audioUrl: fileUrl,
        messageType: "audio",
        replyTo: req.body.replyTo,
      });
    } catch (error) {
      console.error("Validation Error in sendAudioMessage:", error);
      throw error;
    }

    // Retrieve io from Express app
    const io = req.app.get("io");
    // Emit the message in real-time
    io.to(id).emit("receiveMessage", message);
    io.to(id).emit("receive-message", message);

    await chatService.emitNewCommunityMessage(io, id, message as any);

    res.status(201).json({
      status: "success",
      data: { message },
    });
  },
);

export const sendFileMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const senderId = (req.user as any)._id.toString();

    if (!req.file) {
      return next(new AppError("File attachment is required", 400));
    }

    // Upload to Cloudinary using buffer
    const uploadResult = await uploadBufferToCloudinary(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    const fileUrl = uploadResult.secure_url;

    // Determine if it's an image, video, or generic document based on mimetype
    let messageType = "file";
    if (req.file.mimetype.startsWith("image/")) {
      messageType = "image";
    } else if (req.file.mimetype.startsWith("video/")) {
      messageType = "video";
    }

    let message;
    try {
      message = await chatService.createMessage({
        chatId: id,
        senderId,
        content: "", // DO NOT save the file path in plain text content
        messageType,
        replyTo: req.body.replyTo,
        attachments: [
          {
            fileUrl: fileUrl,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
          },
        ],
      });
    } catch (error) {
      console.error("Validation Error in sendFileMessage:", error);
      throw error;
    }

    const io = req.app.get("io");
    io.to(id).emit("receiveMessage", message);
    io.to(id).emit("receive-message", message);

    await chatService.emitNewCommunityMessage(io, id, message as any);

    res.status(201).json({
      status: "success",
      data: { message },
    });
  },
);

export const markMessagesAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // chatId
  const currentUserId = (req.user as any)._id;
  // Find all unread messages in this chat sent by the OTHER person
  // Only mark incoming messages as read — never the current user's own sends
  const result = await Message.updateMany(
    {
      chatId: id,
      senderId: { $ne: currentUserId },
      status: { $ne: 'read' },
    },
    {
      $set: { status: 'read' },
      $addToSet: { readBy: currentUserId },
    }
  );

  const io = req.app.get("io");
  // Emit the event to the chat room to update UI instantly
  if (io && result.modifiedCount > 0) {
    const chat = await Chat.findById(id).select('users');
    const readByStr = currentUserId.toString();
    // Notify message senders only (not the reader) so their ticks update
    chat?.users?.forEach((userId: any) => {
      const uid = userId.toString();
      if (uid !== readByStr) {
        io.to(uid).emit("messages-read", {
          chatId: id,
          readBy: readByStr
        });
      }
    });
  }
  res.status(200).json({
    status: "success",
    message: "Messages marked as read",
  });
},
);

export const getSharedContent = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const userId = (req.user as any)._id.toString();
    const raw = (req.query.category as string) || "all";
    const category = (
      ["all", "media", "docs", "photos"].includes(raw) ? raw : "all"
    ) as "all" | "media" | "docs" | "photos";

    const result = await chatService.getSharedContent(id, userId, category);

    if ("items" in result) {
      res.status(200).json({
        status: "success",
        data: { items: result.items, category: result.category },
      });
      return;
    }

    res.status(200).json({
      status: "success",
      data: { shared: result },
    });
  },
);

// ==========================================
// 🧹 Soft clear chat history (per-user clearStates)
// POST /api/v1/chats/:id/clear
// ==========================================
export const clearChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = (req.user as any)._id.toString();

  const chat = await Chat.findById(id);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  const isMember = chat.users.some((u: any) => u.toString() === userId);
  if (!isMember) {
    return next(new AppError('You are not a member of this chat', 403));
  }

  const clearedAt = await chatService.upsertChatClearState(id as string, userId);

  res.status(200).json({
    status: 'success',
    message: 'Chat cleared successfully',
    data: { clearedAt },
  });
});

// ==========================================
// 🙈 Hide chat from sidebar (hiddenBy — separate from soft clear)
// DELETE /api/v1/chats/:id/clear
// ==========================================
export const clearChatHistory = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req.user as any)._id;

    const chat = await Chat.findById(id);
    if (!chat) {
      return next(new AppError("Chat not found", 404));
    }

    const isMember = chat.users.some(
      (u: any) => u.toString() === userId.toString(),
    );
    if (!isMember) {
      return next(new AppError("You are not a member of this chat", 403));
    }

    await Chat.findByIdAndUpdate(
      id,
      { $addToSet: { hiddenBy: userId } },
      { new: true },
    );

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("chatCleared", { chatId: id });
    }

    res.status(200).json({
      status: 'success',
      message: 'Chat hidden from list successfully',
    });
  });

// ==========================================
// 🔢 Unread message count for a chat
// GET /api/v1/chats/:chatId/unread-count
// ==========================================
export const getChatUnreadCount = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { chatId } = req.params;
  const userId = (req.user as any)._id.toString();

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  const isMember = chat.users.some((u: any) => u.toString() === userId);
  if (!isMember) {
    return next(new AppError('You are not a member of this chat', 403));
  }

  const unreadCount = await chatService.countUnreadMessages(
    chatId as string,
    userId,
    chat,
  );

  res.status(200).json({
    status: 'success',
    data: { unreadCount },
  });
});

// ==========================================
// 🔇 Toggle Mute Chat
// PUT /api/v1/chats/:id/mute
// ==========================================
export const toggleMuteChat = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req.user as any)._id;

    const chat = await Chat.findById(id);
    if (!chat) {
      return next(new AppError("Chat not found", 404));
    }

    // Initialize array if it doesn't exist
    if (!chat.mutedBy) {
      chat.mutedBy = [];
    }

    const isMuted = chat.mutedBy.includes(userId);

    if (isMuted) {
      // Unmute
      chat.mutedBy = chat.mutedBy.filter(
        (uId: any) => uId.toString() !== userId.toString(),
      );
    } else {
      // Mute
      chat.mutedBy.push(userId);
    }

    await chat.save();

    res.status(200).json({
      status: "success",
      isMuted: !isMuted,
      message: isMuted ? "Chat unmuted" : "Chat muted",
    });
  },
);

// ==========================================
// 🔍 Block relation (for chat UI)
// GET /api/v1/users/block-relation/:userId
// ==========================================
export const getBlockRelation = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { User } = require("../models/user");
    const me = (req.user as any)._id.toString();
    const other = req.params.userId;

    if (me === other) {
      return res.status(200).json({
        status: "success",
        data: { blockedByMe: false, blockedMe: false },
      });
    }

    const [a, b] = await Promise.all([
      User.findById(me).select("blockedUsers"),
      User.findById(other).select("blockedUsers"),
    ]);

    const blockedByMe = !!a?.blockedUsers?.some(
      (id: any) => id.toString() === other,
    );
    const blockedMe = !!b?.blockedUsers?.some(
      (id: any) => id.toString() === me,
    );

    res.status(200).json({
      status: "success",
      data: { blockedByMe, blockedMe },
    });
  },
);

// ==========================================
// 🚫 Block / Unblock a User
// PUT /api/v1/users/block/:id
// ==========================================
export const toggleBlockUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { User } = require("../models/user");
    const currentUserId = (req.user as any)._id.toString();
    const targetUserId = req.params.id;

    if (currentUserId === targetUserId) {
      return next(new AppError("You cannot block yourself.", 400));
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return next(new AppError("User not found", 404));

    const alreadyBlocked = currentUser.blockedUsers?.some(
      (id: any) => id.toString() === targetUserId,
    );

    if (alreadyBlocked) {
      // Unblock
      currentUser.blockedUsers = currentUser.blockedUsers.filter(
        (id: any) => id.toString() !== targetUserId,
      );
      await currentUser.save({ validateBeforeSave: false });

      const io = req.app.get("io");
      if (io) {
        io.to(targetUserId).emit("block-status-changed", {
          blockerId: currentUserId,
          blocked: false,
        });
      }

      return res
        .status(200)
        .json({ status: "success", message: "User unblocked." });
    } else {
      // Block
      currentUser.blockedUsers = [
        ...(currentUser.blockedUsers || []),
        targetUserId,
      ];
      await currentUser.save({ validateBeforeSave: false });

      const io = req.app.get("io");
      if (io) {
        io.to(targetUserId).emit("block-status-changed", {
          blockerId: currentUserId,
          blocked: true,
        });
      }

      return res
        .status(200)
        .json({ status: "success", message: "User blocked." });
    }
  },
);

// ==========================================
// 👥 Send Friend Request via Phone Number
// POST /api/v1/users/friend-request
// ==========================================
export const sendFriendRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { User } = require("../models/user");
    const senderId = (req.user as any)._id.toString();
    const { phoneNumber } = req.body;

    if (!phoneNumber)
      return next(new AppError("Phone number is required.", 400));

    const receiver = await User.findOne({ phoneNumber });
    if (!receiver)
      return next(new AppError("No user found with that phone number.", 404));
    if (receiver._id.toString() === senderId)
      return next(new AppError("You cannot send a request to yourself.", 400));

    // Prevent duplicate pending requests
    const alreadyPending = receiver.pendingRequests?.some(
      (id: any) => id.toString() === senderId,
    );
    if (alreadyPending)
      return next(new AppError("Friend request already sent.", 400));

    // Prevent re-requesting an existing connection
    const alreadyConnected = receiver.connections?.some(
      (id: any) => id.toString() === senderId,
    );
    if (alreadyConnected)
      return next(
        new AppError("You are already connected with this user.", 400),
      );

    // Add sender to receiver's pendingRequests
    receiver.pendingRequests = [...(receiver.pendingRequests || []), senderId];
    await receiver.save({ validateBeforeSave: false });

    // Emit real-time notification via socket.io
    const io = (req as any).app.get("io");
    if (io) {
      const senderUser =
        await User.findById(senderId).select("fullName avatar");
      // The receiver's socket room is their userId string
      io.to(receiver._id.toString()).emit("new_friend_request", {
        from: {
          _id: senderId,
          fullName: senderUser?.fullName,
          avatar: senderUser?.avatar,
        },
      });
    }

    res.status(200).json({
      status: "success",
      message: "Friend request sent successfully.",
    });
  },
);

// ==========================================
// 🗑️ Delete a Message
// DELETE /api/v1/messages/:id
// ==========================================
export const deleteMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { type } = req.body; // 'me' or 'everyone'
    const userId = (req.user as any)._id.toString();

    const message = await Message.findById(id);
    if (!message) return next(new AppError("Message not found", 404));

    if (type === "everyone") {
      if (message.senderId.toString() !== userId) {
        return next(
          new AppError(
            "You can only delete your own messages for everyone",
            403,
          ),
        );
      }

      // Delete associated files from disk
      try {
        if (message.audioUrl) {
          // لو اللينك بيبدأ بـ http يعني جاي من Cloudinary خده زي ما هو، لو لأ ادمجه كمسار محلي
          const filePath = message.audioUrl.startsWith("http")
            ? message.audioUrl
            : path.join(process.cwd(), message.audioUrl);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        if (message.attachments && message.attachments.length > 0) {
          message.attachments.forEach((att) => {
            if (att.fileUrl) {
              const filePath = att.fileUrl.startsWith("http")
                ? att.fileUrl
                : path.join(process.cwd(), att.fileUrl);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          });
        }
      } catch (err) {
        console.error("Failed to delete files from disk:", err);
      }

      await message.deleteOne();

      const io = req.app.get("io");
      io.to(message.chatId.toString()).emit("messageDeleted", {
        messageId: id,
        type: "everyone",
      });
    } else {
      // Delete for me
      if (!message.hiddenFor.includes(userId as any)) {
        message.hiddenFor.push(userId as any);
        await message.save();
      }
    }

    res
      .status(200)
      .json({ status: "success", message: "Message deleted successfully" });
  },
);

// ==========================================
// ✏️ Edit a Message
// PUT /api/v1/messages/:id/edit
// ==========================================
export const editMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = (req.user as any)._id.toString();

    const message = await Message.findById(id);
    if (!message) return next(new AppError("Message not found", 404));

    if (message.senderId.toString() !== userId) {
      return next(new AppError("You can only edit your own messages", 403));
    }

    if (message.messageType !== "text") {
      return next(new AppError("Only text messages can be edited", 400));
    }

    if (message.isDeletedForEveryone) {
      return next(new AppError("Cannot edit a deleted message", 400));
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    const io = req.app.get("io");
    io.to(message.chatId.toString()).emit("messageEdited", {
      messageId: id,
      content: content,
    });

    res.status(200).json({ status: "success", data: { message } });
  },
);

// ==========================================
// 📌 Toggle Pin Message
// PUT /api/v1/messages/:id/pin
// ==========================================
export const togglePinMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return next(new AppError("Message not found", 404));

    message.isPinned = !message.isPinned;
    await message.save();

    const io = req.app.get("io");
    io.to(message.chatId.toString()).emit("messagePinned", {
      messageId: id,
      isPinned: message.isPinned,
    });

    res
      .status(200)
      .json({ status: "success", data: { isPinned: message.isPinned } });
  },
);

// ==========================================
// 😂 React to Message
// POST /api/v1/messages/:id/react
// ==========================================
export const reactToMessage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = (req.user as any)._id;

    const message = await Message.findById(id);
    if (!message) return next(new AppError("Message not found", 404));

    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString() && r.emoji === emoji,
    );

    if (existingReactionIndex > -1) {
      // If same user clicks same emoji, remove it (toggle)
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add the new reaction
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    const io = req.app.get("io");
    io.to(message.chatId.toString()).emit("messageReacted", {
      messageId: id,
      reactions: message.reactions,
    });

    res
      .status(200)
      .json({ status: "success", data: { reactions: message.reactions } });
  },
);
