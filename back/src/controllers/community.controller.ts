import { Request, Response, NextFunction } from 'express';
import Community from '../models/Community';
import Post from '../models/Post';
import Message from '../models/Message';
import Chat from '../models/chat';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as aiService from '../services/ai.service';

export const listCommunities = catchAsync(async (req: Request, res: Response) => {
  const { category } = req.query;
  const userId = (req.user as any)._id.toString();
  const filter: any = {};
  if (category) filter.category = category;
  
  const communities = await Community.find(filter)
    .populate('members', 'fullName')
    .populate({
      path: 'chatId',
      populate: {
        path: 'latestMessage',
        populate: { path: 'senderId', select: 'fullName' }
      }
    });
  
  // Calculate unread counts for each community
  const communitiesWithUnread = await Promise.all(communities.map(async (community) => {
    let unreadCount = 0;
    // Only calculate if the user is a member of this community
    if (community.chatId && community.members.some(m => m._id.toString() === userId)) {
      unreadCount = await Message.countDocuments({
        chatId: community.chatId,
        senderId: { $ne: userId },
        readBy: { $ne: userId }
      });
    }
    return { ...community.toObject(), unreadCount };
  }));

  res.status(200).json({
    status: 'success',
    data: { communities: communitiesWithUnread }
  });
});

export const createCommunity = catchAsync(async (req: Request, res: Response) => {
  const { name, description, category, tags, isPublic } = req.body;
  const owner = (req.user as any)._id;

  const communityChat = await Chat.create({
    isGroup: true,
    groupName: name,
    users: [owner],
    admins: [owner]
  });

  // 2. Create the community linked to the chat
  const community = await Community.create({
    name,
    description,
    category,
    tags,
    isPublic,
    owner,
    admins: [owner],
    members: [owner],
    chatId: communityChat._id
  });

  res.status(201).json({
    status: 'success',
    data: { community }
  });
});

export const joinCommunity = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const community = await Community.findById(req.params.id);
  if (!community) return next(new AppError('Community not found', 404));

  const userId = (req.user as any)._id;
  if (community.members.includes(userId)) {
    return next(new AppError('You are already a member of this community', 400));
  }

  // 1. Add to community members
  community.members.push(userId);
  await community.save();

  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $addToSet: { users: userId }
    });
  }

  // 2. Add to associated group chat users
  if (community.chatId) {
    await Chat.findByIdAndUpdate(community.chatId, {
      $addToSet: { users: userId }
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Joined community successfully'
  });
});

export const getCommunityFeed = catchAsync(async (req: Request, res: Response) => {
  const posts = await Post.find({ communityId: req.params.id })
    .populate('authorId', 'fullName avatar jobTitle')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    data: { posts }
  });
});

export const aiQuery = catchAsync(async (req: Request, res: Response) => {
  const { question } = req.body;
  const id = req.params.id as string;

  const result = await aiService.ragQuery(id, question);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

// ==========================================
// 💬 جلب الشات المرتبط بالمجتمع (Community Chat)
// ==========================================
// الفرونت-إند محتاج يعرف الـ chatId عشان:
// 1. يطلب تاريخ الرسائل من الـ REST API
// 2. ينضم للـ Socket room الصح باستخدام الـ chatId كـ roomId
export const getCommunityChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let community = await Community.findById(req.params.id);
  if (!community) return next(new AppError('Community not found', 404));

  const userId = (req.user as any)._id.toString();
  const isMember = community.members.some((m) => m.toString() === userId);
  if (!isMember) return next(new AppError('You must be a member to access this chat', 403));

  // If no chatId exists, create one
  if (!community.chatId) {
    const newChat = await Chat.create({
      isGroup: true,
      groupName: community.name,
      users: community.members,
      admins: [community.owner]
    });
    community.chatId = newChat._id;
    await community.save();
  }

  const populatedChat = await Chat.findById(community.chatId)
    .populate('users', 'fullName avatar jobTitle')
    .populate('latestMessage');

  res.status(200).json({
    status: 'success',
    data: {
      chat: populatedChat,
      communityName: community.name
    }
  });
});
