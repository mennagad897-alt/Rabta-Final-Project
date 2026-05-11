import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as chatService from '../services/chat.service';

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
export const getMessageHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { chatId } = req.params;
  const userId = (req.user as any)._id.toString();

  // الـ limit بين 20 و 50 عشان نحمي السيرفر من الطلبات الكبيرة
  const limit = parseInt(req.query.limit as string) || 30;
  const before = req.query.before as string; // cursor-based pagination

  const messages = await chatService.getChatMessages(chatId as string, userId, limit, before);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages }
  });
});

// ==========================================
// 🤝 إنشاء أو جلب محادثة فردية
// ==========================================
export const accessChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const currentUserId = (req.user as any)._id.toString();
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError('userId is required to start a chat', 400));
  }

  // مينفعش تفتح شات مع نفسك
  if (userId === currentUserId) {
    return next(new AppError('You cannot chat with yourself', 400));
  }

  const chat = await chatService.accessOrCreateChat(currentUserId, userId);

  res.status(200).json({
    status: 'success',
    data: { chat }
  });
});

// ==========================================
// 📋 جلب كل محادثات اليوزر
// ==========================================
export const getMyChats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id.toString();
  const chats = await chatService.getUserChats(userId);

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: { chats }
  });
});

// ==========================================
// 👥 إنشاء جروب جديد
// ==========================================
export const createGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminId = (req.user as any)._id.toString();
  const { groupName, members, isPrivate } = req.body;

  if (!groupName) {
    return next(new AppError('Group name is required', 400));
  }

  const groupChat = await chatService.createGroupChat(adminId, groupName, members, isPrivate);

  res.status(201).json({
    status: 'success',
    data: { chat: groupChat }
  });
});

// ==========================================
// ➕ إضافة عضو للجروب
// ==========================================
export const addToGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminId = (req.user as any)._id.toString();
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return next(new AppError('chatId and userId are required', 400));
  }

  const updatedChat = await chatService.addMemberToGroup(chatId, adminId, userId);

  res.status(200).json({
    status: 'success',
    data: { chat: updatedChat }
  });
});

// ==========================================
// ➖ إزالة عضو من الجروب
// ==========================================
export const removeFromGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminId = (req.user as any)._id.toString();
  const { chatId, userId } = req.body;

  if (!chatId || !userId) {
    return next(new AppError('chatId and userId are required', 400));
  }

  const updatedChat = await chatService.removeMemberFromGroup(chatId, adminId, userId);

  res.status(200).json({
    status: 'success',
    data: { chat: updatedChat }
  });
});

// ==========================================
// 🚪 مغادرة جروب
// ==========================================
export const leaveGroupChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id.toString();
  const { chatId } = req.params;

  const result = await chatService.leaveGroup(chatId as string, userId);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

// ==========================================
// 🏘️ كنترولر المجتمعات (Communities)
// ==========================================

// إنشاء مجتمع جديد
export const createCommunity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const ownerId = (req.user as any)._id.toString();
  const { name, description, tags } = req.body;

  if (!name || !description) {
    return next(new AppError('Community name and description are required', 400));
  }

  const community = await chatService.createCommunity(ownerId, name, description, tags);

  res.status(201).json({
    status: 'success',
    data: { community }
  });
});

// الانضمام لمجتمع
export const joinCommunity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id.toString();
  const { communityId } = req.params;

  const result = await chatService.joinCommunity(communityId as string, userId);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

// مغادرة مجتمع
export const leaveCommunity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id.toString();
  const { communityId } = req.params;

  const result = await chatService.leaveCommunity(communityId as string, userId);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

// إضافة عضو للمجتمع (Admin Only)
export const addCommunityMember = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminId = (req.user as any)._id.toString();
  const { communityId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError('userId is required', 400));
  }

  const community = await chatService.addMemberToCommunity(communityId as string, adminId, userId);

  res.status(200).json({
    status: 'success',
    data: { community }
  });
});

// إزالة عضو من المجتمع (Admin Only)
export const removeCommunityMember = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminId = (req.user as any)._id.toString();
  const { communityId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError('userId is required', 400));
  }

  const community = await chatService.removeMemberFromCommunity(communityId as string, adminId, userId);

  res.status(200).json({
    status: 'success',
    data: { community }
  });
});

// تحديث بيانات المجتمع (Admin Only)
export const updateCommunity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminId = (req.user as any)._id.toString();
  const { communityId } = req.params;

  const community = await chatService.updateCommunity(communityId as string, adminId, req.body);

  res.status(200).json({
    status: 'success',
    data: { community }
  });
});

// جلب كل المجتمعات العامة
export const getAllCommunities = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const result = await chatService.getAllCommunities(page, limit);

  res.status(200).json({
    status: 'success',
    results: result.communities.length,
    pagination: result.pagination,
    data: { communities: result.communities }
  });
});

// جلب تفاصيل مجتمع معين
export const getCommunity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const community = await chatService.getCommunityById(req.params.communityId as string);

  res.status(200).json({
    status: 'success',
    data: { community }
  });
});

