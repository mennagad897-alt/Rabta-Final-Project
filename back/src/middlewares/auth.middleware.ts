import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
// 👈 ضفنا الـ IUser هنا في الاستيراد
import { User, IUser } from '../models/user'; 
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';

// 👇 التعديل هنا: بنفهم TypeScript إن اليوزر بتاع Passport هو هو الـ IUser بتاعنا بالظبط
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // 1. Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // 2. Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;

  // 3. Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  // 4. Grant access to protected route
  req.user = currentUser;
  next();
});