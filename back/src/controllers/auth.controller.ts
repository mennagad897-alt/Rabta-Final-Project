import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import jwt from 'jsonwebtoken';

export const login = catchAsync(async (req: Request, res: Response) => {
  const { user, token, profileComplete } = await authService.loginUser(req.body.email, req.body.password);
  res.status(200).json({ 
    status: 'success', 
    data: { user, token, profileComplete } 
  });
});

export const register = catchAsync(async (req: Request, res: Response) => {
  const { user, token } = await authService.registerUser(req.body);
  res.status(201).json({ 
    status: 'success', 
    data: { user, token } 
  });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  res.status(200).json({ 
    status: 'success', 
    message: 'Reset link sent to email' 
  });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { user, token } = await authService.resetPassword(req.params.token as string, req.body.password);
  res.status(200).json({ 
    status: 'success', 
    message: 'Password updated successfully',
    data: { user, token }
  });
});

export const googleAuthCallback = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError('Google login failed', 401));
  const user = req.user as any;
  const token = authService.signToken(user._id.toString());
  
  // We should also check profileComplete for Google users
  const profileComplete = user.profileComplete;
  
  // توجيه المستخدم للفرونت إند (React) مع التوكن وحالة البروفايل
  res.redirect(`${process.env.FRONTEND_URL}/login-success?token=${token}&profileComplete=${profileComplete}`);
});