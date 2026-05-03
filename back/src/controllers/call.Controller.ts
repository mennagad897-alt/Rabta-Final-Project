import { Request, Response, NextFunction } from 'express';
import Call from '../models/Call';
import Community from '../models/Community';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';

export const getUserCalls = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any)._id;

  const calls = await Call.find({
    $or: [{ caller: userId }, { receiver: userId }]
  })
  .populate('caller', 'fullName avatar jobTitle')
  .populate('receiver', 'fullName avatar jobTitle')
  .populate('communityId', 'name profileImage members')
  .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: { calls }
    });
  } catch (error: any) {
    console.error('GET CALL HISTORY ERROR:', error.message);
    console.error(error.stack);
    return next(new AppError('Internal Server Error fetching call history', 500));
  }
});

export const initiateCall = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { receiverId, communityId, type } = req.body;
  const callerId = (req.user as any)._id;

  if (!type) {
    return next(new AppError('Call type is required', 400));
  }

  if (type === 'group' && !communityId) {
    return next(new AppError('communityId is required for group calls', 400));
  }

  if (type !== 'group' && !receiverId) {
    return next(new AppError('receiverId is required for 1-on-1 calls', 400));
  }

  const call = await Call.create({
    caller: callerId,
    receiver: receiverId || undefined,
    communityId: communityId || undefined,
    type,
    status: 'missed'
  });

  res.status(201).json({
    status: 'success',
    data: { call }
  });
});

export const deleteCall = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const call = await Call.findById(id);

  if (!call) {
    return next(new AppError('No call found with that ID', 404));
  }

  await Call.findByIdAndDelete(id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});