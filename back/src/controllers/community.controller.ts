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

    // [FIX #9] الـ filter الرئيسي: بس الـ communities اللي المستخدم في الـ members بتاعتها
    const filter: any = { members: userId };
    if (category) filter.category = category;

    const communities = await Community.find(filter)
      .populate("members", "fullName avatar")
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
      isPublic: true,
      $or: [
        { name: regex },
        { description: regex },
        { tags: regex },
        { category: regex },
      ],
    })
      .populate("owner", "fullName avatar")
      .select("name description avatar members tags category isPublic createdAt")
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
// 🚪 الانضمام لـ Community عامة (Public)
// ==========================================
export const joinCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const community = await Community.findById(req.params.id);
    if (!community) return next(new AppError("Community not found", 404));

    const userId = (req.user as any)._id;

    // التحقق إن المستخدم مش عضو بالفعل
    if (community.members.some((m) => m.toString() === userId.toString())) {
      return next(
        new AppError("You are already a member of this community", 400),
      );
    }

    // [FIX #10] لو الـ community خاصة، مينفعش ينضم مباشرة
    if (!community.isPublic) {
      return next(
        new AppError(
          "This community is private. Please send a join request instead.",
          403,
        ),
      );
    }

    // إضافة المستخدم للـ members
    community.members.push(userId);
    await community.save();

    // إضافة المستخدم للـ Chat المرتبط بالـ community
    if (community.chatId) {
      await Chat.findByIdAndUpdate(community.chatId, {
        $addToSet: { users: userId },
      });
    }

    res.status(200).json({
      status: "success",
      message: "Joined community successfully",
    });
  },
);

// ==========================================
// 📩 إرسال طلب انضمام لـ Community خاصة (Private)
// ==========================================
// [FIX #10] ميزة جديدة: المستخدم يبعت request والأدمن يقبل أو يرفض
export const requestJoinCommunity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const community = await Community.findById(req.params.id);
    if (!community) return next(new AppError("Community not found", 404));

    const userId = (req.user as any)._id;

    // التحقق إن المستخدم مش عضو بالفعل
    if (community.members.some((m) => m.toString() === userId.toString())) {
      return next(
        new AppError("You are already a member of this community", 400),
      );
    }

    // التحقق إن المستخدم ماعندوش request معلق بالفعل
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

    // لو الـ community عامة، المستخدم يانضم مباشرة بدل ما يبعت request
    if (community.isPublic) {
      return next(
        new AppError(
          "This community is public. Use the join endpoint instead.",
          400,
        ),
      );
    }

    // إضافة الطلب
    community.joinRequests.push({
      userId,
      requestedAt: new Date(),
      status: "pending",
    });
    await community.save();

    // TODO (المرحلة 6): إرسال إشعار للأدمنز عبر الـ Socket

    res.status(200).json({
      status: "success",
      message: "Join request sent successfully. Waiting for admin approval.",
    });
  },
);

// ==========================================
// ✅❌ الرد على طلب الانضمام (قبول أو رفض) — للأدمنز بس
// ==========================================
// [FIX #10] الأدمن يقدر يقبل أو يرفض طلبات الانضمام
export const respondToJoinRequest = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id: communityId, requestId } = req.params;
    const { action } = req.body; // action: 'accept' | 'reject'
    const adminId = (req.user as any)._id.toString();

    if (!["accept", "reject"].includes(action)) {
      return next(new AppError("Action must be 'accept' or 'reject'", 400));
    }

    const community = await Community.findById(communityId);
    if (!community) return next(new AppError("Community not found", 404));

    // التحقق إن المستخدم الحالي أدمن في الـ community
    const isAdmin =
      community.owner.toString() === adminId ||
      community.admins.some((a) => a.toString() === adminId);

    if (!isAdmin) {
      return next(
        new AppError("You are not authorized to manage join requests", 403),
      );
    }

    // إيجاد الطلب
    const joinRequest = community.joinRequests.find(
      (r) => r._id?.toString() === requestId,
    );
    if (!joinRequest) {
      return next(new AppError("Join request not found", 404));
    }
    if (joinRequest.status !== "pending") {
      return next(new AppError("This request has already been processed", 400));
    }

    if (action === "accept") {
      // قبول الطلب: إضافة المستخدم للـ members
      joinRequest.status = "accepted";
      community.members.push(joinRequest.userId);
      await community.save();

      // إضافة المستخدم للـ Chat المرتبط
      if (community.chatId) {
        await Chat.findByIdAndUpdate(community.chatId, {
          $addToSet: { users: joinRequest.userId },
        });
      }

      // TODO (المرحلة 6): إرسال إشعار للمستخدم بالقبول عبر الـ Socket

      res.status(200).json({
        status: "success",
        message: "Join request accepted. User has been added to the community.",
      });
    } else {
      // رفض الطلب
      joinRequest.status = "rejected";
      await community.save();

      // TODO (المرحلة 6): إرسال إشعار للمستخدم بالرفض عبر الـ Socket

      res.status(200).json({
        status: "success",
        message: "Join request rejected.",
      });
    }
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
