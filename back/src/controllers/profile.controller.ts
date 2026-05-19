import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/user';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import Job from '../models/Job';
import Chat from '../models/chat';
import mongoose from 'mongoose';

// 1. جلب بيانات البروفايل الشخصي (لليوزر اللي عامل لوجين)
export const getMyProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // سحر الميدل وير بتاعك: req.user شايل كل بيانات اليوزر وجاهز!
  res.status(200).json({
    status: 'success',
    data: { user: req.user }
  });
});

// 2. تحديث بيانات البروفايل
export const updateMyProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // 1. نمنع اليوزر يغير بيانات حساسة من هنا (رقم التليفون، الإيميل، أو الباسورد ليهم مسارات حماية خاصة)
  if (req.body.password || req.body.email || req.body.phoneNumber) {
    return next(new AppError('The password, email, or phone number cannot be updated from this path.', 400));
  }

  // 2. نمنع اليوزر يغير الـ role أو بيانات الأمان
  const updateData = { ...req.body };
  delete updateData.role;
  delete updateData.googleId;
  delete updateData.isVerified;
  delete updateData.isBanned;

  if (req.body.skills && Array.isArray(req.body.skills)) {
    const uniqueSkills = [...new Set(req.body.skills.map((skill: string) => skill.toLowerCase().trim()))];
    if (uniqueSkills.length > 15) {
      return next(new AppError('You cannot add more than 15 skills.', 400));
    }
    updateData.skills = uniqueSkills;
  }

  // 3. التحديث في قاعدة البيانات
  const updatedUser = await User.findByIdAndUpdate(
    (req.user as any)._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'The profile has been updated successfully',
    data: { user: updatedUser }
  });
});

// 3. جلب بروفايل مستخدم آخر (عشان لو حد عايز يفتح بروفايل زميله)
export const getUserProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id).select(
    'fullName avatar status aboutMe bioHeadline jobTitle location role companyName industry skills socialLinks featuredProjects links projects isVerified showOnlineStatus phoneNumber email createdAt'
  );

  if (!user) {
    return next(new AppError('This user was not found.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

// 4. حذف الحساب الشخصي
export const deleteMyAccount = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  await User.findByIdAndDelete(req.user!._id);

  res.status(204).json({ // 204 No Content
    status: 'success',
    data: null
  });
});

// ==========================================
// 👇 الإضافة الجديدة الخاصة برفع الصورة الشخصية
// ==========================================

// 5. تحديث الصورة الشخصية (Avatar)
export const uploadProfileAvatar = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. لو اليوزر مبعتش صورة أو الميدل وير رفضها
    if (!req.file) {
      return next(new AppError('Please upload an image file.', 400));
    }

    console.log('📸 Uploading file:', req.file.filename);

    // 2. ده المسار اللي اتسيف فيه الملف على السيرفر
    // بنحول الـ Backslashes لـ Forward Slashes عشان الـ URL يشتغل صح في كل الأنظمة
    const avatarUrl = req.file.path;

    console.log('🔗 Generated URL:', avatarUrl);
    console.log('🔗 Generated URL:', avatarUrl);
    // 3. تحديث اليوزر باللينك الجديد في قاعدة البيانات
    const updatedUser = await User.findByIdAndUpdate(
      (req.user as any)._id,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Avatar uploaded successfully',
      data: { user: updatedUser }
    });
  } catch (error: any) {
    console.error('❌ Upload Controller Error:', error);
    return next(new AppError(error.message || 'Error updating avatar', 500));
  }
});

