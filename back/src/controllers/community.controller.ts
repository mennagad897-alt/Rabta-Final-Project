import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Community from "../models/Community";
import Post from "../models/Post";
import Message from "../models/Message";
import Chat from "../models/chat";
import { User } from "../models/user";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import {
  countUnreadMessages,
  getChatMessages,
  leaveCommunity as leaveCommunityService,
} from "../services/chat.service";

// ==========================================
// 📋 جلب قائمة الـ Communities
// ==========================================
// [FIX #9] كنا بنرجع كل الـ communities لكل اليوزرز
// دلوقتي بنرجع بس الـ communities اللي المستخدم الحالي عضو فيها
export const listCommunities = catchAsync(
  async (req: Request, res: Response) => {
    const { category } = req.query;
    const userId = (req.user as any)._id.toString();

    const filter: any = {
      $or: [{ members: userId }, { invitedUsers: userId }],
    };
    if (category) filter.category = category;

    const communities = await Community.find(filter)
      .populate("owner", "fullName avatar")
      .populate("members", "fullName avatar")
      .populate("admins", "fullName avatar")
      .populate("invitedUsers", "fullName avatar")
      .populate("joinRequests.userId", "fullName avatar")
      .populate({
        path: "chatId",
        populate: {
          path: "latestMessage",
          populate: { path: "senderId", select: "fullName" },
        },
      });

    // حساب عدد الرسائل غير المقروءة لكل community
    const communitiesWithUnread = await Promise.all(
      communities.map(async (community) => {
        let unreadCount = 0;
        if (community.chatId) {
          const chatId =
            typeof community.chatId === "object" && community.chatId !== null
              ? String((community.chatId as { _id: unknown })._id)
              : String(community.chatId);
          const chatDoc = await Chat.findById(chatId).select(
            "clearStates isGroup",
          );
          if (chatDoc) {
            unreadCount = await countUnreadMessages(chatId, userId, chatDoc);
          }
        }
        return { ...community.toObject(), unreadCount };
      }),
    );

    res.status(200).json({
      status: "success",
      data: { communities: communitiesWithUnread },
    });
  },
);

// ==========================================
// 🔍 Global community search (public groups in database)
// ==========================================
export const searchCommunities = catchAsync(
  async (req: Request, res: Response) => {
    const raw = (req.query.search as string) || (req.query.q as string) || "";
    const q = raw.trim();
    if (!q) {
      return res.status(200).json({
        status: "success",
        data: { communities: [] },
      });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const communities = await Community.find({
      $or: [
        { name: regex },
        { description: regex },
        { tags: regex },
        { category: regex },
      ],
    })
      .populate("owner", "fullName avatar")
      .populate("joinRequests.userId", "fullName avatar")
      .select(
        "name description avatar members tags category isPublic createdAt joinRequests",
      )
      .limit(30)
      .sort("-createdAt");

    res.status(200).json({
      status: "success",
      results: communities.length,
      data: { communities },
    });
  },
);

// ==========================================
// ➕ إنشاء Community جديدة
// ==========================================
// [FIX #9] كان بيضيف كل الـ invitedUsers تلقائياً في الـ members
// دلوقتي بس المنشئ هو اللي بيتضاف، والـ invitedUsers دي مرحلة تانية (invite system)
export const createCommunity = catchAsync(
  async (req: Request, res: Response) => {
    const { name, description, category, tags, isPublic, invitedUsers } =
      req.body;
    const owner = (req.user as any)._id;
    const ownerIdStr = owner.toString();

    const invitedIds = (
      Array.isArray(invitedUsers) ? invitedUsers : []
    )
      .map((id: string) => id?.toString?.() ?? String(id))
      .filter((id: string) => id && id !== ownerIdStr)
      .map((id: string) => new mongoose.Types.ObjectId(id));

    const memberIds = [owner, ...invitedIds];

    const communityChat = await Chat.create({
      isGroup: true,
      groupName: name,
      users: memberIds,
      admins: [owner],
      isPrivate: !isPublic,
    });

    const community = await Community.create({
      name,
      description,
      category,
      tags,
      isPublic,
      owner,
      admins: [owner],
      members: memberIds,
      chatId: communityChat._id,
    });

    if (invitedIds.length > 0) {
      const ownerUser = await User.findById(owner).select("fullName");
      const ownerName = ownerUser?.fullName || "Someone";
      const systemMessage = await Message.create({
        chatId: communityChat._id,
        senderId: owner,
        content: `${ownerName} added you to the group`,
        messageType: "text",
        status: "sent",
      });
      await Chat.findByIdAndUpdate(communityChat._id, {
        latestMessage: systemMessage._id,
      });
    }

    const populatedCommunity = await Community.findById(community._id)
      .populate("members", "fullName avatar")
      .populate("admins", "fullName avatar")
      .populate({
        path: "chatId",
        populate: {
          path: "latestMessage",
          populate: { path: "senderId", select: "fullName" },
        },
      });

    const io = req.app.get("io");
    if (io && invitedIds.length > 0) {
      const payload = { community: populatedCommunity };
      invitedIds.forEach((userId) => {
        io.to(userId.toString()).emit("added-to-community", payload);
      });
    }

    res.status(201).json({
      status: "success",
      data: { community: populatedCommunity },
    });
  },
);

// ==========================================
// 🚪 Join community (public) or request access (private)
// ==========================================
export const joinCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const community = await Community.findById(req.params.id);
    if (!community) return next(new AppError("Community not found", 404));

    const userId = (req.user as any)._id;

    if (community.members.some((m) => m.toString() === userId.toString())) {
      return next(
        new AppError("You are already a member of this community", 400),
      );
    }

    if (!community.isPublic) {
      const existingRequest = community.joinRequests.find(
        (r) =>
          r.userId.toString() === userId.toString() && r.status === "pending",
      );
      if (existingRequest) {
        return next(
          new AppError(
            "You already have a pending join request for this community",
            400,
          ),
        );
      }

      community.joinRequests.push({
        userId,
        requestedAt: new Date(),
        status: "pending",
      });
      await community.save();

      return res.status(200).json({
        status: "success",
        message: "Request sent",
        data: { requestSent: true },
      });
    }

    community.members.push(userId);
    await community.save();

    if (community.chatId) {
      await Chat.findByIdAndUpdate(community.chatId, {
        $addToSet: { users: userId },
      });
    }

    res.status(200).json({
      status: "success",
      message: "Joined community successfully",
      data: { requestSent: false },
    });
  },
);

