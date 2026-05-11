import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// استيراد النماذج (Models)
import { User } from '../models/user';
import Chat from '../models/chat';
import Message from '../models/Message';
import Post from '../models/Post';
import Job from '../models/Job';

// استيراد أدوات الحماية ومعالجة الأخطاء
import { protect } from '../middlewares/auth.middleware';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';

import { getMyProfile, updateMyProfile, getUserProfile, deleteMyAccount, searchUsers, getMyContacts, findByPhone, addConnection } from '../controllers/profile.controller';
import { toggleBlockUser, sendFriendRequest } from '../controllers/chat.controller';

import { uploadAvatar } from '../middlewares/upload.middleware';
import { uploadProfileAvatar } from '../controllers/profile.controller';
import { restrictTo } from '../middlewares/authorize.middleware';

import callRoutes from './callRoutes';
import chatRoutes from './chatRoutes';
import employerRoutes from './employer.routes';
import communityRoutes from './communityRoutes';
import postRoutes from './postRoutes';
import jobRoutes from './jobRoutes';
import notificationRoutes from './notificationRoutes';
import adminRoutes from './admin.routes';

// إنشاء الـ Router
const router = Router();
router.use('/calls', callRoutes);
router.use('/chats', chatRoutes);
router.use('/employer', employerRoutes);
router.use('/groups', communityRoutes);
router.use('/posts', postRoutes);
router.use('/jobs', jobRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

// ==========================================
// 🚀 المسارات (Routes)
// ملاحظة: مسحنا كلمة BASE_URL من هنا لأننا هنربطها في السيرفر الرئيسي
// ==========================================

router.get('/test', (req: Request, res: Response) => {
  res.send('Server is running');
});

// مسار جلب كل المستخدمين
router.get('/users', catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const users = await User.find();
  res.status(200).json(users);
}));

// NOTE: /auth/register and /auth/login are handled by authRoutes.ts
// mounted at /api/v1/auth in server.ts — do NOT add duplicate routes here.


// مسار ربط حساب جوجل (مسار محمي)
router.post('/users/link-google', protect, catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { googleId } = req.body;

  if (!googleId) {
    return next(new AppError('Google ID is required', 400));
  }

  const existingGoogleUser = await User.findOne({ googleId });
  if (existingGoogleUser) {
    return next(new AppError('This Google account is already linked to another user.', 400));
  }

  // 👇 التعديل السحري هنا: ضفنا as any 👇
  const user = req.user as any;

  user.googleId = googleId;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: "Google account has been successfully linked",
    user: {
      id: user._id,
      fullName: user.fullName,
      googleId: user.googleId
    }
  });
}));

// ✅ مسارات الشات والرسائل اتنقلت لـ chatRoutes.ts عشان تكون منظمة ومحمية
// راجع: routes/chatRoutes.ts + controllers/chat.controller.ts + services/chat.service.ts

// مسار البحث (بنحميه بـ protect عشان بس المسجلين في رابطة هما اللي يبحثوا)
router.get('/users/search/all', protect, searchUsers);

// Request Verification
import { requestVerification, toggleSaveProject, toggleSaveFreelancer, getSavedItems, clearSavedItems } from '../controllers/profile.controller';
router.put('/users/verify-request', protect, requestVerification);

// Saved Items — MUST be above /users/:id to prevent wildcard capture
router.get('/users/my-contacts', protect, getMyContacts);
router.get('/users/find-by-phone', protect, findByPhone);
router.post('/users/add-connection', protect, addConnection);
router.get('/users/saved-items', protect, getSavedItems);
router.delete('/users/saved-items/clear', protect, clearSavedItems);
router.post('/users/toggle-save-project/:projectId', protect, toggleSaveProject);
router.post('/users/toggle-save-freelancer/:freelancerId', protect, toggleSaveFreelancer);

// Block / Unblock a user
router.put('/users/block/:id', protect, toggleBlockUser);

// Send friend request via phone number
router.post('/users/friend-request', protect, sendFriendRequest);

// مسار عشان اليوزر يشوف بروفايل أي حد تاني — wildcard MUST come last
router.get('/users/:id', protect, getUserProfile);

// المسارات الشخصية (لازم يكون عامل لوجين - نستخدم الميدل وير protect)
router.get('/profile/me', protect, getMyProfile);
router.patch('/profile/me', protect, updateMyProfile); // بنستخدم Patch لأننا بنحدث أجزاء معينة مش اليوزر كله
router.delete('/profile/me', protect, deleteMyAccount);

// مسار رفع الصورة (الحارس -> مستلم الصور -> الكنترولر)
router.patch('/profile/me/avatar', protect, uploadAvatar.single('avatar'), uploadProfileAvatar);
export default router;