// 6. البحث عن المستخدمين (للتوظيف أو التواصل)
export const searchUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // 1. تجهيز أوبجكت الفلترة الفاضي
  const queryObj: any = {};

  // أ. البحث بكلمة مفتاحية (Keyword) في الاسم أو المهارات أو النبذة
  if (req.query.keyword) {
    // استخدمنا Regex عشان نبحث عن جزء من الكلمة (حتى لو مش الكلمة كاملة)
    // حرف الـ 'i' معناه (Case-insensitive) عشان يتجاهل الحروف الكابيتال والسمول
    const searchRegex = new RegExp(req.query.keyword as string, 'i');

    queryObj.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
      { phoneNumber: searchRegex },
      { skills: searchRegex },
      { bio: searchRegex }
    ];
  }

  // ب. الفلترة المباشرة باسم المسمى الوظيفي
  if (req.query.jobTitle) {
    queryObj.jobTitle = req.query.jobTitle;
  }

  // 2. إعدادات تقسيم الصفحات (Pagination)
  const page = parseInt(req.query.page as string) || 1; // الصفحة الافتراضية 1
  const limit = parseInt(req.query.limit as string) || 10; // عدد اليوزرز في الصفحة 10
  const skip = (page - 1) * limit; // هنفوت كام يوزر عشان نجيب الصفحة اللي بعدها

  // 3. تنفيذ البحث في قاعدة البيانات
  const users = await User.find(queryObj)
    // حماية: بنحدد الداتا اللي هترجع (ضفنا الإيميل والموبايل عشان الشات يحتاجهم)
    .select('fullName avatar jobTitle email phoneNumber skills bio companyName status role')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt'); // ترتيب من الأحدث للأقدم

  // 4. حساب العدد الكلي (مهم جداً للفرونت إند عشان يعمل زراير الـ Next و الـ Prev)
  const totalUsers = await User.countDocuments(queryObj);

  res.status(200).json({
    status: 'success',
    results: users.length, // عدد اليوزرز في الصفحة دي
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers: totalUsers
    },
    data: { users }
  });
});

// 7. Request Verification (Employer)
export const requestVerification = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { verificationLink } = req.body;

  if (!verificationLink) {
    return next(new AppError('Please provide a verification link (LinkedIn or Website).', 400));
  }

  const updatedUser = await User.findByIdAndUpdate(
    (req.user as any)._id,
    { $set: { verificationLink, verificationStatus: 'pending', isVerified: false, rejectionReason: '' } },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Verification request submitted successfully. Waiting for admin approval.',
    data: { user: updatedUser }
  });
});

// 8. Toggle Save Project (For Freelancers)
export const toggleSaveProject = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const { projectId } = req.params;

  if (user.role !== 'freelancer') {
    return next(new AppError('Only freelancers can save projects.', 403));
  }

  const isSaved = user.savedProjects && user.savedProjects.some((id: any) => id.toString() === projectId.toString());

  let updatedUser;
  if (isSaved) {
    updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $pull: { savedProjects: projectId } },
      { new: true }
    );
  } else {
    updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $addToSet: { savedProjects: projectId } },
      { new: true }
    );
  }

  console.log("Updated User Saved Projects:", updatedUser?.savedProjects);

  res.status(200).json({
    status: 'success',
    message: isSaved ? 'Project removed from saved list.' : 'Project saved successfully.',
    data: { user: updatedUser }
  });
});

// 9. Toggle Save Freelancer (For Employers)
export const toggleSaveFreelancer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const { freelancerId } = req.params;

  if (user.role !== 'employer') {
    return next(new AppError('Only employers can save freelancers.', 403));
  }

  // Verify the target is actually a freelancer
  const targetUser = await User.findById(freelancerId);
  if (!targetUser) {
    return next(new AppError('User not found.', 404));
  }

  if (targetUser.role !== 'freelancer') {
    return next(new AppError('You can only save users with the freelancer role.', 400));
  }

  const isSaved = user.savedFreelancers && user.savedFreelancers.some((id: any) => id.toString() === freelancerId.toString());

  let updatedUser;
  if (isSaved) {
    updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $pull: { savedFreelancers: freelancerId } },
      { new: true }
    );
  } else {
    updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $addToSet: { savedFreelancers: freelancerId } },
      { new: true }
    );
  }

  res.status(200).json({
    status: 'success',
    message: isSaved ? 'Freelancer removed from saved list.' : 'Freelancer saved successfully.',
    data: { user: updatedUser }
  });
});

// 10. Clear All Saved Items
export const clearSavedItems = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const updateData = user.role === 'freelancer' ? { savedProjects: [] } : { savedFreelancers: [] };

  const updatedUser = await User.findByIdAndUpdate(user._id, { $set: updateData }, { new: true });

  res.status(200).json({
    status: 'success',
    message: 'All saved items cleared successfully.',
    data: { user: updatedUser }
  });
});

