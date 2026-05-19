import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

// إن ده layer حماية بعد authentication
// Authorization (التصريح): ده layer حماية بعد authentication وبيحدد "إيه اللي مسموحلك تعمله" بناءً على دورك (زي student أو employer).
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};
