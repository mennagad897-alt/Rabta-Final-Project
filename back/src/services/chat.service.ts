import mongoose from 'mongoose';
import Chat from '../models/chat';
import Message from '../models/Message';
import Community from '../models/Community';
import { AppError } from '../utils/AppError';
import * as aiService from './ai.service';

// ==========================================
// 💬 سيرفس الشات والرسائل
// ==========================================
// ليه عندنا Chat و Message كموديلين منفصلين؟
// 1. الـ Chat هو "الغرفة" أو "المحادثة" - بيحتوي على قائمة المشاركين ونوع المحادثة (فردي/جماعي)
// 2. الـ Message هو "الرسالة" نفسها - بتنتمي لشات معين وبتحتوي على المحتوى والمرسل
// 3. الفصل ده بيخلينا نقدر نجيب الرسائل بالـ pagination من غير ما نحمّل كل حاجة مرة واحدة
// 4. لو حطينا الرسائل جوا الشات، الـ document هيكبر جداً ويبقى بطيء (MongoDB document size limit = 16MB)

// ==========================================
// 📨 إرسال رسالة جديدة وحفظها في الداتا بيز
// ==========================================
export const createMessage = async (data: {
  chatId: string;
  senderId: string;
  content: string;
  messageType?: string;
  attachments?: { fileUrl: string; fileType: string; fileSize?: number }[];
}) => {
  // التأكد إن الشات موجود فعلاً
  const chat = await Chat.findById(data.chatId);
  if (!chat) throw new AppError('Chat not found', 404);

  // التأكد إن المرسل عضو في الشات ده (حماية مهمة)
  const isMember = chat.users.some(
    (userId) => userId.toString() === data.senderId
  );
  if (!isMember) throw new AppError('You are not a member of this chat', 403);

  // إنشاء الرسالة في الداتا بيز
  const signal = aiService.analyzeSignal(data.content);
  
  const newMessage = await Message.create({
    chatId: data.chatId,
    senderId: data.senderId,
    content: data.content,
    messageType: data.messageType || 'text',
    attachments: data.attachments,
    signal
  });

  // Extract tasks in background
  aiService.extractTasks(newMessage).catch(err => console.error('AI Extraction Error:', err));

  // تحديث آخر رسالة في الشات عشان الفرونت إند يعرضها في قائمة المحادثات
  await Chat.findByIdAndUpdate(data.chatId, { latestMessage: newMessage._id });

  // بنرجع الرسالة مع بيانات المرسل (الاسم والصورة)
  const populatedMessage = await Message.findById(newMessage._id)
    .populate('senderId', 'fullName avatar');

  return populatedMessage;
};

// ==========================================
// 📜 جلب تاريخ الرسائل (History) لشات معين
// ==========================================
// ليه بنجيب history بالـ limit؟
// 1. المحادثة ممكن يكون فيها آلاف الرسائل، مينفعش نجيبهم كلهم مرة واحدة (هيبطئ السيرفر والفرونت إند)
// 2. بنستخدم cursor-based pagination (قبل رسالة معينة) عشان الأداء يكون أحسن من skip/limit
// 3. الفرونت إند بيجيب أول 30 رسالة، ولما اليوزر يعمل scroll لفوق بيجيب الـ 30 اللي قبلهم
export const getChatMessages = async (
  chatId: string,
  userId: string,
  limit: number = 30,
  before?: string // cursor: الرسائل اللي قبل الـ ID ده
) => {
  // التأكد إن الشات موجود واليوزر عضو فيه
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError('Chat not found', 404);

  const isMember = chat.users.some(
    (userId_) => userId_.toString() === userId
  );
  if (!isMember) throw new AppError('You are not a member of this chat', 403);

  // بناء الـ query
  const query: any = { chatId };

  // Cursor-based pagination: load messages AFTER the given ID (ascending order)
  if (before) {
    query._id = { $lt: new mongoose.Types.ObjectId(before) };
  }

  const safeLimit = Math.min(Math.max(limit, 20), 50);

  const messages = await Message.find(query)
    .populate('senderId', 'fullName avatar')
    .sort({ createdAt: 1 }) // ✅ Ascending: oldest first, newest last — correct chronological order
    .limit(safeLimit);

  return messages; // ✅ No .reverse() needed — sort is already chronological
};

