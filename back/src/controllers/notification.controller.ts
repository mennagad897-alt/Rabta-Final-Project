import { Request, Response, NextFunction } from 'express';
import Notification from '../models/Notification';
import { User } from '../models/user';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';

export const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)._id;
  const notifications = await Notification.find({ recipient: userId }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    data: { notifications }
  });
});

export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  await Notification.updateMany(
    { recipient: (req.user as any)._id, read: false },
    { read: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read'
  });
});

// Get current user's notificationSettings
export const getNotificationSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id;

  const user = await User.findById(userId).select('notificationSettings');

  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { notificationSettings: user.notificationSettings }
  });
});

// Update current user's notificationSettings (partial update)
export const updateNotificationSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id;
  const { chatMessages, communityMentions, aiJobMatches, inAppSounds } = req.body;

  // Build a $set object using dot-notation so only sent fields are updated
  const updateFields: Record<string, boolean> = {};
  if (chatMessages !== undefined)      updateFields['notificationSettings.chatMessages']      = chatMessages;
  if (communityMentions !== undefined) updateFields['notificationSettings.communityMentions'] = communityMentions;
  if (aiJobMatches !== undefined)      updateFields['notificationSettings.aiJobMatches']      = aiJobMatches;
  if (inAppSounds !== undefined)       updateFields['notificationSettings.inAppSounds']       = inAppSounds;

  if (Object.keys(updateFields).length === 0) {
    return next(new AppError('No valid notification settings fields were provided.', 400));
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).select('notificationSettings');

  res.status(200).json({
    status: 'success',
    message: 'Notification settings updated successfully.',
    data: { notificationSettings: updatedUser?.notificationSettings }
  });
});

// Get current user's privacy settings
export const getPrivacySettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id;

  const user = await User.findById(userId).select('showOnlineStatus');

  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  res.status(200).json({
    showOnlineStatus: user.showOnlineStatus !== false
  });
});

// Update current user's privacy settings
export const updatePrivacySettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id;
  const { showOnlineStatus } = req.body;

  if (showOnlineStatus === undefined) {
    return next(new AppError('No valid privacy fields were provided.', 400));
  }

  await User.findByIdAndUpdate(
    userId,
    { $set: { showOnlineStatus: Boolean(showOnlineStatus) } },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Privacy settings updated successfully.',
    showOnlineStatus: Boolean(showOnlineStatus)
  });
});