// ==========================================
// ✅❌ Accept or reject a join request (admins only)
// ==========================================
export const manageJoinRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const communityId = String(req.params.id);
    const targetUserId = String(req.params.userId);
    const { action } = req.body;
    const adminId = (req.user as any)._id.toString();

    if (!["accept", "reject"].includes(action)) {
      return next(new AppError("Action must be 'accept' or 'reject'", 400));
    }

    const community = await Community.findById(communityId);
    if (!community) return next(new AppError("Community not found", 404));

    const isAdmin =
      community.owner.toString() === adminId ||
      community.admins.some((a) => a.toString() === adminId);

    if (!isAdmin) {
      return next(
        new AppError("You are not authorized to manage join requests", 403),
      );
    }

    const requestIndex = community.joinRequests.findIndex(
      (r) =>
        r.userId.toString() === targetUserId.toString() &&
        r.status === "pending",
    );
    if (requestIndex === -1) {
      return next(new AppError("Join request not found", 404));
    }

    community.joinRequests.splice(requestIndex, 1);

    if (action === "accept") {
      if (
        !community.members.some((m) => m.toString() === targetUserId.toString())
      ) {
        community.members.push(new mongoose.Types.ObjectId(targetUserId));
      }
      await community.save();

      if (community.chatId) {
        await Chat.findByIdAndUpdate(community.chatId, {
          $addToSet: { users: targetUserId },
        });
      }

      const populatedCommunity = await Community.findById(community._id)
        .populate("members", "fullName avatar")
        .populate("admins", "fullName avatar")
        .populate("joinRequests.userId", "fullName avatar")
        .populate({
          path: "chatId",
          populate: {
            path: "latestMessage",
            populate: { path: "senderId", select: "fullName" },
          },
        });

      const io = req.app.get("io");
      if (io && populatedCommunity) {
        io.to(targetUserId.toString()).emit("added-to-community", {
          community: populatedCommunity,
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Join request accepted. User has been added to the community.",
        data: { community: populatedCommunity },
      });
    }

    await community.save();

    res.status(200).json({
      status: "success",
      message: "Join request rejected.",
    });
  },
);

// ==========================================
// 🚪 Leave community
// ==========================================
export const leaveCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const result = await leaveCommunityService(String(req.params.id), userId);
    res.status(200).json({
      status: "success",
      message: result.message,
    });
  },
);

const populateCommunityForClient = (communityId: string) =>
  Community.findById(communityId)
    .populate("members", "fullName avatar")
    .populate("admins", "fullName avatar")
    .populate("owner", "fullName avatar")
    .populate("invitedUsers", "fullName avatar")
    .populate("joinRequests.userId", "fullName avatar")
    .populate({
      path: "chatId",
      populate: {
        path: "latestMessage",
        populate: { path: "senderId", select: "fullName" },
      },
    });

