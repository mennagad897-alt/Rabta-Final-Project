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

  // 2. نفلتر الداتا عشان الهاكرز ميرفعوش الـ role بتاعهم لـ Admin مثلاً!
  let normalizedSkills;

  if (req.body.skills && Array.isArray(req.body.skills)) {
    // ليه بنعمل normalization:
    // عشان نوحد شكل البيانات في الداتا بيز (كله حروف صغيرة ومن غير مسافات زيادة)
    // ده بيحسن جداً من كفاءة البحث وبيمنع تكرار نفس المهارة بأشكال مختلفة (مثلاً React و react و  React)
    const uniqueSkills = [...new Set(
      req.body.skills.map((skill: string) => skill.toLowerCase().trim())
    )];

    // ليه حاطين limit:
    // عشان نحمي الداتا بيز من أحجام البيانات الضخمة (الـ Payload) ونمنع اليوزر إنه يضيف مهارات عشوائية بلا نهاية فده بيحسن الأداء
    if (uniqueSkills.length > 15) {
      return next(new AppError('You cannot add more than 15 skills.', 400));
    }
    normalizedSkills = uniqueSkills;
  }

  const allowedUpdates: any = {
    fullName: req.body.fullName,
    bioHeadline: req.body.bioHeadline,
    jobTitle: req.body.jobTitle,
    about: req.body.about,
    location: req.body.location,
    skills: normalizedSkills !== undefined ? normalizedSkills : req.body.skills,
    portfolio: req.body.portfolio,
    companyName: req.body.companyName,
    industry: req.body.industry,
    website: req.body.website,
    socialLinks: req.body.socialLinks,
    status: req.body.status,
    profileComplete: req.body.profileComplete,
    settings: req.body.settings
  };

  // تنظيف الأوبجكت من أي قيم undefined عشان منمسحش داتا قديمة
  Object.keys(allowedUpdates).forEach(key => allowedUpdates[key] === undefined && delete allowedUpdates[key]);

  // 3. التحديث في قاعدة البيانات
  const updatedUser = await User.findByIdAndUpdate((req.user as any)._id, allowedUpdates, {
    new: true, // يرجع الداتا الجديدة بعد التحديث
    runValidators: true // يتأكد إن الداتا مطابقة لشروط الـ Schema
  });

  res.status(200).json({
    status: 'success',
    message: 'The profile has been updated successfully',
    data: { user: updatedUser }
  });
});

// 3. جلب بروفايل مستخدم آخر (عشان لو حد عايز يفتح بروفايل زميله)
export const getUserProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);

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
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

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
  try {
    // 1. تجهيز أوبجكت الفلترة الفاضي
    const queryObj: any = {};

    // أ. البحث بكلمة مفتاحية (Keyword) في الاسم أو المهارات أو النبذة
    if (req.query.keyword) {
      // Escape special characters to prevent regex crashes (e.g. phone numbers with +)
      const escapedKeyword = (req.query.keyword as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedKeyword, 'i');

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
  } catch (error: any) {
    console.error('SEARCH ERROR:', error);
    return next(new AppError('Failed to search users. Invalid query or internal error.', 400));
  }
});

// 7. Request Verification (Employer)
export const requestVerification = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { verificationLink } = req.body;

  if (!verificationLink) {
    return next(new AppError('Please provide a verification link (LinkedIn or Website).', 400));
  }

  const updatedUser = await User.findByIdAndUpdate(
    (req.user as any)._id,
    { verificationLink, isVerified: false }, // Set to false explicitly in case they submit a new link
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
  try {
    const user = req.user as any;

    let populatedUser;
    if (user.role === 'freelancer') {
      populatedUser = await User.findById(user._id).populate('savedProjects');
    } else if (user.role === 'employer') {
      populatedUser = await User.findById(user._id).populate('savedFreelancers', 'fullName avatar jobTitle skills bio companyName status');
    } else {
return res.status(200).json({ status: 'success', data: { savedItems: [] } });
    }

    if (!populatedUser) {
      return next(new AppError('User not found.', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        savedItems: user.role === 'freelancer' ? populatedUser.savedProjects : populatedUser.savedFreelancers
      }
    });
  } catch (error: any) {
    console.error('GET SAVED ITEMS ERROR:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error fetching saved items: ' + error.message
    });
  }
});

// 11. Get My Contacts (Role-based visibility)
export const getMyContacts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUser;
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
    // 1. Users in the freelancer's manually added connections
    if (user.connections) {
      contactIds.push(...user.connections);
    }

    // 2. Users they have an existing chat history with
    const chats = await Chat.find({ users: user._id });
    const chatUsers = chats.flatMap(chat => chat.users)
      .filter(id => id.toString() !== user._id.toString());
    contactIds.push(...chatUsers as mongoose.Types.ObjectId[]);
  }

  // Deduplicate and filter out own ID
  const uniqueIds = Array.from(new Set(contactIds.map(id => id.toString())))
    .filter(id => id !== user._id.toString());

  // Fetch full details for these contacts
  const contacts = await User.find({ _id: { $in: uniqueIds } })
    .select('fullName avatar phoneNumber jobTitle status role');

  res.status(200).json({
    status: 'success',
    data: { contacts }
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

// 14. Save Custom Contact
export const saveContact = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IUser;
  const { firstName, lastName, phoneNumber, email, nickname, userId } = req.body;

  if (!firstName || !phoneNumber) {
    return next(new AppError('First name and phone number are required.', 400));
  }

  // Check if contact already exists by phone number
  const existingContact = user.customContacts?.find(c => c.phoneNumber === phoneNumber);
  
  if (existingContact) {
    return next(new AppError('A contact with this phone number already exists.', 400));
  }

  const newContact = {
    firstName,
    lastName,
    phoneNumber,
    email,
    nickname,
    userId
  };

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { $push: { customContacts: newContact } },
    { new: true, runValidators: true }
  );

  res.status(201).json({
    status: 'success',
    message: 'Contact saved successfully.',
    data: { contact: newContact, user: updatedUser }
  });
});