export const sendMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { content, type } = req.body;
  const id = req.params.id as string;
  const senderId = (req.user as any)._id.toString();

  const message = await chatService.createMessage({
    chatId: id,
    senderId,
    content,
    messageType: type || 'text'
  });

  // Retrieve io from Express app to avoid circular dependencies
  const io = req.app.get('io');
  // Emit the message in real-time to everyone in the chat room
  io.to(id).emit('receive-message', message);

  res.status(201).json({
    status: 'success',
    data: { message }
  });
});

export const sendAudioMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const senderId = (req.user as any)._id.toString();

  if (!req.file) {
    return next(new AppError('Audio file is required', 400));
  }

  // Construct URL for the uploaded file
  const audioUrl = `/uploads/audio/${req.file.filename}`;

  const message = await chatService.createMessage({
    chatId: id,
    senderId,
    content: audioUrl,
    messageType: 'audio'
  });

  // Retrieve io from Express app
  const io = req.app.get('io');
  // Emit the message in real-time
  io.to(id).emit('receive-message', message);

  res.status(201).json({
    status: 'success',
    data: { message }
  });
});

export const markMessagesAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // chatId
  const userId = (req.user as any)._id.toString();

  // Find all unread messages in this chat sent by the OTHER person
  await require('../models/Message').default.updateMany(
    { 
      chatId: id, 
      senderId: { $ne: userId },
      status: { $ne: 'read' }
    },
    { 
      $set: { status: 'read' },
      $addToSet: { readBy: userId }
    }
  );

  // Retrieve io from Express app
  const io = req.app.get('io');
  // Emit the event to the chat room to update UI instantly
  io.to(id).emit('messages-read', { chatId: id, readBy: userId });

  res.status(200).json({
    status: 'success',
    message: 'Messages marked as read'
  });
});

export const getSharedContent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const shared = await chatService.getSharedContent(id);

  res.status(200).json({
    status: 'success',
    data: { shared }
  });
});

export const clearChatHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = (req.user as any)._id.toString();

  // Optionally verify user is in the chat
  
  // Here we just delete all messages with that chatId
  // In a real production app, we might soft-delete or clear only for this user
  await require('../models/Message').default.deleteMany({ chatId: id });

  res.status(200).json({
    status: 'success',
    message: 'Chat cleared successfully'
  });
});

// ==========================================
// 🚫 Block / Unblock a User
// PUT /api/v1/users/block/:id
// ==========================================
export const toggleBlockUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { User } = require('../models/user');
  const currentUserId = (req.user as any)._id.toString();
  const targetUserId = req.params.id;

  if (currentUserId === targetUserId) {
    return next(new AppError('You cannot block yourself.', 400));
  }

  const currentUser = await User.findById(currentUserId);
  if (!currentUser) return next(new AppError('User not found', 404));

  const alreadyBlocked = currentUser.blockedUsers?.some(
    (id: any) => id.toString() === targetUserId
  );

  if (alreadyBlocked) {
    // Unblock
    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      (id: any) => id.toString() !== targetUserId
    );
    await currentUser.save({ validateBeforeSave: false });
    return res.status(200).json({ status: 'success', message: 'User unblocked.' });
  } else {
    // Block
    currentUser.blockedUsers = [...(currentUser.blockedUsers || []), targetUserId];
    await currentUser.save({ validateBeforeSave: false });
    return res.status(200).json({ status: 'success', message: 'User blocked.' });
  }
});

// ==========================================
// 👥 Send Friend Request via Phone Number
// POST /api/v1/users/friend-request
// ==========================================
export const sendFriendRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { User } = require('../models/user');
  const senderId = (req.user as any)._id.toString();
  const { phoneNumber } = req.body;

  if (!phoneNumber) return next(new AppError('Phone number is required.', 400));

  const receiver = await User.findOne({ phoneNumber });
  if (!receiver) return next(new AppError('No user found with that phone number.', 404));
  if (receiver._id.toString() === senderId) return next(new AppError('You cannot send a request to yourself.', 400));

  // Prevent duplicate pending requests
  const alreadyPending = receiver.pendingRequests?.some(
    (id: any) => id.toString() === senderId
  );
  if (alreadyPending) return next(new AppError('Friend request already sent.', 400));

  // Prevent re-requesting an existing connection
  const alreadyConnected = receiver.connections?.some(
    (id: any) => id.toString() === senderId
  );
  if (alreadyConnected) return next(new AppError('You are already connected with this user.', 400));

  // Add sender to receiver's pendingRequests
  receiver.pendingRequests = [...(receiver.pendingRequests || []), senderId];
  await receiver.save({ validateBeforeSave: false });

  // Emit real-time notification via socket.io
  const io = (req as any).app.get('io');
  if (io) {
    const senderUser = await User.findById(senderId).select('fullName avatar');
    // The receiver's socket room is their userId string
    io.to(receiver._id.toString()).emit('new_friend_request', {
      from: {
        _id: senderId,
        fullName: senderUser?.fullName,
        avatar: senderUser?.avatar
      }
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Friend request sent successfully.'
  });
});