// ==========================================
// 🤝 إنشاء أو جلب محادثة فردية (One-to-One)
// ==========================================
export const accessOrCreateChat = async (currentUserId: string, otherUserId: string) => {
  // بنبحث هل فيه شات فردي (مش جروب) بين اليوزرين دول
  let chat = await Chat.findOne({
    isGroup: false,
    users: { $all: [currentUserId, otherUserId], $size: 2 }
  })
    .populate('users', 'fullName avatar status')
    .populate('latestMessage');

  // لو مش موجود بننشئ واحد جديد
  if (!chat) {
    chat = await Chat.create({
      isGroup: false,
      users: [currentUserId, otherUserId]
    });
    chat = await Chat.findById(chat._id)
      .populate('users', 'fullName avatar status');
  }

  return chat;
};

// ==========================================
// 👥 إنشاء محادثة جماعية (Group Chat)
// ==========================================
export const createGroupChat = async (
  adminId: string,
  groupName: string,
  memberIds: string[],
  isPrivate: boolean = false
) => {
  // لازم يكون فيه على الأقل عضوين غير الأدمن
  if (!memberIds || memberIds.length < 2) {
    throw new AppError('Group chat must have at least 2 members besides admin', 400);
  }

  // الأدمن بيكون عضو تلقائياً
  const allUsers = [adminId, ...memberIds.filter(id => id !== adminId)];

  const groupChat = await Chat.create({
    isGroup: true,
    groupName,
    users: allUsers,
    admins: [adminId],
    isPrivate
  });

  const populatedChat = await Chat.findById(groupChat._id)
    .populate('users', 'fullName avatar status')
    .populate('admins', 'fullName avatar');

  return populatedChat;
};

// ==========================================
// ➕ إضافة عضو للجروب (Admin Only)
// ==========================================
export const addMemberToGroup = async (chatId: string, adminId: string, newMemberId: string) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError('Chat not found', 404);
  if (!chat.isGroup) throw new AppError('This is not a group chat', 400);

  // التأكد إن اللي بيضيف هو أدمن
  const isAdmin = chat.admins?.some(id => id.toString() === adminId);
  if (!isAdmin) throw new AppError('Only admins can add members', 403);

  // التأكد إن العضو مش موجود أصلاً
  const alreadyMember = chat.users.some(id => id.toString() === newMemberId);
  if (alreadyMember) throw new AppError('User is already a member', 400);

  chat.users.push(new mongoose.Types.ObjectId(newMemberId));
  await chat.save();

  const updatedChat = await Chat.findById(chatId)
    .populate('users', 'fullName avatar status')
    .populate('admins', 'fullName avatar');

  return updatedChat;
};

// ==========================================
// ➖ إزالة عضو من الجروب (Admin Only)
// ==========================================
export const removeMemberFromGroup = async (chatId: string, adminId: string, memberId: string) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError('Chat not found', 404);
  if (!chat.isGroup) throw new AppError('This is not a group chat', 400);

  const isAdmin = chat.admins?.some(id => id.toString() === adminId);
  if (!isAdmin) throw new AppError('Only admins can remove members', 403);

  // مينفعش الأدمن يشيل نفسه (لازم يسيب الجروب بدل كده)
  if (memberId === adminId) throw new AppError('Admin cannot remove themselves, use leave instead', 400);

  chat.users = chat.users.filter(id => id.toString() !== memberId);
  // لو العضو كان أدمن كمان، نشيله من الأدمنز
  if (chat.admins) {
    chat.admins = chat.admins.filter(id => id.toString() !== memberId);
  }
  await chat.save();

  const updatedChat = await Chat.findById(chatId)
    .populate('users', 'fullName avatar status')
    .populate('admins', 'fullName avatar');

  return updatedChat;
};

