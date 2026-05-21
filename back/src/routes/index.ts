import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// استيراد النماذج (Models)
import { User } from "../models/user";
import Chat from "../models/chat";
import Message from "../models/Message";
import Post from "../models/Post";
import Job from "../models/Job";
import CommunityChunk from "../models/AI/CommunityChunk.model";

// استيراد أدوات الحماية ومعالجة الأخطاء
import { protect } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";

import {
  getMyProfile,
  updateMyProfile,
  getUserProfile,
  deleteMyAccount,
  searchUsers,
  getMyContacts,
  getRecentContacts,
  findByPhone,
  addConnection,
} from "../controllers/profile.controller";
import {
  toggleBlockUser,
  getBlockRelation,
  sendFriendRequest,
  deleteMessage,
  editMessage,
  togglePinMessage,
  reactToMessage,
} from "../controllers/chat.controller";

import { uploadAvatar } from "../middlewares/upload.middleware";
import { uploadProfileAvatar } from "../controllers/profile.controller";
import { restrictTo } from "../middlewares/authorize.middleware";

import callRoutes from "./callRoutes";
import chatRoutes from "./chatRoutes";
import employerRoutes from "./employer.routes";
import communityRoutes from "./communityRoutes";
import postRoutes from "./postRoutes";
import jobRoutes from "./jobRoutes";
import notificationRoutes from "./notificationRoutes";
import adminRoutes from "./admin.routes";
import aiRoutes from "./ai.routes";

// إنشاء الـ Router
const router = Router();
router.use("/calls", callRoutes);
router.use("/chats", chatRoutes);
router.use("/employer", employerRoutes);
router.use("/groups", communityRoutes);
router.use("/posts", postRoutes);
router.use("/jobs", jobRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);
router.use("/api/ai", aiRoutes);

// ==========================================
// 🚀 المسارات (Routes)
// ملاحظة: مسحنا كلمة BASE_URL من هنا لأننا هنربطها في السيرفر الرئيسي
// ==========================================

router.get("/test", (req: Request, res: Response) => {
  res.send("Server is running");
});

// مسار جلب كل المستخدمين
router.get(
  "/users",
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const users = await User.find();
    res.status(200).json(users);
  }),
);

// NOTE: /auth/register and /auth/login are handled by authRoutes.ts
// mounted at /api/v1/auth in server.ts — do NOT add duplicate routes here.

// مسار ربط حساب جوجل (مسار محمي)
router.post(
  "/users/link-google",
  protect,
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { googleId } = req.body;

    if (!googleId) {
      return next(new AppError("Google ID is required", 400));
    }

    const existingGoogleUser = await User.findOne({ googleId });
    if (existingGoogleUser) {
      return next(
        new AppError(
          "This Google account is already linked to another user.",
          400,
        ),
      );
    }

    // 👇 التعديل السحري هنا: ضفنا as any 👇
    const user = req.user as any;

    user.googleId = googleId;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Google account has been successfully linked",
      user: {
        id: user._id,
        fullName: user.fullName,
        googleId: user.googleId,
      },
    });
  }),
);

// ✅ مسارات الشات والرسائل اتنقلت لـ chatRoutes.ts عشان تكون منظمة ومحمية
// راجع: routes/chatRoutes.ts + controllers/chat.controller.ts + services/chat.service.ts

// مسار البحث (بنحميه بـ protect عشان بس المسجلين في رابطة هما اللي يبحثوا)
router.get("/users/search/all", protect, searchUsers);

// Request Verification
import {
  requestVerification,
  toggleSaveProject,
  toggleSaveFreelancer,
  getSavedItems,
  clearSavedItems,
} from "../controllers/profile.controller";
router.put("/users/verify-request", protect, requestVerification);

// Saved Items — MUST be above /users/:id to prevent wildcard capture
router.get("/users/my-contacts", protect, getMyContacts);
router.get("/users/recent-contacts", protect, getRecentContacts);
router.get("/users/find-by-phone", protect, findByPhone);
router.post("/users/add-connection", protect, addConnection);
router.get("/users/saved-items", protect, getSavedItems);
router.delete("/users/saved-items/clear", protect, clearSavedItems);
router.post(
  "/users/toggle-save-project/:projectId",
  protect,
  toggleSaveProject,
);
router.post(
  "/users/toggle-save-freelancer/:freelancerId",
  protect,
  toggleSaveFreelancer,
);

// Block / Unblock a user
router.put("/users/block/:id", protect, toggleBlockUser);

// Must be before GET /users/:id (wildcard)
router.get("/users/block-relation/:userId", protect, getBlockRelation);

// Send friend request via phone number
router.post("/users/friend-request", protect, sendFriendRequest);

// PATCH /users/settings — partial update of user settings (e.g. settings.privacy.showOnline)
router.patch(
  "/users/settings",
  protect,
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)._id;
    const { settings } = req.body;

    if (!settings || typeof settings !== "object") {
      return next(new AppError("A valid 'settings' object is required.", 400));
    }

    // Flatten nested settings into dot-notation keys to avoid overwriting sibling fields
    const updateFields: Record<string, unknown> = {};
    const flattenObject = (obj: Record<string, unknown>, prefix = "settings") => {
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        const fullKey = `${prefix}.${key}`;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          flattenObject(value as Record<string, unknown>, fullKey);
        } else {
          updateFields[fullKey] = value;
        }
      }
    };
    flattenObject(settings as Record<string, unknown>);

    if (Object.keys(updateFields).length === 0) {
      return next(new AppError("No valid settings fields provided.", 400));
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      status: "success",
      message: "Settings updated successfully.",
      data: { user: updatedUser },
    });
  })
);

// مسار عشان اليوزر يشوف بروفايل أي حد تاني — wildcard MUST come last
router.get("/users/:id", protect, getUserProfile);

// المسارات الشخصية (لازم يكون عامل لوجين - نستخدم الميدل وير protect)
router.get("/profile/me", protect, getMyProfile);
router.patch("/profile/me", protect, updateMyProfile); // بنستخدم Patch لأننا بنحدث أجزاء معينة مش اليوزر كله
router.delete("/profile/me", protect, deleteMyAccount);

// مسار طلب التوثيق لأصحاب العمل
router.post("/profile/request-verification", protect, requestVerification);

// مسار رفع الصورة (الحارس -> مستلم الصور -> الكنترولر)
router.patch(
  "/profile/me/avatar",
  protect,
  uploadAvatar.single("avatar"),
  uploadProfileAvatar,
);

// Delete / Edit / Pin / React Messages
router.delete("/messages/:id", protect, deleteMessage);
router.put("/messages/:id/edit", protect, editMessage);
router.put("/messages/:id/pin", protect, togglePinMessage);
router.post("/messages/:id/react", protect, reactToMessage);

export default router;
