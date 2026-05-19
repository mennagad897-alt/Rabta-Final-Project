import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { User } from '../models/user';
import Job from '../models/Job';
import Chat from '../models/chat';
import Community from '../models/Community';
import AdminLog from '../models/adminLog.model';
import { AppError } from '../utils/AppError';

// =======================
// Dashboard Stats
// =======================
export const getAdminStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const totalUsers = await User.countDocuments();
  const totalJobs = await Job.countDocuments();
  const totalGroups = await Community.countDocuments();

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        totalUsers,
        totalJobs,
        totalGroups
      }
    }
  });
});

// =======================
// Users Moderation
// =======================
export const getAllUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const users = await User.find().select('-password');
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});

export const toggleBanUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (user.role === 'admin') {
    return next(new AppError('You cannot ban an admin', 400));
  }

  user.isBanned = !user.isBanned;
  await user.save({ validateBeforeSave: false });

  // Create admin log
  await AdminLog.create({
    adminId: (req as any).user._id,
    adminName: (req as any).user.fullName || 'Admin',
    actionType: user.isBanned ? 'BAN_USER' : 'UNBAN_USER',
    targetName: user.email || user.fullName,
  });

  res.status(200).json({
    status: 'success',
    message: `User has been successfully ${user.isBanned ? 'banned' : 'unbanned'}`,
    data: { user }
  });
});

export const getPendingEmployers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const employers = await User.find({
    role: 'employer',
    verificationStatus: { $nin: ['approved', 'rejected'] }
  }).select('-password');
  res.status(200).json({
    status: 'success',
    results: employers.length,
    data: { employers }
  });
});

export const verifyEmployer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'employer') {
    return next(new AppError('Employer not found', 404));
  }

  user.verificationStatus = 'approved';
  user.rejectionReason = '';
  await user.save({ validateBeforeSave: false });

  await AdminLog.create({
    adminId: (req as any).user._id,
    adminName: (req as any).user.fullName || 'Admin',
    actionType: 'VERIFY_EMPLOYER',
    targetName: user.email || user.fullName,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(user._id.toString()).emit('employerStatusUpdated', {
      status: 'approved',
      user: user
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Employer has been verified successfully',
    data: { user }
  });
});

export const rejectEmployer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'employer') {
    return next(new AppError('Employer not found', 404));
  }

  const { reason } = req.body;
  if (!reason) {
    return next(new AppError('Rejection reason is required', 400));
  }

  user.verificationStatus = 'rejected';
  user.rejectionReason = reason;
  await user.save({ validateBeforeSave: false });

  await AdminLog.create({
    adminId: (req as any).user._id,
    adminName: (req as any).user.fullName || 'Admin',
    actionType: 'REJECT_EMPLOYER',
    targetName: user.email || user.fullName,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(user._id.toString()).emit('employerStatusUpdated', {
      status: 'rejected',
      reason: reason,
      user: user
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Employer has been rejected successfully',
    data: { user }
  });
});

export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (user.role === 'admin') {
    return next(new AppError('You cannot delete an admin', 400));
  }

  await User.findByIdAndDelete(req.params.id);

  // Create admin log
  await AdminLog.create({
    adminId: (req as any).user._id,
    adminName: (req as any).user.fullName || 'Admin',
    actionType: 'DELETE_USER',
    targetName: user.email || user.fullName,
  });

  res.status(200).json({
    status: 'success',
    message: 'User has been successfully deleted'
  });
});

export const promoteAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (user.role === 'admin') {
    return next(new AppError('User is already an admin', 400));
  }

  user.role = 'admin';
  await user.save({ validateBeforeSave: false });

  // Create admin log
  await AdminLog.create({
    adminId: (req as any).user._id,
    adminName: (req as any).user.fullName || 'Admin',
    actionType: 'PROMOTED_ADMIN',
    targetName: user.email || user.fullName,
  });

  res.status(200).json({
    status: 'success',
    message: 'User has been promoted to admin successfully',
    data: { user }
  });
});

// =======================
// Jobs Moderation
// =======================
export const getAllJobs = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const jobs = await Job.find().populate('publisherId', 'fullName email companyName');
  res.status(200).json({
    status: 'success',
    results: jobs.length,
    data: { jobs }
  });
});

export const deleteJob = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const job = await Job.findByIdAndDelete(req.params.id);
  if (!job) {
    return next(new AppError('Job not found', 404));
  }

  // Create admin log
  await AdminLog.create({
    adminId: (req as any).user._id,
    adminName: (req as any).user.fullName || 'Admin',
    actionType: 'DELETE_JOB',
    targetName: job.title || 'Unknown Job',
  });

  res.status(200).json({
    status: 'success',
    message: 'Job has been successfully deleted'
  });
});

// =======================
// Groups Moderation
// =======================
export const getAllGroups = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const groups = await Community.find().populate('owner', 'fullName email');

  // Transform to match the required fields: Name, Creator, Member Count
  const formattedGroups = groups.map((g: any) => ({
    _id: g._id,
    name: g.name,
    creator: g.owner ? { _id: g.owner._id, fullName: g.owner.fullName, email: g.owner.email } : null,
    memberCount: g.members ? g.members.length : 0,
    createdAt: g.createdAt
  }));

  res.status(200).json({
    status: 'success',
    results: formattedGroups.length,
    data: { groups: formattedGroups }
  });
});

export const deleteGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const group = await Community.findByIdAndDelete(req.params.id);
  if (!group) {
    return next(new AppError('Group not found', 404));
  }

  // Optionally, you could also delete all messages related to this group
  // await Message.deleteMany({ chatId: group._id });

  // Create admin log
  await AdminLog.create({
    adminId: (req as any).user._id,
    adminName: (req as any).user.fullName || 'Admin',
    actionType: 'DELETE_GROUP',
    targetName: group.name || 'Unknown Community',
  });

  res.status(200).json({
    status: 'success',
    message: 'Group has been successfully deleted'
  });
});

// =======================
// Activity Logs
// =======================
export const getAdminLogs = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const logs = await AdminLog.find().sort('-createdAt').limit(100);
  res.status(200).json({
    status: 'success',
    results: logs.length,
    data: { logs }
  });
});