// ==========================================
// 🚪 مغادرة الجروب (أي عضو)
// ==========================================
export const leaveGroup = async (chatId: string, userId: string) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new AppError('Chat not found', 404);
  if (!chat.isGroup) throw new AppError('This is not a group chat', 400);

  const isMember = chat.users.some(id => id.toString() === userId);
  if (!isMember) throw new AppError('You are not a member of this group', 400);

  // شيل اليوزر من الأعضاء والأدمنز
  chat.users = chat.users.filter(id => id.toString() !== userId);
  if (chat.admins) {
    chat.admins = chat.admins.filter(id => id.toString() !== userId);
  }

  // لو مفيش أدمنز تاني، أول عضو يبقى أدمن تلقائياً
  if (chat.admins && chat.admins.length === 0 && chat.users.length > 0) {
    chat.admins.push(chat.users[0]);
  }

  await chat.save();
  return { message: 'You have left the group successfully' };
};

// ==========================================
// 🏘️ إنشاء مجتمع متخصص (Community)
// ==========================================
export const createCommunity = async (
  ownerId: string,
  name: string,
  description: string,
  tags?: string[]
) => {
  // بننشئ شات جماعي مرتبط بالمجتمع تلقائياً
  const communityChat = await Chat.create({
    isGroup: true,
    groupName: name,
    users: [ownerId],
    admins: [ownerId]
  });

  const community = await Community.create({
    name,
    description,
    owner: ownerId,
    admins: [ownerId],
    members: [ownerId],
    chatId: communityChat._id,
    tags: tags || []
  });

  const populatedCommunity = await Community.findById(community._id)
    .populate('owner', 'fullName avatar')
    .populate('members', 'fullName avatar')
    .populate('chatId');

  return populatedCommunity;
};

// ==========================================
// 🚪 الانضمام لمجتمع (Join Community)
// ==========================================
export const joinCommunity = async (communityId: string, userId: string) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError('Community not found', 404);

  // التأكد إن اليوزر مش عضو أصلاً
  const alreadyMember = community.members.some(id => id.toString() === userId);
  if (alreadyMember) throw new AppError('You are already a member', 400);

  // لو المجتمع خاص، مينفعش ينضم من غير دعوة
  if (!community.isPublic) {
    throw new AppError('This is a private community, you need an invitation', 403);
  }

  // ضيف اليوزر كعضو في المجتمع وفي الشات المرتبط
  community.members.push(new mongoose.Types.ObjectId(userId));
  await community.save();

  // ضيفه في الشات الجماعي كمان
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $addToSet: { users: userId }
    });
  }

  return { message: 'Joined community successfully' };
};

// ==========================================
// 🚪 مغادرة مجتمع (Leave Community)
// ==========================================
export const leaveCommunity = async (communityId: string, userId: string) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError('Community not found', 404);

  // صاحب المجتمع مينفعش يغادر (لازم يمسح المجتمع أو ينقل الملكية)
  if (community.owner.toString() === userId) {
    throw new AppError('Owner cannot leave the community, transfer ownership first', 400);
  }

  community.members = community.members.filter(id => id.toString() !== userId);
  community.admins = community.admins.filter(id => id.toString() !== userId);
  await community.save();

  // شيله من الشات كمان
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $pull: { users: userId }
    });
  }

  return { message: 'Left community successfully' };
};

// ==========================================
// ➕ إضافة عضو للمجتمع (Admin Only)
// ==========================================
export const addMemberToCommunity = async (communityId: string, adminId: string, newMemberId: string) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError('Community not found', 404);

  const isAdmin = community.admins.some(id => id.toString() === adminId);
  if (!isAdmin) throw new AppError('Only admins can add members', 403);

  const alreadyMember = community.members.some(id => id.toString() === newMemberId);
  if (alreadyMember) throw new AppError('User is already a member', 400);

  community.members.push(new mongoose.Types.ObjectId(newMemberId));
  await community.save();

  // ضيفه في الشات كمان
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $addToSet: { users: newMemberId }
    });
  }

  const updatedCommunity = await Community.findById(communityId)
    .populate('members', 'fullName avatar');

  return updatedCommunity;
};