// 10. Get Saved Items (Projects for Freelancers, Freelancers for Employers)
export const getSavedItems = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;

  let populatedUser;
  if (user.role === 'freelancer') {
    populatedUser = await User.findById(user._id).populate('savedProjects');
  } else if (user.role === 'employer') {
    populatedUser = await User.findById(user._id).populate('savedFreelancers', 'fullName avatar jobTitle skills bio companyName status');
  } else {
    return next(new AppError('Invalid user role.', 400));
  }

  if (!populatedUser) {
    return next(new AppError('User not found.', 404));
  }

  const savedItems = user.role === 'freelancer'
    ? (populatedUser.savedProjects || [])
    : (populatedUser.savedFreelancers || []);

  res.status(200).json({
    status: 'success',
    data: { savedItems }
  });
});

// 11. Get My Contacts (Role-based visibility)
export const getMyContacts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const connectionsOnly = req.query.connectionsOnly === 'true';
  let contactIds: mongoose.Types.ObjectId[] = [];

  if (user.role === 'employer') {
    // 1. Find all freelancers who applied to any of this employer's jobs
    const jobs = await Job.find({ publisherId: user._id });
    const applicants = jobs.flatMap(job => job.applicants?.map(a => a.userId) || []);
    contactIds.push(...applicants as mongoose.Types.ObjectId[]);

    // 2. Add saved freelancers
    if (user.savedFreelancers) {
      contactIds.push(...user.savedFreelancers);
    }
  } else {
    if (user.connections) {
      contactIds.push(...user.connections as mongoose.Types.ObjectId[]);
    }

    if (!connectionsOnly) {
      const chats = await Chat.find({
        users: user._id,
        hiddenBy: { $ne: user._id },
      });
      const chatUsers = chats
        .flatMap((chat) => chat.users)
        .filter((id) => id.toString() !== user._id.toString());
      contactIds.push(...(chatUsers as mongoose.Types.ObjectId[]));
    }
  }

  // Deduplicate and filter out own ID
  const uniqueIds = Array.from(new Set(contactIds.map(id => id.toString())))
    .filter(id => id !== user._id.toString());

  const myBlockedUsers = user.blockedUsers || [];

  // Fetch full details for these contacts with Strict Privacy Filters
  const contacts = await User.find({ 
    _id: { 
      $in: uniqueIds,
      $nin: myBlockedUsers // Do not fetch users I have blocked
    },
    blockedUsers: { $ne: user._id } // Do not fetch users who have blocked me (Mutual block check)
  }).select('fullName avatar phoneNumber jobTitle status role');

  res.status(200).json({
    status: 'success',
    data: { contacts }
  });
});

// Recent contacts from 1-to-1 chat history
export const getRecentContacts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const userId = user._id.toString();
  const myBlockedUsers = user.blockedUsers || [];

  const chats = await Chat.find({
    isGroup: false,
    users: userId,
    $or: [{ hiddenBy: { $exists: false } }, { hiddenBy: { $ne: userId } }],
  }).select('users');

  const contactIds = new Set<string>();
  chats.forEach((chat) => {
    chat.users.forEach((id) => {
      const otherId = id.toString();
      if (otherId !== userId) contactIds.add(otherId);
    });
  });

  const contacts = await User.find({
    _id: { $in: Array.from(contactIds), $nin: myBlockedUsers },
    blockedUsers: { $ne: user._id },
  }).select('fullName avatar phoneNumber jobTitle status role');

  res.status(200).json({
    status: 'success',
    data: { contacts },
  });
});

// 12. Find User By Phone (1-to-1 strict search)
export const findByPhone = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { phone } = req.query;

  if (!phone) {
    return next(new AppError('Please provide a phone number.', 400));
  }

  const foundUser = await User.findOne({ phoneNumber: phone })
    .select('fullName avatar phoneNumber role jobTitle');

  res.status(200).json({
    status: 'success',
    data: {
      user: foundUser || null
    }
  });
});

// 13. Add to Connections (For Freelancers)
export const addConnection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IUser;
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError('User ID is required.', 400));
  }

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { $addToSet: { connections: userId } },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Added to your connections successfully.',
    data: { user: updatedUser }
  });
});