// ==========================================
// ➕ Invite user to community (owner/admin only)
// ==========================================
export const addCommunityMember = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const adminId = (req.user as any)._id.toString();
    const communityId = String(req.params.id);
    const targetUserId = String(req.body.userId);

    if (!targetUserId) {
      return next(new AppError("userId is required", 400));
    }

    const community = await Community.findById(communityId);
    if (!community) return next(new AppError("Community not found", 404));

    const isAdmin =
      community.owner.toString() === adminId ||
      community.admins.some((a) => a.toString() === adminId);
    if (!isAdmin) {
      return next(new AppError("Only admins can invite members", 403));
    }

    if (community.members.some((m) => m.toString() === targetUserId)) {
      return next(new AppError("User is already a member", 400));
    }

    if (community.invitedUsers?.some((id) => id.toString() === targetUserId)) {
      return next(new AppError("User already has a pending invitation", 400));
    }

    community.invitedUsers = community.invitedUsers || [];
    community.invitedUsers.push(new mongoose.Types.ObjectId(targetUserId));
    await community.save();

    const populatedCommunity = await populateCommunityForClient(communityId);

    const io = req.app.get("io");
    if (io && populatedCommunity) {
      io.to(targetUserId).emit("invited-to-community", {
        community: populatedCommunity,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Invitation sent",
      data: { community: populatedCommunity },
    });
  },
);

// ==========================================
// ✅ Accept community invitation
// ==========================================
export const acceptCommunityInvite = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const communityId = String(req.params.id);

    const community = await Community.findById(communityId);
    if (!community) return next(new AppError("Community not found", 404));

    const invited = community.invitedUsers?.some(
      (id) => id.toString() === userId,
    );
    if (!invited) {
      return next(new AppError("No pending invitation for this community", 404));
    }

    community.invitedUsers = (community.invitedUsers || []).filter(
      (id) => id.toString() !== userId,
    );
    if (!community.members.some((m) => m.toString() === userId)) {
      community.members.push(new mongoose.Types.ObjectId(userId));
    }
    await community.save();

    if (community.chatId) {
      await Chat.findByIdAndUpdate(community.chatId, {
        $addToSet: { users: userId },
      });
    }

    const populatedCommunity = await populateCommunityForClient(communityId);

    const io = req.app.get("io");
    if (io && populatedCommunity) {
      io.to(userId).emit("added-to-community", { community: populatedCommunity });
    }

    res.status(200).json({
      status: "success",
      message: "Invitation accepted",
      data: { community: populatedCommunity },
    });
  },
);

// ==========================================
// ❌ Decline community invitation
// ==========================================
export const declineCommunityInvite = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const communityId = String(req.params.id);

    const community = await Community.findById(communityId);
    if (!community) return next(new AppError("Community not found", 404));

    const before = community.invitedUsers?.length ?? 0;
    community.invitedUsers = (community.invitedUsers || []).filter(
      (id) => id.toString() !== userId,
    );
    if (community.invitedUsers.length === before) {
      return next(new AppError("No pending invitation for this community", 404));
    }
    await community.save();

    res.status(200).json({
      status: "success",
      message: "Invitation declined",
    });
  },
);

// ==========================================
// 🗑️ Delete community (owner/admin only)
// ==========================================
export const deleteCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id.toString();
    const community = await Community.findById(req.params.id);

    if (!community) {
      return next(new AppError("Community not found", 404));
    }

    const isOwnerOrAdmin =
      community.owner.toString() === userId ||
      community.admins.some((a) => a.toString() === userId);

    if (!isOwnerOrAdmin) {
      return next(
        new AppError("You are not authorized to delete this community", 403),
      );
    }

    const chatId = community.chatId;
    await Community.findByIdAndDelete(community._id);
    if (chatId) {
      await Chat.findByIdAndDelete(chatId);
    }

    res.status(200).json({
      status: "success",
      message: "Community deleted successfully",
    });
  },
);

// ==========================================
// 📰 جلب الـ Feed بتاع الـ Community
// ==========================================
export const getCommunityFeed = catchAsync(
  async (req: Request, res: Response) => {
    const posts = await Post.find({ communityId: req.params.id })
      .populate("authorId", "fullName avatar jobTitle")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      data: { posts },
    });
  },
);

// ==========================================
// 💬 جلب الشات المرتبط بالـ Community
// ==========================================
export const getCommunityChat = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const community = await Community.findById(req.params.id).populate(
      "chatId",
    );
    if (!community) return next(new AppError("Community not found", 404));

    const userId = (req.user as any)._id.toString();
    const isMember = community.members.some((m) => m.toString() === userId);

    if (!isMember) {
      return next(
        new AppError("You must be a member to access this chat", 403),
      );
    }

    if (!community.chatId) {
      return next(new AppError("This community does not have a chat yet", 404));
    }

    const chatId =
      typeof community.chatId === "object" && community.chatId !== null
        ? (community.chatId as { _id: { toString(): string } })._id.toString()
        : String(community.chatId);

    const messages = await getChatMessages(chatId, userId, 30);

    res.status(200).json({
      status: "success",
      data: {
        chatId,
        communityName: community.name,
        messages,
      },
    });
  },
);