// ==========================================
// ➖ إزالة عضو من المجتمع (Admin Only)
// ==========================================
export const removeMemberFromCommunity = async (communityId: string, adminId: string, memberId: string) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError('Community not found', 404);

  const isAdmin = community.admins.some(id => id.toString() === adminId);
  if (!isAdmin) throw new AppError('Only admins can remove members', 403);

  if (community.owner.toString() === memberId) {
    throw new AppError('Cannot remove the community owner', 400);
  }

  community.members = community.members.filter(id => id.toString() !== memberId);
  community.admins = community.admins.filter(id => id.toString() !== memberId);
  await community.save();

  // شيله من الشات كمان
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $pull: { users: memberId }
    });
  }

  const updatedCommunity = await Community.findById(communityId)
    .populate('members', 'fullName avatar');

  return updatedCommunity;
};

// ==========================================
// 🔄 تحديث بيانات المجتمع (Admin Only)
// ==========================================
export const updateCommunity = async (
  communityId: string,
  adminId: string,
  updates: { name?: string; description?: string; avatar?: string; tags?: string[]; isPublic?: boolean }
) => {
  const community = await Community.findById(communityId);
  if (!community) throw new AppError('Community not found', 404);

  const isAdmin = community.admins.some(id => id.toString() === adminId);
  if (!isAdmin) throw new AppError('Only admins can update community', 403);

  // تحديث الحقول المسموح بيها بس
  const allowedUpdates: any = {};
  if (updates.name !== undefined) allowedUpdates.name = updates.name;
  if (updates.description !== undefined) allowedUpdates.description = updates.description;
  if (updates.avatar !== undefined) allowedUpdates.avatar = updates.avatar;
  if (updates.tags !== undefined) allowedUpdates.tags = updates.tags;
  if (updates.isPublic !== undefined) allowedUpdates.isPublic = updates.isPublic;

  const updatedCommunity = await Community.findByIdAndUpdate(communityId, allowedUpdates, {
    new: true,
    runValidators: true
  })
    .populate('owner', 'fullName avatar')
    .populate('members', 'fullName avatar');

  return updatedCommunity;
};

// ==========================================
// 📋 جلب كل المجتمعات (مع pagination)
// ==========================================
export const getAllCommunities = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const communities = await Community.find({ isPublic: true })
    .populate('owner', 'fullName avatar')
    .select('name description avatar members tags createdAt')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  const total = await Community.countDocuments({ isPublic: true });

  return {
    communities,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCommunities: total
    }
  };
};

// ==========================================
// 🔍 جلب مجتمع بالتفصيل
// ==========================================
export const getCommunityById = async (communityId: string) => {
  const community = await Community.findById(communityId)
    .populate('owner', 'fullName avatar')
    .populate('admins', 'fullName avatar')
    .populate('members', 'fullName avatar status')
    .populate('chatId');

  if (!community) throw new AppError('Community not found', 404);

  return community;
};

// ==========================================
// 📋 جلب محادثات اليوزر (كل الشاتات اللي هو عضو فيها)
// ==========================================
export const getUserChats = async (userId: string) => {
  const chats = await Chat.find({ users: userId, isGroup: false })
    .populate('users', 'fullName avatar status')
    .populate({
      path: 'latestMessage',
      populate: { path: 'senderId', select: 'fullName _id' }
    })
    .populate('admins', 'fullName avatar')
    .sort('-updatedAt');

  const chatsWithUnread = await Promise.all(chats.map(async (chat) => {
    const unreadCount = await Message.countDocuments({
      chatId: chat._id,
      senderId: { $ne: userId },
      status: { $ne: 'read' }
    });
    return { ...chat.toObject(), unreadCount };
  }));

  return chatsWithUnread;
};

export const getSharedContent = async (chatId: string) => {
  const messages = await Message.find({ chatId });
  const shared = {
    media: [] as any[],
    files: [] as any[],
    links: [] as any[]
  };

  messages.forEach(msg => {
    if (msg.messageType === 'image') {
      shared.media.push({ url: msg.content || msg.attachments?.[0]?.fileUrl, createdAt: msg.createdAt });
    } else if (msg.messageType === 'file') {
      shared.files.push({ url: msg.content || msg.attachments?.[0]?.fileUrl, name: msg.attachments?.[0]?.fileType, createdAt: msg.createdAt });
    }
    
    // Extract links from text content
    if (msg.content) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const links = msg.content.match(urlRegex);
      if (links) {
        links.forEach(link => shared.links.push({ url: link, createdAt: msg.createdAt }));
      }
    }
  });

  return shared;
};
